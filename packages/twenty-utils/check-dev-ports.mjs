#!/usr/bin/env node
/**
 * Pre-flight check for `yarn start`.
 *
 * Twenty's dev stack binds fixed ports (3000 backend, 3001 frontend). If a
 * previous stack is still running (or was orphaned), `yarn start` fails in
 * confusing ways: the frontend drifts to a random port, the `wait-on
 * tcp:3000` gate stalls, and stale `nest start --watch` wrappers re-grab
 * :3000 as soon as `dist` is rewritten (EADDRINUSE). This script fails fast
 * with a clear message instead.
 *
 * Usage:
 *   node packages/twenty-utils/check-dev-ports.mjs            # fail if busy
 *   node packages/twenty-utils/check-dev-ports.mjs --kill     # kill :3000/:3001 + dev-stack tree, then pass (used by `yarn start`)
 *   node packages/twenty-utils/check-dev-ports.mjs --kill-all # also kill :3002 (drifted frontend / website), then pass (used by `yarn start:force`)
 */
import net from 'node:net';
import { execFileSync } from 'node:child_process';

const DEV_PORTS = [
  { port: 3000, name: 'twenty-server (backend)' },
  { port: 3001, name: 'twenty-front (frontend)' },
];

// A stale frontend can drift to 3002/3003 after the primary port is taken
// (old Vite behavior). Only cleaned up in --kill mode; the 3002 port is also
// used by twenty-website, so it is not a hard startup blocker.
const KILL_PORTS = [
  ...DEV_PORTS,
  { port: 3002, name: 'stale frontend / website' },
];

// Command-line markers that identify the Twenty dev stack. Killed as a tree
// in --kill mode because `nest start --watch` wrappers are not always
// listening on a port, yet they re-bind it the moment `dist` is rewritten.
const DEV_STACK_PATTERNS = [
  'nest start', // server + worker --watch wrappers
  '/dist/main', // compiled backend
  '/dist/queue-worker', // compiled worker
  'run-many -t start -p twenty-server',
  'run twenty-server:worker',
  'wait-on tcp:3000',
];

const isDevStackCommand = (command) =>
  DEV_STACK_PATTERNS.some((pattern) => command.includes(pattern)) ||
  (command.includes('concurrently') && command.includes('twenty-server'));

const hasLsof = () => {
  try {
    execFileSync('lsof', ['-v'], { stdio: 'ignore' });

    return true;
  } catch {
    return false;
  }
};

const getListenerPidsViaLsof = (port) => {
  try {
    const output = execFileSync(
      'lsof',
      ['-tiTCP:' + port, '-sTCP:LISTEN'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    );

    return output
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
};

const isPortInUseViaNet = (port) =>
  new Promise((resolve) => {
    const socket = net.connect({ port, host: '127.0.0.1' });

    socket.setTimeout(500);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('error', () => resolve(false));
  });

const getDevStackPids = () => {
  const pids = [];

  try {
    const output = execFileSync('ps', ['-axo', 'pid=,command='], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });

    for (const line of output.split('\n')) {
      const match = line.match(/^\s*(\d+)\s+(.*)$/);

      if (match && isDevStackCommand(match[2])) {
        pids.push({ pid: match[1], command: match[2] });
      }
    }
  } catch {
    // ps unavailable; fall back to port-based detection only
  }

  return pids;
};

const killPids = (pids, label) => {
  for (const { pid, command } of pids) {
    const cmdSuffix = command ? ` (${command.slice(0, 90)})` : '';

    process.stdout.write(`${label} PID ${pid}${cmdSuffix}\n`);

    try {
      process.kill(Number(pid), 'SIGTERM');
    } catch (error) {
      process.stderr.write(`  Could not kill PID ${pid}: ${error.message}\n`);
    }
  }
};

const waitForPortsFree = async (ports, useLsof, timeoutMs) => {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    let allFree = true;

    for (const port of ports) {
      const inUse = useLsof
        ? getListenerPidsViaLsof(port).length > 0
        : await isPortInUseViaNet(port);

      if (inUse) {
        allFree = false;
        break;
      }
    }

    if (allFree) {
      return true;
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  return false;
};

const main = async () => {
  const shouldKill =
    process.argv.includes('--kill') || process.argv.includes('--kill-all');
  const killAll = process.argv.includes('--kill-all');
  const useLsof = hasLsof();

  // Kill mode: sweep the dev-stack process tree first (so `nest start
  // --watch` parents die before their children), then the chosen ports, then
  // wait for :3000/:3001 to free up so the freshly-started backend cannot
  // race into EADDRINUSE. `yarn start` uses this by default so the stack is
  // always restarted cleanly.
  if (shouldKill) {
    killPids(getDevStackPids(), 'Killing stale dev-stack process');

    const killSet = killAll ? KILL_PORTS : DEV_PORTS;

    for (const { port, name } of killSet) {
      const pids = useLsof
        ? getListenerPidsViaLsof(port).map((pid) => ({
            pid,
            command: `listener on :${port} (${name})`,
          }))
        : (await isPortInUseViaNet(port)
            ? [{ pid: 'unknown', command: `listener on :${port} (${name})` }]
            : []);

      killPids(pids, `Killing stale listener`);
    }

    const freed = await waitForPortsFree([3000, 3001], useLsof, 5000);

    if (!freed) {
      process.stderr.write(
        'Warning: :3000/:3001 still busy after kill; the backend may fail to bind.\n',
      );
    }

    process.exit(0);
  }

  const busyPorts = [];

  for (const { port, name } of DEV_PORTS) {
    if (useLsof) {
      const pids = getListenerPidsViaLsof(port);

      if (pids.length > 0) {
        busyPorts.push({ port, name, pids });
      }
    } else if (await isPortInUseViaNet(port)) {
      busyPorts.push({ port, name, pids: [] });
    }
  }

  const devStackPids = getDevStackPids();

  if (busyPorts.length === 0 && devStackPids.length === 0) {
    process.stdout.write(
      'Dev ports 3000/3001 are free and no dev-stack processes are running.\n',
    );
    process.exit(0);
  }

  process.stderr.write('\nA Twenty dev stack is still running:\n');

  for (const { port, name, pids } of busyPorts) {
    const pidText = pids.length > 0 ? ` (PID ${pids.join(', ')})` : '';

    process.stderr.write(`  - :${port}  ${name}${pidText}\n`);
  }

  for (const { pid, command } of devStackPids) {
    process.stderr.write(`  - PID ${pid}  ${command.slice(0, 100)}\n`);
  }

  process.stderr.write(
    '\nThis causes port conflicts (EADDRINUSE) and stalls the `wait-on` gate.\n' +
      'Options:\n' +
      '  • Stop the existing stack, then run `yarn start` again.\n' +
      '  • Run `yarn start:force` to kill the stale stack and restart.\n',
  );

  process.exit(1);
};

main();
