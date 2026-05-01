"""
Authentication business logic.

This layer sits between the API endpoints and the database.
Endpoints handle HTTP concerns (request parsing, response formatting).
Services handle business logic (does this user exist? is the password correct?).

This separation is the Service Layer pattern — it means we could
swap FastAPI for another framework and reuse all this logic unchanged.
"""

from app.db.mongodb import get_database
from app.core.security import hash_password, verify_password, create_access_token
from app.models.user import UserCreate, UserInDB, UserResponse


# MongoDB collection name — defined once, not scattered as magic strings
USERS_COLLECTION = "users"


async def register_user(user_data: UserCreate) -> UserResponse:
    """
    Register a new user.

    Steps:
    1. Check if email already exists
    2. Hash the password
    3. Save to MongoDB
    4. Return safe user representation (no password hash)

    Raises:
        ValueError: If the email is already registered.
    """
    db = get_database()

    # Step 1 — check for duplicate email
    existing = await db[USERS_COLLECTION].find_one({"email": user_data.email})
    if existing:
        raise ValueError(f"Email already registered: {user_data.email}")

    # Step 2 — hash password (never store plain text)
    user_in_db = UserInDB(
        email=user_data.email,
        password_hash=hash_password(user_data.password),
    )

    # Step 3 — insert into MongoDB
    # model_dump() converts Pydantic model → dict for MongoDB
    await db[USERS_COLLECTION].insert_one(user_in_db.model_dump())

    # Step 4 — return safe response (no password hash)
    return UserResponse(
        id=user_in_db.id,
        email=user_in_db.email,
        virtual_balance=user_in_db.virtual_balance,
        created_at=user_in_db.created_at,
    )


async def login_user(email: str, password: str) -> str:
    """
    Authenticate a user and return a JWT token.

    Steps:
    1. Find user by email
    2. Verify password against stored hash
    3. Return signed JWT token

    Raises:
        ValueError: If credentials are invalid (deliberately vague
                    — don't tell attackers which part was wrong).
    """
    db = get_database()

    # Step 1 — find user
    user_doc = await db[USERS_COLLECTION].find_one({"email": email})
    if not user_doc:
        raise ValueError("Invalid email or password")

    # Step 2 — verify password
    if not verify_password(password, user_doc["password_hash"]):
        raise ValueError("Invalid email or password")

    # Step 3 — issue JWT
    return create_access_token(subject=user_doc["id"])