# Hey, Lucas here! Welcome to the Twenty Fork, explained

This is a quick handoff for this Twenty Fork, intended to explain how the project works, what I added (the Analysis feature), and what's still half-baked. It's meant to get you, up to speed fast. If you only read one thing, read Section 2, it pretty much makes the rest easy to get.

---

## 1. What this project is

This is a fork of **Twenty**, an open-source CRM platform, intended to be sold by Glassbox as a privative solution for HK Government and banks, it was built as an Nx monorepo (TypeScript, Yarn 4). Twenty is **multi-tenant**: one instance serves many independent workspaces, each with its own data and its own customizable data model. Think "Notion meets Salesforce, but open source."

The fork's main addition is a **data Analysis feature**: upload a CSV, configure an analysis (descriptive statistics, anomaly detection, or ML classification), hit run, and see results — with anomalies highlighted right in the data table.

Here's the whole system in one picture:

```mermaid
flowchart LR
    subgraph Browser
        F[twenty-front<br/>React + Vite + Jotai]
    end

    subgraph Server["twenty-server (NestJS)"]
        API[GraphQL API<br/>Yoga + custom resolvers]
        MOD[Feature modules<br/>Auth, Billing, Workflow, AI,<br/>AnalysisModule…]
        ORM[TypeORM]
        WK[BullMQ Worker<br/>background jobs]
        MS[Meta / Metadata engine<br/>objects, fields, views]
    end

    subgraph Data
        PG[(PostgreSQL<br/>core + per-workspace schemas)]
        RD[(Redis<br/>cache, SDL, sessions)]
    end

    subgraph AI["Analysis service"]
        PY[twenty-analysis-service<br/>Python + FastAPI<br/>pandas + scikit-learn + LightGBM]
    end

    F --> API
    API --> MOD
    MOD --> ORM
    ORM --> PG
    MOD --> MS
    MS --> PG
    WK --> RD
    WK --> ORM
    MOD -- "ANALYSIS_SERVICE_URL" --> PY
```

---

## 2. The mental model that unlocks everything: objects, workspaces, metadata

Three concepts explain almost all of this codebase. Once they click, everything else is scaffolding.

### 2.1 Objects — "tables with superpowers"

An **object** is a database table plus a bunch of opinions about it:

- a **name** (`company`, `person`, `analysis`, …)
- **fields** with types (text, number, date, relation, JSON, …)
- **views** (saved table layouts: columns, filters, sorting)
- **navigation** placement, permissions, relations, audit logging, search config

In a "normal" app you'd hand-write all this. Here, objects are *declared* once, and the system builds the table, GraphQL schema, and UI from that declaration.

### 2.2 Workspaces — "tenants, done right"

Twenty is **multi-tenant**. Each workspace gets:

- its own Postgres **schema** (`workspace_<random-id>`) — tenant data is physically isolated
- its own **metadata rows** — one workspace can customize its objects/fields/views without touching another
- its own **members** (users linked through `core.userWorkspace`)

So one Postgres database holds many isolated little databases. The dev seed creates the **"Apple"** demo workspace; the seeded account is `tim@apple.dev`.

### 2.3 Metadata — "the system that describes the system"

This is the clever bit. Twenty keeps two layers:

| Layer | Location | Contents |
|---|---|---|
| Core (system) schema | `core.*` | Users, workspaces, and metadata (`objectMetadata`, `fieldMetadata`, `view`, `navigationMenuItem`, …) |
| Workspace schemas | `workspace_<id>.*` | Actual tenant records (`company`, `person`, `analysis`, …) |

When a workspace is created/activated, Twenty:

1. reads the metadata from the **standard application** definition,
2. creates the actual tables in the workspace schema (via migration commands),
3. generates a **GraphQL schema** for that workspace on the fly,
4. builds the **UI** (nav, record pages) from the same metadata.

Change a field's metadata, and the table, GraphQL types, and UI all follow. It's turtles all the way down, and that's intentional. It's also the source of most "why is this so meta??" confusion. XD

```mermaid
flowchart TB
    subgraph Core["core.* (system DB)"]
        U[user] --> UW[userWorkspace]
        W[workspace] --> UW
        M[objectMetadata / fieldMetadata]
        V[view / navigationMenuItem]
    end

    subgraph WS["workspace_<id>.* (tenant data)"]
        T1[company]
        T2[person]
        T3[analysis]
    end

    M -- "on activation, standard app sync" --> WS
    V -- "drives the UI" --> UI[Browser UI]
    WS --> UI
```

---

## 3. The monorepo zoo 🐘

Everything lives under `packages/` in an Nx workspace managed with Yarn 4.

| Package | Purpose |
|---|---|
| `twenty-server` | NestJS backend: GraphQL API, metadata engine, jobs worker, AnalysisModule |
| `twenty-front` | React frontend (Vite), including the custom Analysis Workspace |
| `twenty-shared` | Shared types + constants. Source of truth for object definitions (`STANDARD_OBJECTS`) and `AppPath` |
| `twenty-ui` | Shared UI component library (buttons, inputs, tables, theme tokens) |
| `twenty-sdk` / `twenty-client-sdk` | SDKs |
| `twenty-emails` | React Email templates |
| `twenty-website` | Next.js marketing site |
| `twenty-docs` | Docs site |
| `twenty-e2e-testing` | Playwright E2E tests |
| `twenty-zapier` | Zapier integration |
| `twenty-docker` | Docker / Helm / K8s deployment configs |
| `twenty-utils` | Dev tooling (`setup-dev-env.sh`, port checker) |
| `twenty-analysis-service` | **Python + FastAPI** analysis service (added in this fork) |
| `twenty-apps`, `twenty-cli`, `twenty-companion`, `twenty-codex-plugin`, `twenty-claude-skills` | Apps / CLI / plugins / skills |

**One rule to internalize:** `twenty-shared` is the source of truth for object definitions. When adding a field to an object, edit the `STANDARD_OBJECTS` constant in `twenty-shared`, then **rebuild** it (`npx nx run twenty-shared:build --skip-nx-cache`) — the server resolves the built `dist`. Forget the rebuild and you'll chase ghosts. 👻

---

## 4. Following a request end to end

1. The React app (Vite dev server on `:3001`) makes GraphQL calls.
2. The NestJS backend (GraphQL Yoga on `:3000`) figures out your workspace from the token, then serves **that workspace's generated GraphQL schema**.
3. Service modules (auth, workflow, AI, analysis, …) run the business logic.
4. **TypeORM** talks to **Postgres** — `workspace_<id>` schemas for tenant data, `core` for system data.
5. Heavy jobs go to **BullMQ** (Redis) and are handled by the **worker process** (`twenty-server:worker`).
6. **Redis** holds cache, sessions, and cached GraphQL schema SDL.

Stack: **React → GraphQL → NestJS → TypeORM → Postgres**, with Redis and a worker alongside, plus the Python FastAPI analysis service at `ANALYSIS_SERVICE_URL` (`http://localhost:8000`).

---

## 5. Database and data-saving dynamics

### 5.1 Postgres multi-tenancy

- Single database (`default`, `postgres://postgres:postgres@localhost:5432/default`).
- `core.*` holds users, workspaces, and metadata.
- `workspace_<id>.*` holds tenant records.
- The Postgres MCP server in `.mcp.json` is read-only and great for inspecting schema/data while debugging ("is this a frontend, backend, or data issue?").

### 5.2 Migrations ("instance commands")

After changing a workspace entity, generate a migration:

```bash
npx nx run twenty-server:database:migrate:generate --name <name> --type fast
```

- **fast** commands handle schema changes.
- **slow** commands add a `runDataMigration` step for data backfills.
- Don't edit the `up`/`down` logic of already-committed migrations.

### 5.3 Redis

Holds cache, sessions, and cached GraphQL schema SDL per workspace. Redis is a hard startup dependency — no Redis, no boot.

### 5.4 Where the Analysis data actually lives

Here's the surprising bit: **the Analysis feature's data does NOT live in Postgres right now.** The custom UI stores everything in the browser's **IndexedDB** (we'll get to why in §7.4). The `analysis` table exists in the workspace schema, but the client-side feature doesn't write to it (yet). More in §7 and §8.

---

## 6. Scripts and the daily driver

```bash
# ONE command to rule them all — boots backend + frontend + worker
yarn start

# Same, but force-kills anything squatting on the ports
yarn start:force
```

`yarn start` first runs `packages/twenty-utils/check-dev-ports.mjs --kill` (cleans stale dev processes on `:3000`/`:3001`), then starts `twenty-server` + `twenty-front` via `concurrently`, waits for `:3000`, and boots the worker. It's self-healing after a machine gets stuck with orphaned dev servers.

| Task | Command |
|---|---|
| Fresh environment setup (DB, Redis, `.env`, schema) | `bash packages/twenty-utils/setup-dev-env.sh` |
| Reset + re-seed dev database | `npx nx database:reset twenty-server` |
| Start one package | `npx nx start twenty-server` / `npx nx start twenty-front` |
| Run the worker | `npx nx run twenty-server:worker` |
| Lint (diff vs main, fast) | `npx nx lint:diff-with-main twenty-front` |
| Typecheck | `npx nx typecheck twenty-front` / `twenty-server` |
| Test a single file | `cd packages/<pkg> && npx jest "pattern"` |
| Build shared (after touching `twenty-shared`) | `npx nx build twenty-shared` |

**Ports:** backend `3000`, frontend `3001`, analysis service `8000`, Postgres `5432`, Redis `6379`.

**Demo login:** `tim@apple.dev` / `tim@apple.dev` (available after `database:reset` seeds the Apple workspace).

> ⚠️ If you ever verify the seeded password hash in a script, use the native **`bcrypt`** package — `bcryptjs` reports `false` for it even though it's correct. (Trust me, this bit me once.)

---

## 7. Glassbox unique feature in the fork: the Analysis feature

### 7.1 What it does

Upload a CSV → configure (descriptive / anomaly detection / classification) → run → beautiful results panel, with anomalies highlighted right in the data table.

```mermaid
flowchart LR
    CSV[Upload CSV] --> PARSE[parseCsvFile → AnalysisFile]
    PARSE --> CFG[Configure: type + target column + params]
    CFG --> RUN[Run]
    RUN --> COMP[computeAnalysisResult / Python service]
    COMP --> RES[Results panel<br/>descriptive / anomalies / classification]
    RES --> STORE[(IndexedDB)]
```

### 7.2 The standard object (backend)

The `analysis` object is a first-class **standard object**, declared the Twenty way:

- **`twenty-shared`** — `STANDARD_OBJECTS.analysis` lists every field (source of truth).
- **`analysis.workspace-entity.ts`** — the workspace entity (extends `BaseWorkspaceEntity`): `name`, `csvFileId`, `analysisType`, `targetColumn`, `config`, `status`, `result`, plus `attachments`/`noteTargets` relations.
- **`compute-analysis-standard-flat-field-metadata.util.ts`** — builds the field metadata (types, labels, icons, defaults: `status` → `'pending'`, `analysisType` → `'descriptive'`).
- Matching **views** (`compute-standard-analysis-views.util.ts`), **indexes**, **search fields**, and a **page layout** config.

Because it's a standard object, `analysis` gets a table, GraphQL schema, and standard object plumbing for free. 💪

### 7.3 How it's routed

Two things make the feature reachable:

1. **A nav item.** `STANDARD_NAVIGATION_MENU_ITEMS.allAnalyses` (an OBJECT nav item, position 6, purple). Frontend OBJECT nav items link to `/objects/{namePlural}`, so this resolves to `/objects/analyses`.
2. **A custom page.** Twenty's generic `RecordIndexPage` renders the standard table UI for any object. I special-cased it:

   ```ts
   if (objectMetadataItem.namePlural === 'analyses') {
     return <AnalysisWorkspacePage />;
   }
   ```

   So `/objects/analyses` renders the custom **Analysis Workspace** instead of the default table. Sneaky, clean, no custom route needed.

The Analysis Workspace page is a **3-pane layout**:

- **Left pane** — "Files to analyze" + "Recent analyses" (with delete dropdowns).
- **Main pane** — the CSV data preview table (custom sliding-window virtualization keeps huge files smooth) + an action bar.
- **Overlays** — upload/config side panel, metadata drawer, right-side results panel.

### 7.4 Custom UI and state (frontend)

All under `packages/twenty-front/src/modules/analysis/`:

- `components/` — `CsvUploadStep`, `AnalysisConfigStep`, `AnalysisSidePanel`, `AnalysisResultsPanel`, `AnalysisFilePreview`, per-type result components (`DescriptiveResults`, `IsolationForestResults`, `ClassificationResults`), `AnalysisFieldMetadataDrawer`.
- `hooks/` — `useCreateAnalysis` (currently a local mock; the GraphQL call is commented out — see §8).
- `utils/` — `parseCsvFile` (turns a `File` into an `AnalysisFile` with dtypes/stats/preview rows), `computeAnalysisResult`, `getAnomalousPreviewRows`.
- `types/` — `Analysis`, `AnalysisRun`, and result types.
- `states/` — Jotai atoms holding all feature state.

**Persistence:** atoms are persisted with `atomWithStorage`, backed by **IndexedDB** (`analysisStorage.ts` wraps `createIndexedDbBackedJotaiStorage`, store name `analysis-store`) — not localStorage:

- **Why?** localStorage has a ~5MB quota; large datasets/results blow right past it. IndexedDB has a much bigger quota.
- A **one-time migration** (`migrateAnalysisStateFromLocalStorage`) moves legacy keys into IndexedDB; logout clears the store.
- Writes are **fire-and-forget** (errors logged, never crash the app).

So your analyses survive a reload, but they live **in your browser**, not in the database. Deliberate "prototype" decision — and the main thing to change when we wire this to the real backend.

### 7.5 The Python brain

`packages/twenty-analysis-service` is a **FastAPI** microservice:

- `POST /analyze` accepts `{ analysis_type, data (2D array), columns, config }` → returns `{ run_id, status, result }`.
- Three analysis types:
  - **descriptive** — per-column stats + correlation matrix.
  - **isolation_forest** — anomaly detection (row scores, contributing features); tunable `contamination`, `n_estimators`, `max_samples`.
  - **classification** — LightGBM / random forest / logistic regression; accuracy/precision/recall/F1, confusion matrix, feature importance.
- Runs on `http://localhost:8000`; tested with pytest (17 passing).
- The NestJS `AnalysisClientService` calls it, currently fed **demo data** (reading the real uploaded CSV is a TODO).

### 7.6 The server module (the half-built part)

`packages/twenty-server/src/modules/analysis/` has a proper NestJS shape:

- `analysis.module.ts` — wires resolver + service + client + job.
- `analysis.resolver.ts` — GraphQL queries/mutations (`analyses`, `analysis`, `analysisRun`, `createAnalysis`, `runAnalysis`, `deleteAnalysis`).
- `analysis.service.ts` — **in-memory** `Map` store for demo purposes (comment: "In production, this would use TypeORM/Workspace repositories").
- `analysis-client/` — HTTP client to the Python service.
- `jobs/run-analysis.job.ts` — BullMQ job scaffold.

**Honest status:** the plumbing exists, but the frontend and this module aren't wired together yet. The frontend computes results locally; the server module is a structured demo.

### 7.7 Bonus: the AI angle

- **`InspectAnalysisTool`** was added (`src/engine/core-modules/tool/tools/analysis-tool/`) so the AI assistant can `listAnalyses`, `getAnalysis`, `getDatasetInfo`, `readDataset`.
- A **DeepSeek provider** (`deepseek/deepseek-v4-flash`) was added to the AI model catalog. The provider is only active when `DEEPSEEK_API_KEY` is set, and new providers must also be added to `DEFAULT_RECOMMENDED_MODELS` or they won't appear as enabled.

---

## 8. What I added  vs what's missing

### Added
- `analysis` standard object (entity, field metadata, views, index, search, page layout)
- Nav item + routing (`/objects/analyses` → custom page)
- Custom Analysis Workspace UI (upload → config → run → results, with anomaly highlighting)
- IndexedDB persistence + localStorage migration
- Python analysis service (descriptive / isolation forest / classification, LightGBM)
- Server AnalysisModule scaffold (resolver/service/client/job)
- `InspectAnalysisTool` + DeepSeek AI provider
- Dev tooling fixes: self-healing `yarn start`, port checker, query-timeout bump

### Missing / half-done
- Frontend feature and server module are **not wired together** — UI stores in IndexedDB; server module stores in-memory; neither writes to Postgres.
- `useCreateAnalysis` is a **local mock**; the real GraphQL mutation is commented out.
- `AnalysisService` uses **demo data**, not the actual uploaded CSV (`csvFileId` → file storage is a TODO).
- The `analysis` table **exists** in Postgres but the feature doesn't write to it.
- In-memory `Map`s in `AnalysisService` have **no eviction** (fine for demo, a leak if used for real).
- The analysis module has **lint noise** (non-`Styled*` component names, hardcoded colors, `type Props`) — module-wide convention drift, not new bugs.
- Some handoff checklist items were superseded by the "local-first" approach (e.g. no `AnalysisRun` standard object; no Docker Compose wiring for the Python service).

---

## 9. Bugs & known rough edges

Per plan, a full code-bug review is still **parked** for a later session, but here are the bugs & TODOs already on our radar, plus the operational gotchas we've hit and fixed.

### Reported bugs & TODOs
- **Workflows can't use the analysis object** — there's no workflow node that exposes the analysis tools as workflow actions. TODO: add a proper workflow node so analysis can be triggered as part of a workflow, in case it's needed.
- **Agent chat can get stuck** — when you ask an agent to perform a task, an unclear tool definition can cause it to loop: it sometimes malforms the JSON and retries forever. Needs tool-definition hardening + retry/backoff limits.
- **Classification (Random Forest) hangs** — running a classification analysis with the Random Forest algorithm gets stuck and never outputs anything. Needs investigation (likely in `twenty-analysis-service`).

### Operational gotchas (already hit & fixed)

- **`Sign up is disabled` on login** — single-workspace mode rejects *new* signups. If `tim@apple.dev` isn't in the DB (e.g. after a fresh reset that didn't seed), sign in with the seeded account. Seeding is what fixes it.
- **`Query read timeout`** on dev laptops — the 10s Postgres client timeout is too tight when overlapping dev stacks stall a query. Fixed via `.env`: `PG_DATABASE_PRIMARY_TIMEOUT_MS=30000` (restart the backend after changing it).
- **Stale dev servers** cause port drift (`:3001` busy, `:3002` appears) and 504s — `yarn start` auto-cleans; `yarn start:force` nukes everything. Root cause: orphaned `nest start --watch` trees.
- **Stale workspace schemas** → `EntityMetadataNotFoundError: No metadata for "workspaceMember"`. Fix: drop the stale `workspace_<id>` schema and the `core.workspace`/`core.user` rows.
- **Forgot to rebuild `twenty-shared`** → server misses fields/constants just added. Rebuild after any `STANDARD_OBJECTS` edit.


---

## 10. Summary

- **Twenty = multi-tenant CRM**, built on **objects + workspaces + metadata**.
- **Objects** are declared once; tables, GraphQL, and UI are generated from metadata.
- **Workspaces** = isolated Postgres schemas per tenant; `core` holds users + metadata.
- **Frontend** React/Vite/Jotai/Linaria · **Backend** NestJS/TypeORM/GraphQL · **Cache** Redis · **Jobs** BullMQ worker.
- **The fork adds an Analysis feature**: a new `analysis` standard object, a custom 3-pane UI routed at `/objects/analyses`, IndexedDB persistence, and a Python FastAPI service for the computation.
- **The honest caveat:** the feature is *frontend-first* — the server module and Postgres aren't wired in yet. That's the next big push. 💪
