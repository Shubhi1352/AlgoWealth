'use client'

import { useEffect, useRef } from 'react'
import { useChatMessages } from '@/store/useChatStore'
import s from './ChatMessages.module.css'

export default function ChatMessages() {
    const messages = useChatMessages()
    const bottomRef = useRef<HTMLDivElement>(null)

    // Auto-scroll to bottom on new message or token
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    if (messages.length === 0) {
        return (
            <div className={s.empty}>
                <p className={s.emptyTitle}>AlgoWealth AI</p>
                <p className={s.emptyHint}>
                    Ask about your portfolio, analyze a stock, or query your documents.
                </p>
                <div className={s.suggestions}>
                    {SUGGESTIONS.map((s) => (
                        <span key={s} className="badge badge-neutral">{s}</span>
                    ))}
                </div>
            </div>
        )
    }

    return (
        <div className={s.list}>
            {messages.map((msg) => (
                <div
                    key={msg.id}
                    className={msg.role === 'user' ? s.userRow : s.assistantRow}
                >
                    <div className={msg.role === 'user' ? 'bubble-user' : 'bubble-ai'}>
                        {msg.content}
                        {msg.streaming && <span className={s.cursor} aria-hidden="true" />}
                    </div>
                </div>
            ))}
            <div ref={bottomRef} />
        </div>
    )
}

const SUGGESTIONS = [
    'What is my portfolio worth?',
    'Analyze NVDA',
    'Show my recent trades',
]