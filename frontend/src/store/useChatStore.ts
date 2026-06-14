import { create } from 'zustand'

export interface ChatMessage {
    id: string
    role: 'user' | 'assistant'
    content: string
    streaming: boolean   // true while tokens still arriving
}

export interface PageContext {
    page: string
    ticker?: string
    recent_trades?: unknown[]
}

interface ChatState {
    isOpen: boolean
    messages: ChatMessage[]
    pageContext: PageContext

    // Actions
    open: () => void
    close: () => void
    toggle: () => void
    setPageContext: (ctx: PageContext) => void
    addUserMessage: (content: string) => string   // returns id
    addAssistantStub: () => string   // returns id
    appendToken: (id: string, token: string) => void
    finalizeMessage: (id: string) => void
    clearMessages: () => void
}

export const useChatStore = create<ChatState>((set) => ({
    isOpen: false,
    messages: [],
    pageContext: { page: 'dashboard' },

    open: () => set({ isOpen: true }),
    close: () => set({ isOpen: false }),
    toggle: () => set((s) => ({ isOpen: !s.isOpen })),

    setPageContext: (ctx) => set({ pageContext: ctx }),

    addUserMessage: (content) => {
        const id = crypto.randomUUID()
        set((s) => ({
            messages: [
                ...s.messages,
                { id, role: 'user', content, streaming: false },
            ],
        }))
        return id
    },

    addAssistantStub: () => {
        const id = crypto.randomUUID()
        set((s) => ({
            messages: [
                ...s.messages,
                { id, role: 'assistant', content: '', streaming: true },
            ],
        }))
        return id
    },

    appendToken: (id, token) =>
        set((s) => ({
            messages: s.messages.map((m) =>
                m.id === id ? { ...m, content: m.content + token } : m
            ),
        })),

    finalizeMessage: (id) =>
        set((s) => ({
            messages: s.messages.map((m) =>
                m.id === id ? { ...m, streaming: false } : m
            ),
        })),

    clearMessages: () => set({ messages: [] }),
}))

// Selectors
export const useChatIsOpen = () => useChatStore((s) => s.isOpen)
export const useChatMessages = () => useChatStore((s) => s.messages)
export const usePageContext = () => useChatStore((s) => s.pageContext)