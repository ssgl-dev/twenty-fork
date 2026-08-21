"""Tests for the CSV parser utility."""

import pytest

from src.utils.csv_parser import (
    parse_to_dataframe,
    get_column_metadata,
    get_numeric_columns,
    get_categorical_columns,
)


class TestCsvParser:
    def test_parse_simple_data(self):
        data = [[1, "a"], [2, "b"], [3, "c"]]
        columns = ["num", "letter"]

        df = parse_to_dataframe(data, columns)

        assert df.shape == (3, 2)
        assert list(df.columns) == ["num", "letter"]

    def test_parse_with_missing_values(self):
        data = [[1, ""], [None, "b"], [3, "NA"]]
        columns = ["x", "y"]

        df = parse_to_dataframe(data, columns)

        assert df["x"].isna().sum() == 1  # None → NaN
        assert df["y"].isna().sum() == 2  # "" and "NA" → NaN

    def test_get_column_metadata_numeric(self):
        data = [[1.0], [2.0], [3.0]]
        columns = ["value"]

        df = parse_to_dataframe(data, columns)
        stats = get_column_metadata(df)

        assert len(stats) == 1
        assert stats[0].dtype == "numeric"
        assert stats[0].count == 3
        assert stats[0].mean == 2.0

    def test_get_column_metadata_categorical(self):
        data = [["red"], ["blue"], ["red"]]
        columns = ["color"]

        df = parse_to_dataframe(data, columns)
        stats = get_column_metadata(df)

        assert len(stats) == 1
        assert stats[0].dtype == "categorical"
        assert stats[0].unique == 2

    def test_numeric_vs_categorical_columns(self):
        data = [[1, "cat", 2.5], [2, "dog", 1.0]]
        columns = ["num1", "str_col", "num2"]

        df = parse_to_dataframe(data, columns)

        numeric = get_numeric_columns(df)
        categorical = get_categorical_columns(df)

        assert "num1" in numeric
        assert "num2" in numeric
        assert "str_col" in categorical
