"""Tests for the classification service."""

import pytest

from src.utils.csv_parser import parse_to_dataframe
from src.schemas.analysis import AnalysisConfig
from src.services.classification import classify


class TestClassification:
    def test_classify_basic(self):
        data = [
            [5.1, 3.5, 1.4, 0.2, "setosa"],
            [4.9, 3.0, 1.4, 0.2, "setosa"],
            [7.0, 3.2, 4.7, 1.4, "versicolor"],
            [6.4, 3.2, 4.5, 1.5, "versicolor"],
            [6.3, 3.3, 6.0, 2.5, "virginica"],
            [5.8, 2.7, 5.1, 1.9, "virginica"],
            [5.4, 3.9, 1.7, 0.4, "setosa"],
            [6.9, 3.1, 4.9, 1.5, "versicolor"],
            [7.1, 3.0, 5.9, 2.1, "virginica"],
            [5.0, 3.4, 1.5, 0.2, "setosa"],
        ]
        columns = [
            "sepal_length",
            "sepal_width",
            "petal_length",
            "petal_width",
            "species",
        ]
        config = AnalysisConfig(
            test_split=0.3, n_estimators=50, algorithm="random_forest"
        )

        df = parse_to_dataframe(data, columns)
        result = classify(df, "species", config)

        assert result.accuracy > 0.0
        assert result.precision > 0.0
        assert result.recall > 0.0
        assert result.f1 > 0.0
        assert len(result.confusion_matrix) > 0
        assert len(result.feature_importance) > 0

    def test_classify_missing_target(self):
        data = [[1.0, "a"], [2.0, "b"]]
        columns = ["x", "y"]
        config = AnalysisConfig()

        df = parse_to_dataframe(data, columns)

        with pytest.raises(ValueError, match="Target column"):
            classify(df, "nonexistent", config)

    def test_classify_logistic_regression(self):
        data = [
            [1.0, 2.0, 0],
            [2.0, 3.0, 0],
            [3.0, 4.0, 0],
            [1.5, 2.5, 0],
            [2.5, 3.5, 0],
            [8.0, 9.0, 1],
            [9.0, 10.0, 1],
            [10.0, 11.0, 1],
            [8.5, 9.5, 1],
            [9.5, 10.5, 1],
            [11.0, 12.0, 1],
            [12.0, 13.0, 1],
        ]
        columns = ["f1", "f2", "label"]
        config = AnalysisConfig(
            test_split=0.3, algorithm="logistic_regression"
        )

        df = parse_to_dataframe(data, columns)
        result = classify(df, "label", config)

        assert result.accuracy > 0.0
        assert result.algorithm == "logistic_regression"

    def test_classify_lightgbm(self):
        data = [
            [1.0, 2.0, 0],
            [2.0, 3.0, 0],
            [3.0, 4.0, 0],
            [1.5, 2.5, 0],
            [2.5, 3.5, 0],
            [8.0, 9.0, 1],
            [9.0, 10.0, 1],
            [10.0, 11.0, 1],
            [8.5, 9.5, 1],
            [9.5, 10.5, 1],
            [11.0, 12.0, 1],
            [12.0, 13.0, 1],
            [13.0, 14.0, 1],
            [7.5, 8.5, 1],
            [3.5, 4.5, 0],
            [4.5, 5.5, 0],
        ]
        columns = ["f1", "f2", "label"]
        config = AnalysisConfig(
            test_split=0.3,
            n_estimators=50,
            algorithm="lightgbm",
            learning_rate=0.1,
            num_leaves=8,
            min_child_samples=5,
        )

        df = parse_to_dataframe(data, columns)
        result = classify(df, "label", config)

        assert result.accuracy > 0.0
        assert result.algorithm == "lightgbm"
        assert len(result.feature_importance) > 0

    def test_classify_lightgbm_categorical_features(self):
        # LightGBM should handle mixed numeric + categorical features
        data = [
            ["A", 1.0, 0],
            ["A", 2.0, 0],
            ["B", 3.0, 0],
            ["B", 4.0, 0],
            ["A", 5.0, 1],
            ["B", 6.0, 1],
            ["A", 7.0, 1],
            ["B", 8.0, 1],
            ["A", 2.5, 0],
            ["B", 3.5, 0],
            ["A", 6.5, 1],
            ["B", 7.5, 1],
        ]
        columns = ["cat", "num", "label"]
        config = AnalysisConfig(
            test_split=0.3,
            n_estimators=50,
            algorithm="lightgbm",
        )

        df = parse_to_dataframe(data, columns)
        result = classify(df, "label", config)

        assert result.accuracy > 0.0
        assert result.algorithm == "lightgbm"
