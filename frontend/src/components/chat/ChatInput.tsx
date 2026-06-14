'use client'

import { useCallback, useRef, useState } from 'react'
import s from './ChatInput.module.css'

interface ChatInputProps {
    onSend: (message: string) => void
}

export default function ChatInput({ onSend }: ChatInputProps) {
    const [value, setValue] = useState('')
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    const handleSend = useCallback(() => {
        const trimmed = value.trim()
        if (!trimmed) return
        onSend(trimmed)
        setValue('')
        // Reset textarea height
        if (textareaRef.current) textareaRef.current.style.height = 'auto'
    }, [value, onSend])

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
            }
        },
        [handleSend]
    )

    const handleChange = useCallback(
        (e: React.ChangeEvent<HTMLTextAreaElement>) => {
            setValue(e.target.value)
            // Auto-grow textarea up to 120px
            const el = e.target
            el.style.height = 'auto'
            el.style.height = `${Math.min(el.scrollHeight, 120)}px`
        },
        []
    )

    return (
        <div className={s.container}>
            <textarea
                ref={textareaRef}
                className={`aw-input ${s.textarea}`}
                value={value}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything… (Enter to send)"
                rows={1}
                aria-label="Chat message input"
            />
            <button
                className={`btn btn-accent ${s.sendBtn}`}
                onClick={handleSend}
                disabled={!value.trim()}
                aria-label="Send message"
            >
                <IconSend />
            </button>
        </div>
    )
}

function IconSend() {
    return (
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
            <path
                d="M13 7.5L2 2l2.5 5.5L2 13l11-5.5Z"
                stroke="currentColor" strokeWidth="1.5"
                strokeLinejoin="round"
            />
        </svg>
    )
}