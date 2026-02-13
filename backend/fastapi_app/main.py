import os
from typing import Optional
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import RedirectResponse
from fastapi.middleware.cors import CORSMiddleware

from .salesforce import (
    create_salesforce_connection,
    exchange_code_for_token,
    force_refresh_oauth_token,
    get_oauth_authorize_url,
    oauth_session
)

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

app = FastAPI(title="Investigation Trend Backend (FastAPI)")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:4200",
        "http://127.0.0.1:4200",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "investigation-trend-backend-fastapi"
    }


@app.get("/api/salesforce/connect-test")
def salesforce_connect_test():
    try:
        sf = create_salesforce_connection()
        try:
            user = sf.query("SELECT Id, Username FROM User LIMIT 1")
            org = sf.query("SELECT Id, Name FROM Organization LIMIT 1")
        except Exception as query_exc:
            if "INVALID_SESSION_ID" not in str(query_exc):
                raise
            force_refresh_oauth_token()
            sf = create_salesforce_connection()
            user = sf.query("SELECT Id, Username FROM User LIMIT 1")
            org = sf.query("SELECT Id, Name FROM Organization LIMIT 1")

        return {
            "connected": True,
            "username": user["records"][0]["Username"] if user["records"] else None,
            "org": org["records"][0] if org["records"] else None
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.get("/auth/salesforce/login")
def salesforce_login():
    try:
        auth_url = get_oauth_authorize_url()
        return RedirectResponse(url=auth_url, status_code=302)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.get("/auth/salesforce/callback")
def salesforce_callback(code: str):
    try:
        token_data = exchange_code_for_token(code)
        return {
            "authenticated": True,
            "instance_url": token_data.get("instance_url"),
            "issued_at": token_data.get("issued_at"),
            "has_refresh_token": bool(token_data.get("refresh_token"))
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.get("/auth/salesforce/status")
def salesforce_auth_status():
    return {
        "authenticated": bool(
            oauth_session.get("access_token") and oauth_session.get("instance_url")
        ),
        "instance_url": oauth_session.get("instance_url"),
        "has_refresh_token": bool(oauth_session.get("refresh_token"))
    }


@app.get("/api/investigations/trends")
def investigation_trends(
    startDate: Optional[str] = Query(default=None),
    endDate: Optional[str] = Query(default=None),
    productArea: Optional[str] = Query(default=None)
):
    response = {
        "trends": {
            "productAreaVolume": [
                {"label": "Data Deploy", "value": 45},
                {"label": "Connect", "value": 30},
                {"label": "Compliance", "value": 15},
                {"label": "Other", "value": 10}
            ],
            "errorCodes": [
                {"code": "ERR-404", "count": 20},
                {"code": "TIMEOUT-500", "count": 15},
                {"code": "AUTH-401", "count": 10},
                {"code": "LIMIT-99", "count": 5},
                {"code": "NULL-REF", "count": 5}
            ]
        },
        "summary": (
            "High volume of timeouts in 'Connect' area suggests a recent infrastructure "
            "change. Primary driver appears to be API throttling."
        )
    }

    if startDate or endDate or productArea:
        response["filters"] = {
            "startDate": startDate,
            "endDate": endDate,
            "productArea": productArea
        }

    return response


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", "4000"))
    uvicorn.run("fastapi_app.main:app", host="0.0.0.0", port=port, reload=True)
