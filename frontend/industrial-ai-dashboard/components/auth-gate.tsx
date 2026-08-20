'use client'

import { FormEvent, useEffect, useState } from 'react'
import { AlertTriangle, LockKeyhole, LogIn } from 'lucide-react'
import { login } from '@/lib/backend-api'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => setAuthenticated(Boolean(window.localStorage.getItem('unilog.accessToken'))), [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      const result = await login(username, password)
      window.localStorage.setItem('unilog.accessToken', result.access_token)
      window.localStorage.setItem('unilog.username', username)
      setAuthenticated(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed.')
    } finally {
      setLoading(false)
    }
  }

  if (authenticated === null) return <div className="min-h-screen bg-background" />
  if (authenticated) return <>{children}</>

  return <main className="flex min-h-screen items-center justify-center bg-background p-6"><Card className="w-full max-w-md shadow-xl"><CardHeader><div className="mb-2 flex size-10 items-center justify-center bg-primary text-primary-foreground"><LockKeyhole className="size-5" /></div><CardTitle>Sign in to UNILOG AI</CardTitle><CardDescription>Access product enrichment, evidence, compliance, and review operations.</CardDescription></CardHeader><CardContent><form onSubmit={submit} className="flex flex-col gap-4"><Input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Username" autoComplete="username" required /><Input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" type="password" autoComplete="current-password" required />{error && <Alert variant="destructive"><AlertTriangle className="size-4" /><AlertTitle>Sign-in failed</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}<Button type="submit" disabled={loading}>{loading ? 'Signing in...' : <><LogIn data-icon="inline-start" /> Sign in</>}</Button></form></CardContent></Card></main>
}
