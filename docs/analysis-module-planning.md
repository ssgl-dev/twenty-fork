# Analysis Module — Critical Planning Document

## 1. Overview

Add a new **"Analysis"** tab to the Twenty workspace that lets users:
- Upload CSV files
- Run **Isolation Forest** (anomaly detection)
- Run **Classification** ML algorithms (Random Forest, XGBoost, Logistic Regression)
- Run **Deterministic analysis** (descriptive stats, correlation matrices, distribution plots)

---

## 2. Architecture Decision: Python Microservice

**Why Python**: Twenty's backend (NestJS/TypeScript/Node.js) has no mature ML ecosystem. Python has scikit-learn, pandas, numpy, etc.

**Approach**: A lightweight Python **FastAPI** microservice that the NestJS backend calls via HTTP.

```
┌──────────────┐     HTTP/REST     ┌──────────────────┐
│  Twenty       │ ◄──────────────► │  Python Analysis  │
│  NestJS       │                  │  FastAPI Service  │
│  Backend      │                  │  (scikit-learn,   │
│               │                  │   pandas, numpy)  │
└──────┬───────┘                  └──────────────────┘
       │
       │ Stores results,
       │ metadata, file refs
       ▼
┌──────────────┐
│  PostgreSQL   │
└──────────────┘
```

### Why this approach:
| Approach | Pros | Cons | Verdict |
|---|---|---|---|
| **Python microservice** | Full ML ecosystem, simple API, scalable | Extra service to deploy | ✅ Best |
| TensorFlow.js (browser) | No backend changes | Limited to small datasets, slow | ❌ Not for production |
| TensorFlow.js (Node) | No Python dependency | Limited algorithm support | ❌ Too limiting |
| Python sidecar | Simple local dev | Hard to scale, fragile | ❌ Only for dev |

---

## 3. System Architecture

### 3.1 New Python Service (`packages/twenty-analysis-service/`)

```
packages/twenty-analysis-service/
├── pyproject.toml              # Python deps (fastapi, sklearn, pandas, uvicorn)
├── Dockerfile                  # Container for deployment
├── src/
│   ├── main.py                 # FastAPI app entry point
│   ├── routers/
│   │   ├── analysis.py         # POST /analyze, GET /analysis/:id
│   │   └── health.py           # GET /health
│   ├── services/
│   │   ├── isolation_forest.py # Anomaly detection
│   │   ├── classification.py   # Random Forest, XGBoost, Logistic Regression
│   │   └── descriptive.py      # Descriptive stats, correlations
│   ├── schemas/
│   │   ├── analysis.py         # Pydantic request/response models
│   │   └── csv_metadata.py     # CSV parsing & validation
│   └── utils/
│       ├── csv_parser.py       # CSV → pandas DataFrame
│       └── result_formatter.py # ML output → JSON API response
└── tests/
    └── test_services/
```

### 3.2 NestJS Backend Changes

Add modules under `packages/twenty-server/src/modules/analysis/`:

```
packages/twenty-server/src/modules/analysis/
├── analysis.module.ts
├── analysis.resolver.ts        # GraphQL mutations & queries
├── analysis.service.ts         # Orchestrates calls to Python service
├── analysis-client/
│   └── analysis-client.service.ts  # HTTP client to Python service
├── standard-objects/
│   └── analysis.workspace-entity.ts # "Analysis" standard object
│   └── analysis-run.workspace-entity.ts # Individual analysis runs
├── dtos/
│   ├── create-analysis-input.dto.ts
│   └── analysis-result.dto.ts
└── jobs/
    └── run-analysis.job.ts     # BullMQ worker for async analysis
```

### 3.3 Database Schema

Two new standard objects (workspace entities):

**Analysis** (the configuration/template):
| Field | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| name | TEXT | User-given name |
| csvFileId | UUID | Reference to uploaded CSV file |
| analysisType | ENUM | 'isolation_forest', 'classification', 'descriptive' |
| targetColumn | TEXT | For classification: which column to predict |
| config | JSONB | Algorithm parameters (contamination, n_estimators, etc.) |
| status | ENUM | 'pending', 'running', 'completed', 'failed' |

**AnalysisRun** (each execution):
| Field | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| analysisId | UUID | FK → Analysis |
| startedAt | TIMESTAMP | |
| completedAt | TIMESTAMP | |
| status | ENUM | 'running', 'completed', 'failed' |
| result | JSONB | Results (anomalies, feature importance, stats) |
| errorMessage | TEXT | If failed |

### 3.4 Frontend Changes

New tab + pages under `packages/twenty-front/src/modules/analysis/`:

```
packages/twenty-front/src/modules/analysis/
├── components/
│   ├── AnalysisPage.tsx              # Main analysis list page
│   ├── AnalysisCreatePage.tsx        # New analysis wizard
│   ├── AnalysisRunDetailPage.tsx     # Results view
│   ├── CsvUploadStep.tsx             # CSV upload step
│   ├── AnalysisConfigStep.tsx        # Algorithm selection & params
│   ├── IsolationForestResults.tsx    # Anomaly visualization
│   ├── ClassificationResults.tsx     # Confusion matrix, feature importance
│   └── DescriptiveResults.tsx        # Stats tables, correlation heatmap
├── hooks/
│   ├── useCreateAnalysis.ts
│   ├── useRunAnalysis.ts
│   └── useAnalysisResults.ts
├── states/
│   └── analysisState.ts              # Jotai atoms
├── types/
│   └── analysis.types.ts
└── graphql/
    └── analysis.graphql              # GraphQL operations
```

---

## 4. User Flow

```
1. User clicks "Analysis" tab in sidebar
2. Sees list of saved analyses (or empty state)
3. Clicks "+ New Analysis"
4. Wizard Step 1: Upload CSV (drag & drop, using existing FileUpload)
5. Wizard Step 2: Select analysis type:
   ┌──────────────────────────────────────────────┐
   │ 📊 Descriptive Analysis                       │
   │   - Column summaries, correlations, histograms │
   │                                                │
   │ 🔍 Isolation Forest (Anomaly Detection)        │
   │   - Detect outliers in data                    │
   │   - Config: contamination rate, n_estimators   │
   │                                                │
   │ 🏷️  Classification                              │
   │   - Predict a target column                    │
   │   - Algorithms: Random Forest, XGBoost, LR     │
   │   - Config: test split, target column          │
   └──────────────────────────────────────────────┘
6. Wizard Step 3: Configure parameters
7. Click "Run Analysis"
8. Wait for results (polling / WebSocket for status)
9. View results with visualizations
```

---

## 5. API Design

### 5.1 GraphQL (NestJS → Frontend)

```graphql
type Analysis {
  id: ID!
  name: String!
  csvFileId: String!
  analysisType: AnalysisType!
  targetColumn: String
  config: JSON
  status: AnalysisStatus!
  createdAt: DateTime!
  runs: [AnalysisRun!]!
}

type AnalysisRun {
  id: ID!
  analysisId: ID!
  status: RunStatus!
  startedAt: DateTime!
  completedAt: DateTime
  result: JSON
  errorMessage: String
}

enum AnalysisType {
  DESCRIPTIVE
  ISOLATION_FOREST
  CLASSIFICATION
}

# Mutations
createAnalysis(input: CreateAnalysisInput!): Analysis!
runAnalysis(analysisId: ID!): AnalysisRun!
deleteAnalysis(id: ID!): Boolean!

# Queries
analyses: [Analysis!]!
analysis(id: ID!): Analysis!
analysisRun(id: ID!): AnalysisRun!
```

### 5.2 REST (NestJS → Python Service)

```
POST /analyze
{
  "analysis_type": "isolation_forest",
  "data": [[...], [...], ...],          # Parsed CSV rows
  "columns": ["col1", "col2", ...],
  "config": {
    "contamination": 0.1,
    "n_estimators": 100
  }
}
→
{
  "run_id": "uuid",
  "status": "completed",
  "result": {
    "anomalies": [{"row_index": 5, "score": -0.85, "is_anomaly": true}, ...],
    "feature_importance": {"col1": 0.3, "col2": 0.7}
  }
}
```

---

## 6. Implementation Phases

### Phase 1: Foundation (3-5 days)
- [ ] Create `packages/twenty-analysis-service/` Python FastAPI project
- [ ] Implement CSV parsing & validation
- [ ] Implement descriptive statistics (basic)
- [ ] Dockerize the Python service
- [ ] Add to `docker-compose.dev.yml`

### Phase 2: Backend Integration (2-3 days)
- [ ] Create NestJS `analysis` module
- [ ] Create `AnalysisClientService` (HTTP to Python)
- [ ] Create GraphQL resolver
- [ ] Create `Analysis` and `AnalysisRun` standard objects
- [ ] Add BullMQ worker for async analysis runs
- [ ] Write database migration (instance command)

### Phase 3: ML Algorithms (3-4 days)
- [ ] Implement Isolation Forest in Python service
- [ ] Implement Classification (Random Forest, XGBoost, Logistic Regression)
- [ ] Implement correlation analysis
- [ ] Add algorithm-specific response schemas
- [ ] Error handling & edge cases (empty columns, non-numeric data, etc.)

### Phase 4: Frontend (3-5 days)
- [ ] Add "Analysis" tab to `NAVIGATION_DRAWER_TABS`
- [ ] Create analysis list page
- [ ] Create CSV upload wizard step (reuse existing FileUpload)
- [ ] Create analysis configuration step
- [ ] Create results visualization components
- [ ] Wire up GraphQL hooks

### Phase 5: Polish (2-3 days)
- [ ] Loading & error states
- [ ] Export results as CSV
- [ ] Progress indicators for long-running analyses
- [ ] Integration tests
- [ ] Documentation

---

## 7. Key Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Large CSV files (100MB+) crash Python service | Stream CSV parsing, chunked processing, file size limits |
| Python service auth/security | Internal-only service, not exposed externally; use shared secret between NestJS and Python |
| ML computation is slow | Run asynchronously via BullMQ; show progress; timeout after N minutes |
| Deployment complexity | Docker Compose for dev; same Dockerfile for prod; add to Helm charts |
| Cold start of Python service | Keep service always running; health checks; auto-restart |

---

## 8. Key Files to Touch

### Existing files to modify:
| File | Change |
|---|---|
| `twenty-front/.../navigationDrawerTabs.ts` | Add `ANALYSIS: 'analysis'` tab |
| `twenty-front/.../MainNavigationDrawerTabsRow.tsx` | Add Analysis tab icon + label |
| `twenty-server/src/modules/modules.module.ts` | Import AnalysisModule |
| `docker-compose.dev.yml` | Add `analysis-service` container |

### New files to create:
| File | Purpose |
|---|---|
| `packages/twenty-analysis-service/` | Entire Python microservice |
| `twenty-server/src/modules/analysis/` | NestJS module |
| `twenty-front/src/modules/analysis/` | Frontend module |
