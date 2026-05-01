"""
Security utilities: password hashing and JWT token management.

Two responsibilities:
1. Password hashing with bcrypt (one-way, salted)
2. JWT creation and verification (signed with HS256)

These are kept here and nowhere else — security logic should
never be scattered across files.
"""

from datetime import datetime, timedelta, timezone
from typing import Any

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

# bcrypt context — handles salting and hashing automatically
_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ── Password utilities ────────────────────────────────────────────────────────

def hash_password(plain_password: str) -> str:
    """
    Hash a plain-text password using bcrypt.
    Each call produces a different hash (bcrypt adds a random salt).
    """
    return _pwd_context.hash(plain_password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a plain-text password against a stored bcrypt hash.
    Returns True if they match, False otherwise.
    """
    return _pwd_context.verify(plain_password, hashed_password)


# ── JWT utilities ─────────────────────────────────────────────────────────────

def create_access_token(subject: str) -> str:
    """
    Create a signed JWT access token.

    Args:
        subject: The user ID to encode as the token subject (sub claim).

    Returns:
        A signed JWT string the client will store and send with requests.
    """
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.JWT_EXPIRE_MINUTES
    )
    payload: dict[str, Any] = {
        "sub": subject,      # Subject — who this token represents
        "exp": expire,       # Expiry — when the token stops being valid
        "iat": datetime.now(timezone.utc),  # Issued at
    }
    return jwt.encode(
        payload,
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )


def decode_access_token(token: str) -> str:
    """
    Decode and verify a JWT token, returning the user ID.

    Raises:
        ValueError: If the token is invalid, expired, or tampered with.
    """
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
        user_id: str | None = payload.get("sub")
        if user_id is None:
            raise ValueError("Token missing subject claim")
        return user_id
    except JWTError as e:
        raise ValueError(f"Invalid token: {e}") from e