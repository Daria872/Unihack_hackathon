'use client'

import { FormEvent, useState, useRef, useEffect } from 'react'
import { Bot, MessageCircle, Send, X, Sparkles, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getChatAnswer } from '@/lib/backend-api'

const dynamicPrompts = [
  'What is LOV & UOM compliance?',
  'Compare Frigidaire PDSH4816AF vs Whirlpool WDTS7024RZ',
  'How does the Human Review Queue work?',
  'Show evidence citations for PDSH4816AF',
  'What are the voltage and sound specifications for WDTS7024RZ?',
]

type Message = { role: 'assistant' | 'user'; content: string }

export function ProductChatbot() {
  const [open, setOpen] = useState(false)
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Hello! I am the UNILOG AI Product Intelligence Assistant. Ask me about product specifications, MPN details, evidence page citations, confidence signals, LOV/UOM compliance rules, or compare models!',
    },
  ])
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, open, loading])

  async function ask(message: string) {
    const trimmed = message.trim()
    if (!trimmed || loading) return
    setQuestion('')
    
    const updatedHistory = [...messages, { role: 'user' as const, content: trimmed }]
    setMessages(updatedHistory)
    setLoading(true)
    
    try {
      // Send chat history to backend LangGraph chatbot
      const historyPayload = updatedHistory.map((m) => ({ role: m.role, content: m.content }))
      const res = await getChatAnswer(trimmed, historyPayload)
      setMessages((curr) => [...curr, { role: 'assistant', content: res.answer || 'No answer returned from chatbot service.' }])
    } catch {
      setMessages((curr) => [
        ...curr,
        { role: 'assistant', content: 'The UNILOG AI product assistant is temporarily unavailable. Please check backend connection.' },
      ])
    } finally {
      setLoading(false)
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void ask(question)
  }

  function clearHistory() {
    setMessages([
      {
        role: 'assistant',
        content: 'Chat history cleared. Ask me any question about product attributes, evidence, or compliance!',
      },
    ])
  }

  return (
    <>
      {open && (
        <section
          className="fixed bottom-20 right-4 z-50 flex h-[520px] w-[min(420px,calc(100vw-2rem))] flex-col rounded-xl border bg-card/95 backdrop-blur shadow-2xl overflow-hidden border-border/80"
          aria-label="UNILOG AI Product Intelligence Assistant"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b bg-sidebar px-4 py-3 text-sidebar-foreground">
            <div className="flex items-center gap-2.5">
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
                <Bot className="size-4" />
              </div>
              <div className="flex flex-col">
                <p className="text-xs font-bold tracking-tight">Product Intelligence Copilot</p>
                <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <Sparkles className="size-2.5 text-primary" /> LangGraph Grounded Engine
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-foreground" onClick={clearHistory} title="Clear chat history">
                <RefreshCw className="size-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-foreground" onClick={() => setOpen(false)} aria-label="Close assistant">
                <X className="size-4" />
              </Button>
            </div>
          </div>

          {/* Messages body */}
          <div ref={scrollRef} className="flex flex-1 flex-col gap-3 overflow-y-auto p-3.5 text-xs leading-5" aria-live="polite">
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`max-w-[90%] whitespace-pre-wrap rounded-lg px-3.5 py-2.5 shadow-sm ${
                  message.role === 'user'
                    ? 'self-end bg-primary text-primary-foreground font-medium'
                    : 'self-start border bg-muted/40 text-foreground font-sans'
                }`}
              >
                {message.content}
              </div>
            ))}

            {loading && (
              <div className="self-start flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-[11px] font-mono text-muted-foreground animate-pulse">
                <Sparkles className="size-3.5 text-primary" /> Executing retrieval & grounded reasoning...
              </div>
            )}

            {messages.length <= 2 && !loading && (
              <div className="mt-2 flex flex-col gap-1.5 border-t pt-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Suggested Intelligence Queries</span>
                <div className="flex flex-col gap-1.5">
                  {dynamicPrompts.map((starter) => (
                    <button
                      key={starter}
                      type="button"
                      onClick={() => void ask(starter)}
                      className="rounded-md border bg-background/80 px-2.5 py-1.5 text-left text-[11px] text-foreground transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary font-medium"
                    >
                      {starter}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Input form */}
          <form onSubmit={submit} className="flex gap-2 border-t bg-background/50 p-3">
            <Input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask about attributes, MPN, evidence, or rules..."
              aria-label="Ask about the product"
              maxLength={500}
              disabled={loading}
              className="h-9 text-xs"
            />
            <Button type="submit" size="icon" className="size-9 shrink-0" disabled={loading || !question.trim()} aria-label="Send question">
              <Send className="size-4" />
            </Button>
          </form>
        </section>
      )}

      <Button
        onClick={() => setOpen((curr) => !curr)}
        className="fixed bottom-5 right-5 z-50 size-12 rounded-full shadow-2xl shadow-primary/30 transition-transform hover:scale-105"
        size="icon"
        aria-label={open ? 'Close assistant' : 'Open product assistant'}
      >
        {open ? <X className="size-5" /> : <MessageCircle className="size-5" />}
      </Button>
    </>
  )
}
