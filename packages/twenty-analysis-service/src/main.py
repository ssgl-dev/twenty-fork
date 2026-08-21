"""Twenty Analysis Service — FastAPI entry point.

Provides ML/statistical analysis endpoints for the Twenty CRM.
"""

from fastapi import FastAPI

from src.routers import analysis, health

app = FastAPI(
    title="Twenty Analysis Service",
    description="ML and statistical analysis microservice for Twenty CRM",
    version="0.1.0",
)

app.include_router(health.router)
app.include_router(analysis.router)
