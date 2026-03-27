import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

export async function POST(request: NextRequest) {
  try {
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
          content: `Generate a 2-4 word title for this conversation. Return ONLY the title, nothing else.\n\n${summary}`,
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
