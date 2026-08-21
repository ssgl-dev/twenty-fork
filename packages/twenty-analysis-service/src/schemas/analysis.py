"""Pydantic models for analysis requests and responses."""

from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class AnalysisType(str, Enum):
    DESCRIPTIVE = "descriptive"
    ISOLATION_FOREST = "isolation_forest"
    CLASSIFICATION = "classification"


class AnalysisStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class AnalysisConfig(BaseModel):
    """Configuration for analysis algorithms."""

    contamination: float = Field(default=0.1, ge=0.0, le=0.5)
    n_estimators: int = Field(default=100, ge=10, le=1000)
    test_split: float = Field(default=0.2, ge=0.1, le=0.5)
    random_seed: int = Field(default=42)
    algorithm: str = Field(default="random_forest")

    # LightGBM-specific tunable parameters
    learning_rate: float = Field(default=0.1, gt=0.0, le=1.0)
    max_depth: int | None = Field(default=None, ge=1, le=128)
    num_leaves: int = Field(default=31, ge=2, le=512)
    min_child_samples: int = Field(default=20, ge=1, le=1000)
    subsample: float = Field(default=1.0, gt=0.0, le=1.0)
    colsample_bytree: float = Field(default=1.0, gt=0.0, le=1.0)

    # Isolation Forest-specific tunable parameters
    max_samples: float | None = Field(default=None, gt=0.0, le=1.0)


class AnalysisRequest(BaseModel):
    """Request body for POST /analyze."""

    analysis_type: AnalysisType
    data: list[list[Any]]
    columns: list[str]
    target_column: str | None = None
    config: AnalysisConfig = Field(default_factory=AnalysisConfig)


class ColumnStat(BaseModel):
    """Descriptive statistics for a single column."""

    column: str
    dtype: str
    count: int
    missing: int
    unique: int
    mean: float | None = None
    median: float | None = None
    std: float | None = None
    min: float | None = None
    max: float | None = None
    q25: float | None = None
    q75: float | None = None


class CorrelationItem(BaseModel):
    """A single correlation pair result."""

    column_a: str
    column_b: str
    correlation: float


class DescriptiveResult(BaseModel):
    """Result of descriptive analysis."""

    column_stats: list[ColumnStat]
    correlation_matrix: list[CorrelationItem]


class AnomalyItem(BaseModel):
    """A single anomaly detection result."""

    row_index: int
    score: float
    is_anomaly: bool
    contributing_features: dict[str, float]


class IsolationForestResult(BaseModel):
    """Result of isolation forest anomaly detection."""

    anomalies: list[AnomalyItem]
    total_rows: int
    anomaly_count: int
    contamination: float
    feature_importance: dict[str, float]


class ClassificationResult(BaseModel):
    """Result of classification analysis."""

    accuracy: float
    precision: float
    recall: float
    f1: float
    confusion_matrix: list[list[int]]
    feature_importance: dict[str, float]
    algorithm: str
    target_column: str


class AnalysisResponse(BaseModel):
    """Response from POST /analyze."""

    run_id: str
    status: AnalysisStatus
    result: DescriptiveResult | IsolationForestResult | ClassificationResult | None = None
    error_message: str | None = None
