# Investigation Trend Backend - Team Run Guide

## 1. Prerequisites
- Python 3.10+ (3.9 may also work, but 3.10+ is preferred)
- Access to a Salesforce Training Org
- Salesforce Connected App configured for OAuth 2.0 Web Server Flow

## 2. Clone and enter backend
```bash
cd backend
```

## 3. Create virtual environment
```bash
python3 -m venv .venv
source .venv/bin/activate
```

## 4. Install dependencies
```bash
pip install -r requirements.txt
```

## 5. Configure environment
Create local env file:
```bash
cp .env.example .env
```

Set these values in `backend/.env`:
```env
PORT=4000
SF_LOGIN_URL=https://login.salesforce.com
SF_CLIENT_ID=<connected_app_consumer_key>
SF_CLIENT_SECRET=<connected_app_consumer_secret>
SF_REDIRECT_URI=http://localhost:4000/auth/salesforce/callback
```

If using sandbox login:
```env
SF_LOGIN_URL=https://test.salesforce.com
```

## 6. Run the API
```bash
uvicorn fastapi_app.main:app --reload --port 4000 --env-file .env
```

## 7. Authenticate with Salesforce (OAuth)
Open in browser:
```bash
open "http://localhost:4000/auth/salesforce/login"
```

After login/consent, Salesforce redirects to:
`http://localhost:4000/auth/salesforce/callback`

## 8. Verify backend + Salesforce connection
```bash
curl http://localhost:4000/health
curl http://localhost:4000/auth/salesforce/status
curl http://localhost:4000/api/salesforce/connect-test
curl http://localhost:4000/api/investigations/trends
```

## 9. API docs
- Swagger UI: `http://localhost:4000/docs`

## 10. Notes
- OAuth tokens are cached locally in `backend/.sf_oauth_tokens.json` for session persistence.
- Do not commit secrets:
  - `backend/.env`
  - `backend/.sf_oauth_tokens.json`
- If callback fails, confirm Connected App callback URL exactly matches:
  - `http://localhost:4000/auth/salesforce/callback`

## 11. Troubleshooting
- `Missing Salesforce env var: SF_CLIENT_ID`
  - Ensure `.env` is populated and app started with `--env-file .env`
  - Restart uvicorn after env changes
- `INVALID_SESSION_ID`
  - Re-run OAuth login route
  - Confirm refresh token scope is enabled in Connected App
- zsh error `no matches found` for URL with `?`
  - Quote URL: `curl "http://localhost:4000/path?x=1"`
