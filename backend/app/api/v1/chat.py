"""
Chat WebSocket endpoint.

Protocol:
  Client sends JSON: { "message": str, "page_context": dict, "history": list }
  Server streams back: plain text tokens, then sends {"type": "done"} to signal end
  Auth: client sends { "type": "auth", "token": str } as first message
"""

import json
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.db.mongodb import get_database
from app.services.chat_service import stream_chat_response
from app.core.security import decode_access_token          # reuse your existing JWT util

logger = logging.getLogger(__name__)
router = APIRouter()


@router.websocket("/ws")
async def chat_websocket(websocket: WebSocket) -> None:
    await websocket.accept()
    db: AsyncIOMotorDatabase = get_database()
    user_id: str | None = None

    try:
        # ── Auth handshake — first message must be auth ────────────────────────
        raw = await websocket.receive_text()
        auth_msg = json.loads(raw)

        if auth_msg.get("type") != "auth" or not auth_msg.get("token"):
            await websocket.send_json({"type": "error", "message": "First message must be auth"})
            await websocket.close()
            return

        try:
            user_id = decode_access_token(auth_msg["token"])
        except ValueError:
            await websocket.send_json({"type": "error", "message": "Invalid token"})
            await websocket.close()
            return
        if not user_id:
            await websocket.send_json({"type": "error", "message": "Invalid token"})
            await websocket.close()
            return

        await websocket.send_json({"type": "auth_ok"})
        logger.info("Chat WebSocket authenticated: user %s", user_id[:8])

        # ── Message loop ───────────────────────────────────────────────────────
        while True:
            raw = await websocket.receive_text()
            payload = json.loads(raw)

            message      = payload.get("message", "").strip()
            page_context = payload.get("page_context", {})
            history      = payload.get("history", [])

            if not message:
                continue

            # Stream tokens back
            async for token in stream_chat_response(
                message=message,
                conversation_history=history,
                page_context=page_context,
                user_id=user_id,
                db=db,
            ):
                await websocket.send_json({"type": "token", "content": token})

            # Signal end of this response
            await websocket.send_json({"type": "done"})

    except WebSocketDisconnect:
        logger.info("Chat WebSocket disconnected: user %s", user_id[:8] if user_id else "unauthenticated")
    except Exception as e:
        logger.error("Chat WebSocket error: %s", e)
        try:
            await websocket.send_json({"type": "error", "message": str(e)})
        except Exception:
            pass