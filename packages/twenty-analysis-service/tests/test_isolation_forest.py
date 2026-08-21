"""Tests for the isolation forest service."""

import pytest

from src.utils.csv_parser import parse_to_dataframe
from src.schemas.analysis import AnalysisConfig
from src.services.isolation_forest import detect_anomalies


class TestIsolationForest:
    def test_detect_anomalies_basic(self):
        data = [
            [100, 25],
            [102, 27],
            [98, 23],
            [105, 26],
            [250, 80],  # clear anomaly
            [101, 25],
            [99, 24],
            [103, 26],
        ]
        columns = ["x", "y"]
        config = AnalysisConfig(contamination=0.1, n_estimators=100)

        df = parse_to_dataframe(data, columns)
        result = detect_anomalies(df, config)

        assert result.total_rows == 8
        assert result.anomaly_count >= 0  # Should detect at least the clear outlier
        assert len(result.anomalies) == 8

        # The anomaly should have a high score
        anomaly = result.anomalies[4]
        assert anomaly.is_anomaly

    def test_detect_anomalies_no_numeric(self):
        data = [["a"], ["b"], ["c"]]
        columns = ["cat"]
        config = AnalysisConfig()

        df = parse_to_dataframe(data, columns)
        result = detect_anomalies(df, config)

        assert result.total_rows == 3
        assert result.anomaly_count == 0
        assert len(result.anomalies) == 0

    def test_detect_anomalies_with_nan(self):
        data = [[1.0, 10.0], [2.0, None], [3.0, 30.0], [4.0, 40.0]]
        columns = ["a", "b"]
        config = AnalysisConfig(contamination=0.25)

        df = parse_to_dataframe(data, columns)
        result = detect_anomalies(df, config)

        assert result.total_rows == 4
        assert len(result.anomalies) == 4

    def test_detect_anomalies_with_max_samples(self):
        data = [
            [100, 25],
            [102, 27],
            [98, 23],
            [105, 26],
            [250, 80],  # clear anomaly
            [101, 25],
            [99, 24],
            [103, 26],
        ]
        columns = ["x", "y"]
        config = AnalysisConfig(
            contamination=0.1, n_estimators=100, max_samples=0.5
        )

        df = parse_to_dataframe(data, columns)
        result = detect_anomalies(df, config)

        assert result.total_rows == 8
        assert len(result.anomalies) == 8
        # The clear anomaly should still be flagged
        anomaly = result.anomalies[4]
        assert anomaly.is_anomaly
