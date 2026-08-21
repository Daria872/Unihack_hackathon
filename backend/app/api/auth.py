from __future__ import annotations

from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel, Field

from app.services.auth_store import (
    UserSignup,
    UserProfile,
    authenticate_user,
    generate_token,
    register_user,
    verify_token,
)

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=120)
    password: str = Field(min_length=1, max_length=200)


def get_current_user(authorization: Optional[str] = Header(None)) -> UserProfile:
    """Dependency to extract user from Authorization Bearer header."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication required")
    token = authorization.split(" ")[1]
    user = verify_token(token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired authentication token")
    return user


@router.post("/signup", response_model=Dict[str, Any])
def signup(request: UserSignup) -> Dict[str, Any]:
    """Register a new user into persistent storage."""
    try:
        profile = register_user(request)
        token = generate_token(profile.username)
        return {
            "access_token": token,
            "token_type": "bearer",
            "expires_in": "86400",
            "user": profile.model_dump(),
        }
    except ValueError as err:
        raise HTTPException(status_code=400, detail=str(err))


@router.post("/login", response_model=Dict[str, Any])
def login(request: LoginRequest) -> Dict[str, Any]:
    """Authenticate user and return bearer token."""
    profile = authenticate_user(request.username, request.password)
    if not profile:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    token = generate_token(profile.username)
    return {
        "access_token": token,
        "token_type": "bearer",
        "expires_in": "86400",
        "user": profile.model_dump(),
    }


@router.get("/me", response_model=UserProfile)
def get_me(user: UserProfile = Depends(get_current_user)) -> UserProfile:
    """Returns current authenticated user details."""
    return user


@router.post("/logout")
def logout() -> Dict[str, str]:
    return {"status": "ok"}
