from __future__ import annotations

import base64
import hashlib
import hmac
import os
import time
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=120)
    password: str = Field(min_length=1, max_length=200)


def _secret() -> bytes:
    return os.environ.get("UNILOG_AUTH_SECRET", "development-auth-secret").encode()


def _default_password() -> str:
    return os.environ.get("UNILOG_AUTH_PASSWORD", "admin")


def _token(username: str) -> str:
    payload = f"{username}:{int(time.time()) + 86400}"
    signature = hmac.new(_secret(), payload.encode(), hashlib.sha256).hexdigest()
    return base64.urlsafe_b64encode(f"{payload}:{signature}".encode()).decode()


@router.post("/login")
def login(request: LoginRequest) -> dict[str, str]:
    expected_user = os.environ.get("UNILOG_AUTH_USERNAME", "admin")
    expected_password = _default_password()
    if not hmac.compare_digest(request.username, expected_user) or not hmac.compare_digest(request.password, expected_password):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    return {"access_token": _token(request.username), "token_type": "bearer", "expires_in": "86400"}


@router.post("/logout")
def logout() -> dict[str, str]:
    return {"status": "ok"}
