const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:8000'

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { message?: string }
    const message = body.message?.trim()

    if (!message || message.length > 500) {
      return Response.json({ error: 'Please provide a question under 500 characters.' }, { status: 400 })
    }

    const response = await fetch(`${BACKEND_URL}/api/chatbot/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: message, chat_history: [] }),
    })

    const data = await response.json() as { answer?: string; detail?: string }
    if (!response.ok) {
      return Response.json({ error: data.detail ?? 'The product assistant request failed.' }, { status: response.status })
    }
    return Response.json({ answer: data.answer ?? 'The backend returned an empty answer.' })
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'The product assistant is temporarily unavailable.' }, { status: 502 })
  }
}
