'use client'

import { useCallback, useEffect, useRef } from 'react'
import { useToken } from '@/store/useAuthStore'
import { useChatStore } from '@/store/useChatStore'

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:8000'

export function useChat() {
    const token = useToken()
    const wsRef = useRef<WebSocket | null>(null)
    const asstIdRef = useRef<string | null>(null)  // tracks the currently streaming message id

    const {
        isOpen,
        messages,
        pageContext,
        addUserMessage,
        addAssistantStub,
        appendToken,
        finalizeMessage,
    } = useChatStore()

    // ── Connect on widget open, disconnect on close ──────────────────────────
    useEffect(() => {
        if (!isOpen || !token) return

        const ws = new WebSocket(`${WS_URL}/api/v1/chat/ws`)
        wsRef.current = ws

        ws.onopen = () => {
            // Auth handshake — first message must be auth
            ws.send(JSON.stringify({ type: 'auth', token }))
        }

        ws.onmessage = (event: MessageEvent) => {
            const msg = JSON.parse(event.data as string) as {
                type: 'auth_ok' | 'token' | 'done' | 'error'
                content?: string
                message?: string
            }

            if (msg.type === 'token' && msg.content && asstIdRef.current) {
                appendToken(asstIdRef.current, msg.content)
            }

            if (msg.type === 'done' && asstIdRef.current) {
                finalizeMessage(asstIdRef.current)
                asstIdRef.current = null
            }
        }

        ws.onerror = () => {
            if (asstIdRef.current) {
                appendToken(asstIdRef.current, '\n[Connection error]')
                finalizeMessage(asstIdRef.current)
                asstIdRef.current = null
            }
        }

        return () => {
            ws.close()
            wsRef.current = null
        }
    }, [isOpen, token]) // eslint-disable-line react-hooks/exhaustive-deps

    // ── Send message ──────────────────────────────────────────────────────────
    const sendMessage = useCallback((text: string) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
        if (!text.trim()) return

        // Add user bubble
        addUserMessage(text)

        // Add empty assistant bubble that will stream into
        const stubId = addAssistantStub()
        asstIdRef.current = stubId

        // Build conversation history from store (exclude the stub we just added)
        const history = messages
            .filter((m) => !m.streaming)
            .map((m) => ({ role: m.role, content: m.content }))

        wsRef.current.send(
            JSON.stringify({
                message: text,
                page_context: pageContext,
                history,
            })
        )
    }, [wsRef, messages, pageContext, addUserMessage, addAssistantStub])

    return { sendMessage }
}