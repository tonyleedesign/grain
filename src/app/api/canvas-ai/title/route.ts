import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getAuthenticatedUser } from '@/lib/server-auth'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { summary } = await request.json()

    if (!summary) {
      return NextResponse.json({ error: 'summary is required' }, { status: 400 })
    }

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 20,
      messages: [
        {
          role: 'user',
          content: `Generate a concise 2-4 word title for this conversation.

Rules:
- Return ONLY the title, nothing else
- Do not use quotes
- Do not start with "Canvas", "AI", "Chat", or "Conversation"
- Prefer concrete subject words over generic labels

${summary}`,
        },
      ],
    })

    const title = response.content[0]?.type === 'text'
      ? response.content[0].text.trim().replace(/^["']|["']$/g, '')
      : ''

    return NextResponse.json({ title })
  } catch (error) {
    console.error('Title generation error:', error)
    return NextResponse.json({ title: '' })
  }
}
