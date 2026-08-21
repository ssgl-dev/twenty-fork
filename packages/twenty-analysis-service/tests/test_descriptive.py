"""Tests for the descriptive statistics service."""

import pytest

from src.utils.csv_parser import parse_to_dataframe
from src.services.descriptive import describe, correlate


class TestDescriptive:
    def test_describe_returns_stats(self):
        data = [[1.0, 10.0], [2.0, 20.0], [3.0, 30.0]]
        columns = ["a", "b"]

        df = parse_to_dataframe(data, columns)
        result = describe(df)

        assert len(result.column_stats) == 2
        assert result.column_stats[0].mean == 2.0
        assert result.column_stats[1].mean == 20.0

    def test_correlate_perfect_positive(self):
        data = [[1.0, 2.0], [2.0, 4.0], [3.0, 6.0]]
        columns = ["x", "y"]

        df = parse_to_dataframe(data, columns)
        corrs = correlate(df)

        assert len(corrs) == 1
        assert corrs[0].column_a == "x"
        assert corrs[0].column_b == "y"
        assert abs(corrs[0].correlation - 1.0) < 0.001

    def test_correlate_empty_numeric(self):
        data = [["a", "x"], ["b", "y"]]
        columns = ["c1", "c2"]

        df = parse_to_dataframe(data, columns)
        corrs = correlate(df)

        assert len(corrs) == 0
