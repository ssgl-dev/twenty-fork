"""Analysis router — POST /analyze endpoint."""

import uuid
import traceback

from fastapi import APIRouter, HTTPException

from src.schemas.analysis import (
    AnalysisRequest,
    AnalysisResponse,
    AnalysisStatus,
    AnalysisType,
)
from src.services.descriptive import describe
from src.services.isolation_forest import detect_anomalies
from src.services.classification import classify
from src.utils.csv_parser import parse_to_dataframe

router = APIRouter(prefix="/analyze", tags=["analysis"])


@router.post("", response_model=AnalysisResponse)
async def run_analysis(request: AnalysisRequest) -> AnalysisResponse:
    """Run an analysis on the provided tabular data.

    Accepts a 2D array of data with column names and returns results based on
    the requested analysis type.
    """

    run_id = str(uuid.uuid4())

    try:
        # Parse input data to DataFrame
        df = parse_to_dataframe(request.data, request.columns)

        if df.empty or len(df.columns) == 0:
            raise ValueError("Input data is empty or has no columns.")

        # Dispatch to the correct analysis service
        if request.analysis_type == AnalysisType.DESCRIPTIVE:
            result = describe(df)
        elif request.analysis_type == AnalysisType.ISOLATION_FOREST:
            result = detect_anomalies(df, request.config)
        elif request.analysis_type == AnalysisType.CLASSIFICATION:
            if not request.target_column:
                raise ValueError(
                    "target_column is required for classification analysis."
                )
            result = classify(df, request.target_column, request.config)
        else:
            raise ValueError(f"Unknown analysis type: {request.analysis_type}")

        return AnalysisResponse(
            run_id=run_id,
            status=AnalysisStatus.COMPLETED,
            result=result,
        )

    except ValueError as e:
        return AnalysisResponse(
            run_id=run_id,
            status=AnalysisStatus.FAILED,
            error_message=str(e),
        )

    except Exception:
        return AnalysisResponse(
            run_id=run_id,
            status=AnalysisStatus.FAILED,
            error_message=traceback.format_exc(),
        )
