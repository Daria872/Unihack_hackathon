from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import time
from pathlib import Path
from typing import Any, Dict, Optional
from pydantic import BaseModel, Field

# File path for user storage
USERS_FILE = Path(__file__).resolve().parents[3] / "data" / "users.json"


class UserSignup(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    email: Optional[str] = Field(default=None)
    password: str = Field(min_length=4, max_length=100)


class UserProfile(BaseModel):
    username: str
    email: Optional[str] = None
    role: str = "Administrator"
    created_at: float


def _secret() -> bytes:
    return os.environ.get("UNILOG_AUTH_SECRET", "unilog-intelligence-secret-key-2026").encode()


def hash_password(password: str, salt: bytes | None = None) -> tuple[str, str]:
    """Generates PBKDF2 hash and salt hex string."""
    if salt is None:
        salt = os.urandom(16)
    hashed = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 100000)
    return hashed.hex(), salt.hex()


def verify_password(password: str, hashed_hex: str, salt_hex: str) -> bool:
    """Verifies a password against saved hash and salt."""
    try:
        salt = bytes.fromhex(salt_hex)
        expected_hash = bytes.fromhex(hashed_hex)
        calc_hash = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 100000)
        return hmac.compare_digest(calc_hash, expected_hash)
    except Exception:
        return False


def _ensure_users_db() -> Dict[str, Dict[str, Any]]:
    """Loads users dictionary from data/users.json or initializes default admin user."""
    USERS_FILE.parent.mkdir(parents=True, exist_ok=True)
    if USERS_FILE.is_file():
        try:
            with USERS_FILE.open("r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass

    # Default admin user
    default_pass = os.environ.get("UNILOG_AUTH_PASSWORD", "admin")
    h_hex, s_hex = hash_password(default_pass)
    users = {
        "admin": {
            "username": "admin",
            "email": "admin@unilogcorp.com",
            "password_hash": h_hex,
            "salt": s_hex,
            "role": "Administrator",
            "created_at": time.time(),
        }
    }
    _save_users_db(users)
    return users


def _save_users_db(users: Dict[str, Dict[str, Any]]) -> None:
    USERS_FILE.parent.mkdir(parents=True, exist_ok=True)
    with USERS_FILE.open("w", encoding="utf-8") as f:
        json.dump(users, f, indent=2)


def register_user(signup: UserSignup) -> UserProfile:
    """Registers a new user into persistent storage."""
    users = _ensure_users_db()
    uname_key = signup.username.strip().lower()
    
    if uname_key in users:
        raise ValueError("Username already registered")
        
    h_hex, s_hex = hash_password(signup.password)
    new_user = {
        "username": signup.username.strip(),
        "email": signup.email.strip() if signup.email else f"{signup.username.strip()}@unilogcorp.com",
        "password_hash": h_hex,
        "salt": s_hex,
        "role": "Catalog Analyst",
        "created_at": time.time(),
    }
    users[uname_key] = new_user
    _save_users_db(users)
    
    return UserProfile(
        username=new_user["username"],
        email=new_user["email"],
        role=new_user["role"],
        created_at=new_user["created_at"]
    )


def authenticate_user(username: str, password: str) -> Optional[UserProfile]:
    """Authenticates credentials against saved users."""
    users = _ensure_users_db()
    uname_key = username.strip().lower()
    user_data = users.get(uname_key)
    
    if not user_data:
        # Fallback check for legacy default admin if env updated
        expected_user = os.environ.get("UNILOG_AUTH_USERNAME", "admin").lower()
        expected_pass = os.environ.get("UNILOG_AUTH_PASSWORD", "admin")
        if uname_key == expected_user and password == expected_pass:
            return UserProfile(username=username, email="admin@unilogcorp.com", role="Administrator", created_at=time.time())
        return None
        
    if verify_password(password, user_data["password_hash"], user_data["salt"]):
        return UserProfile(
            username=user_data["username"],
            email=user_data.get("email"),
            role=user_data.get("role", "Catalog Analyst"),
            created_at=user_data.get("created_at", time.time())
        )
    return None


def generate_token(username: str) -> str:
    """Generates an HMAC-signed bearer token with 24h expiration."""
    expires = int(time.time()) + 86400
    payload = f"{username}:{expires}"
    signature = hmac.new(_secret(), payload.encode("utf-8"), hashlib.sha256).hexdigest()
    return base64.urlsafe_b64encode(f"{payload}:{signature}".encode("utf-8")).decode("utf-8")


def verify_token(token: str) -> Optional[UserProfile]:
    """Decodes token, checks signature & expiration, and returns UserProfile."""
    try:
        raw = base64.urlsafe_b64decode(token.encode("utf-8")).decode("utf-8")
        parts = raw.split(":")
        if len(parts) != 3:
            return None
        username, expires_str, signature = parts[0], parts[1], parts[2]
        
        if int(expires_str) < time.time():
            return None
            
        payload = f"{username}:{expires_str}"
        expected_sig = hmac.new(_secret(), payload.encode("utf-8"), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(signature, expected_sig):
            return None
            
        users = _ensure_users_db()
        uname_key = username.strip().lower()
        user_data = users.get(uname_key)
        if user_data:
            return UserProfile(
                username=user_data["username"],
                email=user_data.get("email"),
                role=user_data.get("role", "Catalog Analyst"),
                created_at=user_data.get("created_at", time.time())
            )
        return UserProfile(username=username, email=f"{username}@unilogcorp.com", role="Administrator", created_at=time.time())
    except Exception:
        return None
