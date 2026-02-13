import os
import urllib.parse
import urllib.request
import json
from pathlib import Path
from typing import Dict, Optional

from simple_salesforce import Salesforce


def _required_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise ValueError(f"Missing Salesforce env var: {name}")
    return value


oauth_session: Dict[str, Optional[str]] = {
    "access_token": None,
    "instance_url": None,
    "refresh_token": None,
    "issued_at": None
}


def get_login_url() -> str:
    return os.getenv("SF_LOGIN_URL", "https://login.salesforce.com")


def _token_store_path() -> Path:
    configured = os.getenv("SF_TOKEN_STORE_PATH")
    if configured:
        return Path(configured)
    return Path(__file__).resolve().parent.parent / ".sf_oauth_tokens.json"


def _load_token_store() -> None:
    path = _token_store_path()
    if not path.exists():
        return
    try:
        data = json.loads(path.read_text())
        oauth_session["access_token"] = data.get("access_token")
        oauth_session["instance_url"] = data.get("instance_url")
        oauth_session["refresh_token"] = data.get("refresh_token")
        oauth_session["issued_at"] = data.get("issued_at")
    except Exception:
        # Ignore malformed cache file and continue with fresh auth.
        return


def _save_token_store() -> None:
    path = _token_store_path()
    payload = {
        "access_token": oauth_session.get("access_token"),
        "instance_url": oauth_session.get("instance_url"),
        "refresh_token": oauth_session.get("refresh_token"),
        "issued_at": oauth_session.get("issued_at")
    }
    path.write_text(json.dumps(payload, indent=2))


def get_oauth_authorize_url() -> str:
    client_id = _required_env("SF_CLIENT_ID")
    redirect_uri = _required_env("SF_REDIRECT_URI")
    base = f"{get_login_url().rstrip('/')}/services/oauth2/authorize"
    params = urllib.parse.urlencode(
        {
            "response_type": "code",
            "client_id": client_id,
            "redirect_uri": redirect_uri,
            "scope": "api refresh_token"
        }
    )
    return f"{base}?{params}"


def _post_token_request(payload: Dict[str, str]) -> Dict[str, str]:
    token_url = f"{get_login_url().rstrip('/')}/services/oauth2/token"
    encoded_payload = urllib.parse.urlencode(payload).encode("utf-8")
    req = urllib.request.Request(
        token_url,
        data=encoded_payload,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST"
    )
    with urllib.request.urlopen(req, timeout=20) as response:
        raw = response.read().decode("utf-8")
        return json.loads(raw)


def _update_oauth_session(token_data: Dict[str, str]) -> None:
    oauth_session["access_token"] = token_data.get("access_token")
    oauth_session["instance_url"] = token_data.get("instance_url")
    oauth_session["issued_at"] = token_data.get("issued_at")
    if token_data.get("refresh_token"):
        oauth_session["refresh_token"] = token_data.get("refresh_token")
    _save_token_store()


def exchange_code_for_token(code: str) -> Dict[str, str]:
    client_id = _required_env("SF_CLIENT_ID")
    client_secret = _required_env("SF_CLIENT_SECRET")
    redirect_uri = _required_env("SF_REDIRECT_URI")
    token_data = _post_token_request(
        {
            "grant_type": "authorization_code",
            "client_id": client_id,
            "client_secret": client_secret,
            "redirect_uri": redirect_uri,
            "code": code
        }
    )
    _update_oauth_session(token_data)
    return token_data


def refresh_access_token() -> Dict[str, str]:
    client_id = _required_env("SF_CLIENT_ID")
    client_secret = _required_env("SF_CLIENT_SECRET")
    refresh_token = oauth_session.get("refresh_token") or _required_env(
        "SF_REFRESH_TOKEN"
    )
    token_data = _post_token_request(
        {
            "grant_type": "refresh_token",
            "client_id": client_id,
            "client_secret": client_secret,
            "refresh_token": refresh_token
        }
    )
    _update_oauth_session(token_data)
    return token_data


def _connection_from_oauth_session() -> Optional[Salesforce]:
    access_token = oauth_session.get("access_token")
    instance_url = oauth_session.get("instance_url")
    if access_token and instance_url:
        return Salesforce(instance_url=instance_url, session_id=access_token)
    return None


def _connection_from_env_session() -> Optional[Salesforce]:
    access_token = os.getenv("SF_ACCESS_TOKEN")
    instance_url = os.getenv("SF_INSTANCE_URL")
    if access_token and instance_url:
        return Salesforce(instance_url=instance_url, session_id=access_token)
    return None


def create_salesforce_connection() -> Salesforce:
    oauth_conn = _connection_from_oauth_session()
    if oauth_conn:
        return oauth_conn

    if oauth_session.get("refresh_token") or os.getenv("SF_REFRESH_TOKEN"):
        refreshed = refresh_access_token()
        if refreshed.get("access_token") and refreshed.get("instance_url"):
            return Salesforce(
                instance_url=refreshed["instance_url"],
                session_id=refreshed["access_token"]
            )

    env_session_conn = _connection_from_env_session()
    if env_session_conn:
        return env_session_conn

    username = _required_env("SF_USERNAME")
    password = _required_env("SF_PASSWORD")
    security_token = os.getenv("SF_SECURITY_TOKEN", "")
    login_url = get_login_url()
    domain = "test" if "test.salesforce.com" in login_url else "login"

    return Salesforce(
        username=username,
        password=password,
        security_token=security_token,
        domain=domain
    )


def force_refresh_oauth_token() -> Dict[str, str]:
    if not (oauth_session.get("refresh_token") or os.getenv("SF_REFRESH_TOKEN")):
        raise ValueError("No refresh token available to refresh Salesforce session.")
    return refresh_access_token()


_load_token_store()
