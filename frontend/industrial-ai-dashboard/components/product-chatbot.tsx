'use client'

import { FormEvent, useState } from 'react'
import { Bot, MessageCircle, Send, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const starterQuestions = ['What does UNILOG AI enrich?', 'How does human review work?', 'What is source-backed evidence?']

type Message = { role: 'assistant' | 'user'; content: string }

export function ProductChatbot() {
  const [open, setOpen] = useState(false)
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'I can help explain UNILOG AI product-enrichment workflows, validation, evidence, and review.' },
  ])

  async function ask(message: string) {
    const trimmed = message.trim()
    if (!trimmed || loading) return
    setQuestion('')
    setMessages((current) => [...current, { role: 'user', content: trimmed }])
    setLoading(true)
    try {
      const response = await fetch('/api/product-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed }),
      })
      const data = await response.json() as { answer?: string; error?: string }
      setMessages((current) => [...current, { role: 'assistant', content: data.answer ?? data.error ?? 'No answer returned.' }])
    } catch {
      setMessages((current) => [...current, { role: 'assistant', content: 'The product assistant is temporarily unavailable.' }])
    } finally {
      setLoading(false)
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void ask(question)
  }

  return <>
    {open && <section className="fixed bottom-20 right-4 z-50 flex w-[min(360px,calc(100vw-2rem))] flex-col border bg-background shadow-2xl" aria-label="Nexus product assistant">
      <div className="flex items-center justify-between border-b bg-sidebar px-4 py-3 text-sidebar-foreground">
        <div className="flex items-center gap-2"><div className="flex size-8 items-center justify-center bg-primary text-primary-foreground"><Bot className="size-4" /></div><div><p className="text-sm font-semibold">Product assistant</p><p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">UNILOG AI help desk</p></div></div>
        <Button variant="ghost" size="icon" className="size-8" onClick={() => setOpen(false)} aria-label="Close product assistant"><X /></Button>
      </div>
      <div className="flex max-h-80 flex-col gap-3 overflow-y-auto p-3" aria-live="polite">
        {messages.map((message, index) => <div key={`${message.role}-${index}`} className={`max-w-[88%] px-3 py-2 text-xs leading-5 ${message.role === 'user' ? 'self-end bg-primary text-primary-foreground' : 'self-start border bg-muted/30 text-foreground'}`}>{message.content}</div>)}
        {loading && <div className="self-start border bg-muted/30 px-3 py-2 font-mono text-[10px] text-muted-foreground">Thinking...</div>}
        {messages.length === 1 && <div className="flex flex-wrap gap-1.5">{starterQuestions.map((starter) => <button key={starter} type="button" onClick={() => void ask(starter)} className="border px-2 py-1 text-left text-[10px] text-muted-foreground transition-colors hover:border-primary hover:text-primary">{starter}</button>)}</div>}
      </div>
      <form onSubmit={submit} className="flex gap-2 border-t p-3"><Input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask about the product..." aria-label="Ask about the product" maxLength={500} disabled={loading} /><Button type="submit" size="icon" disabled={loading || !question.trim()} aria-label="Send question"><Send /></Button></form>
    </section>}
    <Button onClick={() => setOpen((current) => !current)} className="fixed bottom-4 right-4 z-50 size-12 rounded-full shadow-lg" size="icon" aria-label={open ? 'Close product assistant' : 'Open product assistant'}><MessageCircle /></Button>
  </>
}
