"""Descriptive statistics service.

Computes per-column statistics and correlation matrices.
"""

import pandas as pd

from src.schemas.analysis import ColumnStat, CorrelationItem, DescriptiveResult
from src.utils.csv_parser import get_column_metadata, get_numeric_columns


def describe(df: pd.DataFrame) -> DescriptiveResult:
    """Compute per-column descriptive statistics."""
    column_stats = get_column_metadata(df)
    correlations = correlate(df)
    return DescriptiveResult(column_stats=column_stats, correlation_matrix=correlations)


def correlate(df: pd.DataFrame) -> list[CorrelationItem]:
    """Compute pairwise Pearson correlation for all numeric columns."""

    numeric_cols = get_numeric_columns(df)

    if len(numeric_cols) < 2:
        return []

    corr_matrix = df[numeric_cols].corr()
    items: list[CorrelationItem] = []

    for i, col_a in enumerate(numeric_cols):
        for j, col_b in enumerate(numeric_cols):
            if i < j:
                val = corr_matrix.loc[col_a, col_b]
                if not pd.isna(val):
                    items.append(
                        CorrelationItem(
                            column_a=col_a,
                            column_b=col_b,
                            correlation=round(float(val), 4),
                        )
                    )

    # Sort by absolute correlation descending
    items.sort(key=lambda x: abs(x.correlation), reverse=True)
    return items
