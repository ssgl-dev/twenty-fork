"""Classification service.

Supports LightGBM, Random Forest, and Logistic Regression classifiers.
"""

import pandas as pd
import numpy as np
from lightgbm import LGBMClassifier
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    confusion_matrix,
)
from sklearn.preprocessing import LabelEncoder, StandardScaler

from src.schemas.analysis import AnalysisConfig, ClassificationResult
from src.utils.csv_parser import get_numeric_columns


_ALGORITHM_MAP = {
    "lightgbm": LGBMClassifier,
    "random_forest": RandomForestClassifier,
    "logistic_regression": LogisticRegression,
}


def classify(
    df: pd.DataFrame, target_column: str, config: AnalysisConfig
) -> ClassificationResult:
    """Run classification on the DataFrame with the given target column."""

    if target_column not in df.columns:
        raise ValueError(f"Target column '{target_column}' not found in data.")

    # Separate features and target
    y_raw = df[target_column].copy()
    X = df.drop(columns=[target_column])

    # Handle missing values in features
    X = X.fillna(X.mean(numeric_only=True)).fillna("missing")

    # Encode categorical feature columns
    for col in X.columns:
        if not pd.api.types.is_numeric_dtype(X[col]):
            X[col] = LabelEncoder().fit_transform(X[col].astype(str))

    # Encode target if categorical
    if not pd.api.types.is_numeric_dtype(y_raw):
        target_encoder = LabelEncoder()
        y = target_encoder.fit_transform(y_raw.astype(str))
    else:
        y = y_raw.values

    # Remove rows where target is NaN
    valid_mask = ~pd.isna(y)
    X = X[valid_mask]
    y = y[valid_mask]

    if len(X) < 10:
        raise ValueError("Not enough valid rows for classification (minimum 10).")

    # Train/test split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=config.test_split, random_state=config.random_seed
    )

    # Scale features
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    # Select and train model
    model_cls = _ALGORITHM_MAP.get(config.algorithm, RandomForestClassifier)

    if config.algorithm == "lightgbm":
        model = model_cls(
            n_estimators=config.n_estimators,
            learning_rate=config.learning_rate,
            max_depth=config.max_depth,
            num_leaves=config.num_leaves,
            min_child_samples=config.min_child_samples,
            subsample=config.subsample,
            colsample_bytree=config.colsample_bytree,
            random_state=config.random_seed,
            n_jobs=-1,
            verbose=-1,
        )
    elif config.algorithm == "logistic_regression":
        model = model_cls(max_iter=1000, random_state=config.random_seed)
    else:
        model = model_cls(
            n_estimators=config.n_estimators, random_state=config.random_seed, n_jobs=-1
        )

    model.fit(X_train_scaled, y_train)
    y_pred = model.predict(X_test_scaled)

    # Compute metrics
    accuracy = round(float(accuracy_score(y_test, y_pred)), 4)
    # Use weighted average for multi-class
    precision = round(float(precision_score(y_test, y_pred, average="weighted", zero_division=0)), 4)
    recall = round(float(recall_score(y_test, y_pred, average="weighted", zero_division=0)), 4)
    f1 = round(float(f1_score(y_test, y_pred, average="weighted", zero_division=0)), 4)

    # Confusion matrix
    cm = confusion_matrix(y_test, y_pred)
    cm_list = cm.tolist()

    # Feature importance
    if hasattr(model, "feature_importances_"):
        importance = dict(
            zip(X.columns, [round(float(v), 4) for v in model.feature_importances_])
        )
    elif hasattr(model, "coef_"):
        # For logistic regression, use absolute coefficient values
        if len(model.coef_.shape) == 1:
            coef = np.abs(model.coef_)
        else:
            coef = np.abs(model.coef_).mean(axis=0)
        importance = dict(
            zip(X.columns, [round(float(v), 4) for v in coef])
        )
    else:
        importance = {}

    # Sort importance by value descending
    importance = dict(
        sorted(importance.items(), key=lambda x: x[1], reverse=True)
    )

    return ClassificationResult(
        accuracy=accuracy,
        precision=precision,
        recall=recall,
        f1=f1,
        confusion_matrix=cm_list,
        feature_importance=importance,
        algorithm=config.algorithm,
        target_column=target_column,
    )
