import os

from simple_salesforce import Salesforce


def _required_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise ValueError(f"Missing Salesforce env var: {name}")
    return value


def create_salesforce_connection() -> Salesforce:
    username = _required_env("SF_USERNAME")
    password = _required_env("SF_PASSWORD")
    security_token = _required_env("SF_SECURITY_TOKEN")
    login_url = os.getenv("SF_LOGIN_URL", "https://login.salesforce.com")
    domain = "test" if "test.salesforce.com" in login_url else "login"

    return Salesforce(
        username=username,
        password=password,
        security_token=security_token,
        domain=domain
    )
