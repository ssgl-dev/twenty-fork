"""CSV parsing utilities — convert raw 2D array data to pandas DataFrame."""

import pandas as pd
import numpy as np

from src.schemas.analysis import ColumnStat


def parse_to_dataframe(data: list[list], columns: list[str]) -> pd.DataFrame:
    """Convert a 2D list with column names into a pandas DataFrame.

    Handles missing values (None, empty string, "NA", "null") by converting
    them to NaN.
    """
    df = pd.DataFrame(data, columns=columns)

    # Convert common missing value representations to NaN
    df.replace(["", "NA", "null", "None", "N/A", "n/a"], np.nan, inplace=True)
    df.replace([None], np.nan, inplace=True)

    # Attempt to coerce numeric columns
    for col in df.columns:
        try:
            df[col] = pd.to_numeric(df[col])
        except (ValueError, TypeError):
            pass  # Keep as-is if not coercible

    return df


def get_column_metadata(df: pd.DataFrame) -> list[ColumnStat]:
    """Return per-column metadata including dtype and basic stats."""

    stats: list[ColumnStat] = []

    for col in df.columns:
        series = df[col]
        numeric_series = pd.to_numeric(series, errors="coerce")
        is_numeric = not numeric_series.isna().all() and series.dropna().shape[0] > 0

        if is_numeric:
            stat = ColumnStat(
                column=str(col),
                dtype="numeric",
                count=int(series.notna().sum()),
                missing=int(series.isna().sum()),
                unique=int(series.nunique()),
                mean=float(numeric_series.mean()) if not numeric_series.isna().all() else None,
                median=float(numeric_series.median()) if not numeric_series.isna().all() else None,
                std=float(numeric_series.std()) if not numeric_series.isna().all() else None,
                min=float(numeric_series.min()) if not numeric_series.isna().all() else None,
                max=float(numeric_series.max()) if not numeric_series.isna().all() else None,
                q25=float(numeric_series.quantile(0.25)) if not numeric_series.isna().all() else None,
                q75=float(numeric_series.quantile(0.75)) if not numeric_series.isna().all() else None,
            )
        else:
            stat = ColumnStat(
                column=str(col),
                dtype="categorical",
                count=int(series.notna().sum()),
                missing=int(series.isna().sum()),
                unique=int(series.nunique()),
            )

        stats.append(stat)

    return stats


def get_numeric_columns(df: pd.DataFrame) -> list[str]:
    """Return list of column names that contain numeric data."""
    return [col for col in df.columns if pd.api.types.is_numeric_dtype(df[col])]


def get_categorical_columns(df: pd.DataFrame) -> list[str]:
    """Return list of column names that contain categorical (non-numeric) data."""
    return [col for col in df.columns if not pd.api.types.is_numeric_dtype(df[col])]
