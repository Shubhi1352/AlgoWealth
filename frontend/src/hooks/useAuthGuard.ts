import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useIsAuthed, useIsReady, useToken } from '@/store/useAuthStore'

interface AuthGuard {
    token: string | null
    isReady: boolean
    isAuthed: boolean
    router: ReturnType<typeof useRouter>
}

/**
 * Redirects unauthenticated users to /login after Zustand rehydrates.
 * Call at the top of every protected page, before any other hooks.
 * Guard the render with: if (!guard.isReady || !guard.isAuthed) return null
 */
export function useAuthGuard(): AuthGuard {
    const router = useRouter()
    const isAuthed = useIsAuthed()
    const isReady = useIsReady()
    const token = useToken()

    useEffect(() => {
        if (isReady && !isAuthed) router.replace('/login')
    }, [isReady, isAuthed, router])

    return { token, isReady, isAuthed, router }
}