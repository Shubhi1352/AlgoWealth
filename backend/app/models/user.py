"""
User data models.

We have three distinct models for one concept — this is intentional:
- UserCreate:   what the client sends us (email + plain password)
- UserInDB:     what we store in MongoDB (email + hashed password)
- UserResponse: what we send back to the client (never include password)

This separation ensures we never accidentally return a password hash
in an API response, even if a developer makes a mistake.
"""

from datetime import datetime, timezone
from pydantic import BaseModel, EmailStr, Field
import uuid


class UserCreate(BaseModel):
    """Request body for POST /auth/register."""
    email: EmailStr
    password: str = Field(min_length=8, description="Minimum 8 characters")


class UserInDB(BaseModel):
    """
    Internal representation — stored in MongoDB.
    Never returned directly in API responses.
    """
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    password_hash: str
    virtual_balance: float = 100_000.00   # Starting paper trading balance
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )


class UserResponse(BaseModel):
    """
    Safe public representation — returned in API responses.
    Notice: no password_hash field here.
    """
    id: str
    email: EmailStr
    virtual_balance: float
    created_at: datetime