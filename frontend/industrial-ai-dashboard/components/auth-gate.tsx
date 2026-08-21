'use client'

import { FormEvent, useEffect, useState } from 'react'
import { AlertTriangle, LockKeyhole, LogIn, UserPlus, Sparkles, ShieldCheck } from 'lucide-react'
import { getCurrentUser, login, signup } from '@/lib/backend-api'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null)
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const token = window.localStorage.getItem('unilog.accessToken')
    if (!token) {
      setAuthenticated(false)
      return
    }
    // Verify token with backend
    getCurrentUser()
      .then((user) => {
        window.localStorage.setItem('unilog.username', user.username)
        setAuthenticated(true)
      })
      .catch(() => {
        // Token invalid or backend restarted -> reset session
        window.localStorage.removeItem('unilog.accessToken')
        setAuthenticated(false)
      })
  }, [])

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      const result = await login(username, password)
      window.localStorage.setItem('unilog.accessToken', result.access_token)
      window.localStorage.setItem('unilog.username', result.user?.username ?? username)
      setAuthenticated(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed. Please check credentials.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSignup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      const result = await signup(username, email, password)
      window.localStorage.setItem('unilog.accessToken', result.access_token)
      window.localStorage.setItem('unilog.username', result.user?.username ?? username)
      setAuthenticated(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed. Please try a different username.')
    } finally {
      setLoading(false)
    }
  }

  if (authenticated === null) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-3 text-sm text-muted-foreground animate-pulse">
          <Sparkles className="size-5 text-primary" /> Validating UNILOG AI Session...
        </div>
      </main>
    )
  }

  if (authenticated) return <>{children}</>

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-background via-muted/30 to-background p-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-lg shadow-primary/25">
          <Sparkles className="size-6" />
        </div>
        <div className="flex flex-col">
          <span className="text-xl font-bold tracking-tight text-foreground">UNILOG AI</span>
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Product Intelligence Suite</span>
        </div>
      </div>

      <Card className="w-full max-w-md border-border/60 bg-card/95 backdrop-blur shadow-2xl">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <LockKeyhole className="size-6" />
          </div>
          <CardTitle className="text-xl font-bold">Enterprise Access</CardTitle>
          <CardDescription className="text-xs">
            Sign in or create an analyst account to access product enrichment & evidence operations.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <Tabs value={mode} onValueChange={(val) => { setMode(val as 'login' | 'signup'); setError('') }}>
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="login" className="text-xs">
                <LogIn className="mr-1.5 size-3.5" /> Sign In
              </TabsTrigger>
              <TabsTrigger value="signup" className="text-xs">
                <UserPlus className="mr-1.5 size-3.5" /> Register
              </TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Username</label>
                  <Input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. admin"
                    autoComplete="username"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Password</label>
                  <Input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    type="password"
                    autoComplete="current-password"
                    required
                  />
                </div>

                {error && (
                  <Alert variant="destructive" className="py-2.5">
                    <AlertTriangle className="size-4" />
                    <AlertTitle className="text-xs font-semibold">Authentication failed</AlertTitle>
                    <AlertDescription className="text-xs">{error}</AlertDescription>
                  </Alert>
                )}

                <Button type="submit" disabled={loading} className="w-full mt-2 font-medium">
                  {loading ? 'Signing in...' : <><LogIn className="mr-2 size-4" /> Sign In</>}
                </Button>
                
                <p className="text-center font-mono text-[10px] text-muted-foreground">
                  Default credentials: <span className="text-foreground font-semibold">admin / admin</span>
                </p>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="flex flex-col gap-3.5">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Desired Username</label>
                  <Input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. analyst1"
                    required
                    minLength={3}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Work Email (Optional)</label>
                  <Input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="analyst@unilogcorp.com"
                    type="email"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Password</label>
                  <Input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 4 characters"
                    type="password"
                    required
                    minLength={4}
                  />
                </div>

                {error && (
                  <Alert variant="destructive" className="py-2.5">
                    <AlertTriangle className="size-4" />
                    <AlertTitle className="text-xs font-semibold">Sign up error</AlertTitle>
                    <AlertDescription className="text-xs">{error}</AlertDescription>
                  </Alert>
                )}

                <Button type="submit" disabled={loading} className="w-full mt-2 font-medium">
                  {loading ? 'Creating Account...' : <><UserPlus className="mr-2 size-4" /> Create Analyst Account</>}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <div className="mt-6 flex items-center justify-center gap-2 border-t pt-4 text-[11px] text-muted-foreground">
            <ShieldCheck className="size-3.5 text-emerald-500" /> Grounded Ingestion & Evidence Assurance
          </div>
        </CardContent>
      </Card>
    </main>
  )
}
