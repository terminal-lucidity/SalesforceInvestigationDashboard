import os
from typing import Optional
from pathlib import Path
from datetime import date, timedelta

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
    def parse_date(value: Optional[str], field_name: str) -> Optional[date]:
        if not value:
            return None
        try:
            return date.fromisoformat(value)
        except ValueError as exc:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid {field_name}. Expected YYYY-MM-DD."
            ) from exc

    start_dt = parse_date(startDate, "startDate")
    end_dt = parse_date(endDate, "endDate")
    if start_dt and end_dt and start_dt > end_dt:
        raise HTTPException(status_code=400, detail="startDate cannot be after endDate.")

    def normalize_value(value: object, default: str) -> str:
        text = str(value).strip() if value is not None else ""
        return text if text else default

    try:
        sf = create_salesforce_connection()
    except Exception:
        return {
            "trends": {
                "productAreaVolume": [],
                "errorCodes": []
            },
            "summary": (
                "Salesforce is not connected. Authenticate via /auth/salesforce/login "
                "to retrieve live investigation trends."
            ),
            "filters": {
                "startDate": startDate,
                "endDate": endDate,
                "productArea": productArea
            }
        }

    field_candidates = {
        "product": ["Product_Area__c", "ProductArea__c", "Product__c", "Type", "Origin"],
        "error": ["Error_Code__c", "ErrorCode__c", "Error__c", "Reason", "Status"]
    }
    describe = sf.Case.describe()
    available_fields = {field["name"] for field in describe.get("fields", [])}

    product_field = next((f for f in field_candidates["product"] if f in available_fields), None)
    error_field = next((f for f in field_candidates["error"] if f in available_fields), None)

    selected_fields = ["CreatedDate"]
    if product_field:
        selected_fields.append(product_field)
    if error_field:
        selected_fields.append(error_field)

    where_clauses = []
    if start_dt:
        where_clauses.append(f"CreatedDate >= {start_dt.isoformat()}T00:00:00Z")
    if end_dt:
        next_day = end_dt + timedelta(days=1)
        where_clauses.append(f"CreatedDate < {next_day.isoformat()}T00:00:00Z")

    soql = f"SELECT {', '.join(selected_fields)} FROM Case"
    if where_clauses:
        soql += " WHERE " + " AND ".join(where_clauses)
    soql += " LIMIT 5000"

    try:
        records = sf.query_all(soql).get("records", [])
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to query Salesforce Case data: {exc}") from exc

    product_counts: dict[str, int] = {}
    error_counts: dict[str, int] = {}

    for record in records:
        if product_field:
            area = normalize_value(record.get(product_field), "Other")
        else:
            area = "Other"
        if productArea and area.lower() != productArea.lower():
            continue

        if error_field:
            error_code = normalize_value(record.get(error_field), "UNKNOWN")
        else:
            error_code = "UNKNOWN"

        product_counts[area] = product_counts.get(area, 0) + 1
        error_counts[error_code] = error_counts.get(error_code, 0) + 1

    product_area_volume = [
        {"label": label, "value": count}
        for label, count in sorted(product_counts.items(), key=lambda item: item[1], reverse=True)
    ]
    error_codes = [
        {"code": code, "count": count}
        for code, count in sorted(error_counts.items(), key=lambda item: item[1], reverse=True)[:5]
    ]

    if product_area_volume:
        top_area = product_area_volume[0]
        top_error = error_codes[0] if error_codes else {"code": "UNKNOWN", "count": 0}
        summary = (
            f"Top volume area is '{top_area['label']}' with {top_area['value']} investigations. "
            f"Most frequent error is {top_error['code']} ({top_error['count']} cases)."
        )
    else:
        summary = "No investigations found for the selected filters."

    response = {
        "trends": {
            "productAreaVolume": product_area_volume,
            "errorCodes": error_codes
        },
        "summary": summary
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
