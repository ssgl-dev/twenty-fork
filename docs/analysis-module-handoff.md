# Agent Handoff: Analysis Module Implementation

> **Target Agent**: Implementation agent (Claude Code, Cursor, etc.)
> **Planning Doc**: `docs/analysis-module-planning.md` (read this first)
> **Repository**: `/Users/lukassspazo/twenty`

---

## Task Overview

Add a new **"Analysis"** workspace tab that lets users upload CSVs and run ML/statistical analysis (Isolation Forest, classification, descriptive stats).

**Architecture**: Python FastAPI microservice called by NestJS backend via HTTP.

---

## Implementation Order (follow strictly)

### Step 1: Python Analysis Service

**Location**: `packages/twenty-analysis-service/`

Create these files in order:

1. **`pyproject.toml`** — Dependencies:
   ```toml
   [project]
   name = "twenty-analysis-service"
   version = "0.1.0"
   requires-python = ">=3.11"
   dependencies = [
       "fastapi>=0.115.0",
       "uvicorn[standard]>=0.32.0",
       "pandas>=2.2.0",
       "scikit-learn>=1.5.0",
       "numpy>=2.0.0",
       "pydantic>=2.8.0",
       "python-multipart>=0.0.9",
   ]
   ```

2. **`src/main.py`** — FastAPI app that imports routers

3. **`src/routers/health.py`** — `GET /health` → `{"status": "ok"}`

4. **`src/routers/analysis.py`** — `POST /analyze` endpoint:
   - Accepts `{ analysis_type, data (2D array), columns, config }`
   - Returns `{ run_id, status, result }`
   - Delegates to the correct service based on `analysis_type`

5. **`src/schemas/analysis.py`** — Pydantic models:
   - `AnalysisRequest`: type, data, columns, config
   - `AnalysisResponse`: run_id, status, result
   - `DescriptiveResult`: per-column stats
   - `IsolationForestResult`: anomalies list, feature importance
   - `ClassificationResult`: accuracy, confusion matrix, feature importance

6. **`src/utils/csv_parser.py`** — Parse CSV string → pandas DataFrame:
   - Handle missing values
   - Detect numeric vs categorical columns
   - Return column metadata

7. **`src/services/descriptive.py`** — Descriptive statistics:
   - `describe(df)` → per-column: mean, median, std, min, max, quartiles, unique count
   - `correlate(df)` → correlation matrix for numeric columns

8. **`src/services/isolation_forest.py`** — Anomaly detection:
   - `detect_anomalies(df, config)` → list of anomalies with scores
   - Config: `contamination` (default 0.1), `n_estimators` (default 100)
   - Returns: `[{row_index, score, is_anomaly, contributing_features}]`

9. **`src/services/classification.py`** — Classification:
   - `classify(df, target_column, config)` → model results
   - Supported algorithms: `random_forest`, `xgboost`, `logistic_regression`
   - Returns: `{accuracy, precision, recall, f1, confusion_matrix, feature_importance}`

10. **`Dockerfile`**:
    ```dockerfile
    FROM python:3.12-slim
    WORKDIR /app
    COPY pyproject.toml .
    RUN pip install .
    COPY src/ src/
    CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
    ```

---

### Step 2: Docker Compose Integration

Edit `packages/twenty-docker/docker-compose.dev.yml`:

Add the analysis service:
```yaml
  analysis-service:
    build:
      context: ../packages/twenty-analysis-service
      dockerfile: Dockerfile
    ports:
      - '8000:8000'
    environment:
      - PYTHONUNBUFFERED=1
    networks:
      - twenty-network
```

---

### Step 3: Backend — NestJS Analysis Module

**Location**: `packages/twenty-server/src/modules/analysis/`

Follow the existing module patterns (see `modules/calendar/` or `modules/workflow/` for reference).

Files to create:

1. **`analysis.module.ts`** — NestJS module importing:
   - `AnalysisResolver`
   - `AnalysisService`
   - `AnalysisClientService`
   - `RunAnalysisJob`

2. **`analysis-client/analysis-client.service.ts`** — HTTP client:
   - Use NestJS `HttpService` (from `@nestjs/axios`)
   - Method: `async runAnalysis(type, data, columns, config): Promise<AnalysisResult>`
   - Calls `POST http://analysis-service:8000/analyze`
   - Timeout: 5 minutes
   - Error handling: wrap HTTP errors → throw typed exceptions

3. **`analysis.service.ts`** — Business logic:
   - `createAnalysis(input, workspaceId)`: Create Analysis entity, store CSV reference
   - `runAnalysis(analysisId)`: Read CSV file, parse to rows, call `AnalysisClientService`, store results
   - `getAnalysis(id)`: Return analysis with runs
   - `deleteAnalysis(id)`: Clean up

4. **`analysis.resolver.ts`** — GraphQL:
   - Use `@MetadataResolver()` decorator (see `file-upload.resolver.ts` for pattern)
   - Mutations: `createAnalysis`, `runAnalysis`, `deleteAnalysis`
   - Queries: `analyses`, `analysis`, `analysisRun`
   - Auth: `@UseGuards(WorkspaceAuthGuard)`

5. **`standard-objects/analysis.workspace-entity.ts`** — Define the Analysis standard object:
   - Use `@WorkspaceEntity` decorator
   - Fields: name, csvFileId, analysisType, targetColumn, config, status
   - Follow pattern in `company.workspace-entity.ts`

6. **`standard-objects/analysis-run.workspace-entity.ts`** — Define AnalysisRun standard object:
   - Fields: analysisId, status, startedAt, completedAt, result, errorMessage

7. **`jobs/run-analysis.job.ts`** — BullMQ worker:
   - `@Processor('analysis')`
   - `@Process('runAnalysis')`
   - Reads CSV, calls Python service, stores results

8. **`dtos/`** — Input/output DTOs following Twenty conventions

9. **Register the module** in `modules/modules.module.ts`:
   ```typescript
   imports: [
     // ... existing imports
     AnalysisModule,
   ],
   ```

10. **Generate migration**: After creating workspace entities, run:
    ```bash
    npx nx run twenty-server:database:migrate:generate --name AddAnalysisStandardObjects --type fast
    ```

---

### Step 4: Frontend — Analysis Tab & Pages

**Location**: `packages/twenty-front/src/modules/analysis/`

1. **Add the "Analysis" navigation tab**:
   
   Edit `packages/twenty-front/src/modules/ui/navigation/states/navigationDrawerTabs.ts`:
   ```typescript
   export const NAVIGATION_DRAWER_TABS = {
     NAVIGATION_MENU: 'home',
     AI_CHAT_HISTORY: 'chat',
     ANALYSIS: 'analysis',  // ← ADD THIS
   } as const;
   ```
   
   Edit `packages/twenty-front/src/modules/navigation/components/MainNavigationDrawerTabsRow.tsx`:
   - Add `IconChartBar` import from `twenty-ui/icon`
   - Add the analysis tab button alongside Home and Chat
   - Follow the existing pattern for `StyledTabWrapper` and `StyledTabIcon`

2. **GraphQL operations** (`analysis.graphql`):
   ```graphql
   mutation CreateAnalysis($input: CreateAnalysisInput!) { ... }
   mutation RunAnalysis($analysisId: ID!) { ... }
   query GetAnalyses { ... }
   query GetAnalysis($id: ID!) { ... }
   query GetAnalysisRun($id: ID!) { ... }
   ```

3. **Types** (`analysis.types.ts`):
   - TypeScript types matching the GraphQL schema
   - AnalysisType enum, AnalysisStatus enum

4. **States** (`states/analysisState.ts`):
   - Jotai atoms: `analysesState`, `selectedAnalysisState`, `analysisResultsState`

5. **Components**:
   - `AnalysisPage.tsx` — Main page (list of saved analyses + "New Analysis" button)
   - `AnalysisCreateWizard.tsx` — Multi-step creation wizard
   - `CsvUploadStep.tsx` — CSV upload (reuse existing file upload UI from twenty-ui)
   - `AnalysisConfigStep.tsx` — Type selection + parameter configuration
   - `AnalysisRunDetailPage.tsx` — Results view
   - `IsolationForestResults.tsx` — Anomalies table + scatter plot
   - `ClassificationResults.tsx` — Metrics + confusion matrix + feature importance
   - `DescriptiveResults.tsx` — Stats table + correlation heatmap

6. **Routing**:
   - Add routes in the app routing configuration:
     - `/analysis` → `AnalysisPage`
     - `/analysis/new` → `AnalysisCreateWizard`
     - `/analysis/:id` → `AnalysisRunDetailPage`

7. **Hooks**:
   - `useCreateAnalysis.ts` — wraps `createAnalysis` mutation
   - `useRunAnalysis.ts` — wraps `runAnalysis` mutation
   - `useAnalysisResults.ts` — polls/refetches until status is 'completed'

---

### Step 5: Testing & Verification

1. **Python service**: Run `pytest` from `packages/twenty-analysis-service/`
2. **Backend**: `npx nx test twenty-server` for analysis-specific tests
3. **Integration**: Upload a CSV, run each analysis type, verify results
4. **Edge cases**: Empty columns, non-numeric data, large files, cancelled runs

---

## Code Conventions (from CLAUDE.md)

- **Named exports only** (no default exports)
- **Types over interfaces** (except extending third-party)
- **String literals over enums** (except GraphQL enums)
- **No 'any' type** — strict TypeScript
- **Functional components only**
- **kebab-case** for files/directories with descriptive suffixes (`.component.tsx`, `.service.ts`, `.entity.ts`)
- **Import order**: external → `@/` → relative
- **Comments**: `//` short-form, explain WHY not WHAT
- **Components under 300 lines**, services under 500 lines
- **Props down, events up** — unidirectional data flow
- **Instance commands** for DB changes: `database:migrate:generate --name <name> --type fast`

---

## Environment Variables

Add to `.env`:
```
ANALYSIS_SERVICE_URL=http://analysis-service:8000
```

---

## File Checklist

### New files:
- [ ] `packages/twenty-analysis-service/pyproject.toml`
- [ ] `packages/twenty-analysis-service/Dockerfile`
- [ ] `packages/twenty-analysis-service/src/main.py`
- [ ] `packages/twenty-analysis-service/src/routers/health.py`
- [ ] `packages/twenty-analysis-service/src/routers/analysis.py`
- [ ] `packages/twenty-analysis-service/src/schemas/analysis.py`
- [ ] `packages/twenty-analysis-service/src/utils/csv_parser.py`
- [ ] `packages/twenty-analysis-service/src/services/descriptive.py`
- [ ] `packages/twenty-analysis-service/src/services/isolation_forest.py`
- [ ] `packages/twenty-analysis-service/src/services/classification.py`
- [ ] `packages/twenty-server/src/modules/analysis/analysis.module.ts`
- [ ] `packages/twenty-server/src/modules/analysis/analysis.resolver.ts`
- [ ] `packages/twenty-server/src/modules/analysis/analysis.service.ts`
- [ ] `packages/twenty-server/src/modules/analysis/analysis-client/analysis-client.service.ts`
- [ ] `packages/twenty-server/src/modules/analysis/standard-objects/analysis.workspace-entity.ts`
- [ ] `packages/twenty-server/src/modules/analysis/standard-objects/analysis-run.workspace-entity.ts`
- [ ] `packages/twenty-server/src/modules/analysis/jobs/run-analysis.job.ts`
- [ ] `packages/twenty-server/src/modules/analysis/dtos/create-analysis-input.dto.ts`
- [ ] `packages/twenty-front/src/modules/analysis/components/AnalysisPage.tsx`
- [ ] `packages/twenty-front/src/modules/analysis/components/AnalysisCreateWizard.tsx`
- [ ] `packages/twenty-front/src/modules/analysis/components/CsvUploadStep.tsx`
- [ ] `packages/twenty-front/src/modules/analysis/components/AnalysisConfigStep.tsx`
- [ ] `packages/twenty-front/src/modules/analysis/components/AnalysisRunDetailPage.tsx`
- [ ] `packages/twenty-front/src/modules/analysis/components/IsolationForestResults.tsx`
- [ ] `packages/twenty-front/src/modules/analysis/components/ClassificationResults.tsx`
- [ ] `packages/twenty-front/src/modules/analysis/components/DescriptiveResults.tsx`
- [ ] `packages/twenty-front/src/modules/analysis/hooks/useCreateAnalysis.ts`
- [ ] `packages/twenty-front/src/modules/analysis/hooks/useRunAnalysis.ts`
- [ ] `packages/twenty-front/src/modules/analysis/hooks/useAnalysisResults.ts`
- [ ] `packages/twenty-front/src/modules/analysis/states/analysisState.ts`
- [ ] `packages/twenty-front/src/modules/analysis/types/analysis.types.ts`
- [ ] `packages/twenty-front/src/modules/analysis/graphql/analysis.graphql`

### Modified files:
- [ ] `packages/twenty-docker/docker-compose.dev.yml` — add analysis-service
- [ ] `packages/twenty-server/src/modules/modules.module.ts` — import AnalysisModule
- [ ] `packages/twenty-front/src/modules/ui/navigation/states/navigationDrawerTabs.ts` — add ANALYSIS tab
- [ ] `packages/twenty-front/src/modules/navigation/components/MainNavigationDrawerTabsRow.tsx` — add tab button
