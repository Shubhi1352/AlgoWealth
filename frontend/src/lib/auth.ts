const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export interface LoginResponse {
  access_token: string
  token_type: string
}

export interface UserResponse {
  id: string
  email: string
  virtual_balance: number
  created_at: string
}

export async function loginUser(email: string, password: string): Promise<LoginResponse> {
  const res = await fetch(`${API_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.detail || 'Login failed')
  }
  return data
}

export async function registerUser(email: string, password: string): Promise<UserResponse> {
  const res = await fetch(`${API_URL}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.detail || 'Registration failed')
  }
  return data
}

export async function verifyToken(token: string): Promise<{ user_id: string }> {
  const res = await fetch(`${API_URL}/api/v1/portfolio/me`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.detail || 'Token invalid')
  }
  return data
}

export function storeToken(token: string) {
  localStorage.setItem('aw_token', token)
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('aw_token')
}

export function clearToken() {
  localStorage.removeItem('aw_token')
}
