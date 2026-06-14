'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { useChatStore, useChatIsOpen } from '@/store/useChatStore'
import { useChat } from '@/hooks/useChat'
import ChatMessages from './ChatMessages'
import ChatInput from './ChatInput'
import s from './ChatWidget.module.css'

// Map pathname → page context label
function resolvePageContext(pathname: string): { page: string; ticker?: string } {
    if (pathname === '/dashboard') return { page: 'dashboard' }
    if (pathname.startsWith('/stocks/')) {
        const ticker = pathname.split('/')[2]
        return { page: 'stock_detail', ticker: ticker?.toUpperCase() }
    }
    if (pathname === '/stocks') return { page: 'stocks' }
    if (pathname === '/watchlists/automated') return { page: 'watchlist_automated' }
    if (pathname.startsWith('/watchlists')) return { page: 'watchlist_ab' }
    if (pathname === '/portfolio') return { page: 'portfolio' }
    if (pathname === '/trades') return { page: 'trades' }
    if (pathname === '/profile') return { page: 'profile' }
    return { page: 'dashboard' }
}

export default function ChatWidget() {
    const isOpen = useChatIsOpen()
    const { toggle, close, setPageContext, clearMessages } = useChatStore()
    const { sendMessage } = useChat()
    const pathname = usePathname()

    // Sync page context whenever route changes
    useEffect(() => {
        setPageContext(resolvePageContext(pathname))
    }, [pathname, setPageContext])

    return (
        <>
            {/* ── Floating toggle button ── */}
            <button
                className={s.toggleBtn}
                onClick={toggle}
                aria-label={isOpen ? 'Close chat' : 'Open AI chat assistant'}
            >
                {isOpen ? <IconClose /> : <IconChat />}
            </button>

            {/* ── Chat panel ── */}
            {isOpen && (
                <div className={s.panel} role="dialog" aria-label="AI chat assistant">
                    {/* Header */}
                    <div className={s.header}>
                        <div className={s.headerLeft}>
                            <span className="live-dot" />
                            <span className={s.headerTitle}>AlgoWealth AI</span>
                        </div>
                        <div className={s.headerActions}>
                            <button
                                className={s.clearBtn}
                                onClick={clearMessages}
                                aria-label="Clear conversation"
                            >
                                Clear
                            </button>
                            <button
                                className={s.closeBtn}
                                onClick={close}
                                aria-label="Close chat"
                            >
                                <IconClose />
                            </button>
                        </div>
                    </div>

                    {/* Messages */}
                    <ChatMessages />

                    {/* Input */}
                    <ChatInput onSend={sendMessage} />
                </div>
            )}
        </>
    )
}

function IconChat() {
    return (
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <path
                d="M19 3H3C1.9 3 1 3.9 1 5v10c0 1.1.9 2 2 2h3l3 3 3-3h7c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2Z"
                stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"
            />
            <path d="M6 9h10M6 13h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
    )
}

function IconClose() {
    return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
    )
}