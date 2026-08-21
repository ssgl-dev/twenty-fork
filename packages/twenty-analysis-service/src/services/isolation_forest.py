"""Isolation Forest anomaly detection service."""

import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler

from src.schemas.analysis import AnomalyItem, AnalysisConfig, IsolationForestResult
from src.utils.csv_parser import get_numeric_columns


def detect_anomalies(df: pd.DataFrame, config: AnalysisConfig) -> IsolationForestResult:
    """Run Isolation Forest anomaly detection on the numeric columns of a DataFrame.

    Returns anomalies with scores and contributing feature information.
    """

    numeric_cols = get_numeric_columns(df)

    if not numeric_cols:
        return IsolationForestResult(
            anomalies=[],
            total_rows=len(df),
            anomaly_count=0,
            contamination=config.contamination,
            feature_importance={},
        )

    # Select numeric data and handle remaining NaN with column means
    numeric_data = df[numeric_cols].copy()
    numeric_data = numeric_data.fillna(numeric_data.mean()).fillna(0)

    # Standardize features for better anomaly detection
    scaler = StandardScaler()
    scaled_data = scaler.fit_transform(numeric_data)

    # Fit Isolation Forest
    iforest_kwargs: dict = {
        "contamination": config.contamination,
        "n_estimators": config.n_estimators,
        "random_state": config.random_seed,
        "n_jobs": -1,
    }
    if config.max_samples is not None:
        iforest_kwargs["max_samples"] = config.max_samples
    model = IsolationForest(**iforest_kwargs)

    # Predict: -1 for anomaly, 1 for normal
    predictions = model.fit_predict(scaled_data)

    # Get anomaly scores (lower = more anomalous)
    scores = model.score_samples(scaled_data)
    # Normalize scores to 0-1 range where 1 = most anomalous
    min_score = scores.min()
    max_score = scores.max()
    if max_score > min_score:
        normalized_scores = 1.0 - (scores - min_score) / (max_score - min_score)
    else:
        normalized_scores = scores * 0

    # Compute feature importance based on how much each feature contributes
    # to the anomaly score for anomalous points
    feature_importance = _compute_feature_importance(
        numeric_data, scaled_data, predictions, numeric_cols
    )

    # Build anomaly items
    anomalies: list[AnomalyItem] = []
    for idx in range(len(df)):
        is_anomaly = bool(predictions[idx] == -1)
        score = round(float(normalized_scores[idx]), 4)

        # Only include detailed contributing features for anomalies
        contributing = {}
        if is_anomaly:
            # Feature deviation from mean (z-score style) for this row
            row_scaled = scaled_data[idx]
            for j, col in enumerate(numeric_cols):
                contributing[col] = round(float(abs(row_scaled[j])), 4)

        anomalies.append(
            AnomalyItem(
                row_index=idx,
                score=score,
                is_anomaly=is_anomaly,
                contributing_features=contributing,
            )
        )

    anomaly_count = sum(1 for a in anomalies if a.is_anomaly)

    return IsolationForestResult(
        anomalies=anomalies,
        total_rows=len(df),
        anomaly_count=anomaly_count,
        contamination=config.contamination,
        feature_importance=feature_importance,
    )


def _compute_feature_importance(
    numeric_data: pd.DataFrame,
    scaled_data: "np.ndarray",
    predictions: "np.ndarray",
    numeric_cols: list[str],
) -> dict[str, float]:
    """Compute rough feature importance by comparing variance of anomalies vs normal."""

    import numpy as np

    anomaly_mask = predictions == -1
    normal_mask = predictions == 1

    importance: dict[str, float] = {}

    if anomaly_mask.sum() == 0 or normal_mask.sum() == 0:
        return {col: 0.0 for col in numeric_cols}

    for j, col in enumerate(numeric_cols):
        anomaly_std = float(np.std(scaled_data[anomaly_mask, j]))
        normal_std = float(np.std(scaled_data[normal_mask, j]))
        # Higher ratio means feature varies more in anomalies
        ratio = anomaly_std / (normal_std + 1e-8)
        importance[col] = round(min(ratio, 10.0), 4)

    return importance
