// Organize API route — groups ungrouped visual artifacts by visual similarity using Claude Vision.
// DNA extraction happens separately via /api/extract-dna after medium selection.
// Reference: grain-prd.md Section 5.3

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import type { OrganizeArtifactInput, OrganizePlanResponse } from '@/types/organize'
import { getAuthenticatedUser } from '@/lib/server-auth'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

const SYSTEM_PROMPT = `You are a visual organization assistant with strong taste.
Your job is to group mixed visual artifacts into coherent mood boards.
Artifacts may be raw images, bookmarks with preview images, or links without previews.
Group by visual similarity, source affinity, shared mood, composition, material, or subject when that creates a coherent board.
Give each group a short, distinctive 2-4 word name that captures what makes it cohesive.
Also provide one short reason sentence explaining why the artifacts belong together.
Avoid generic names like "Modern Minimalism" or "Clean Design".

Important:
- Links and bookmarks are first-class artifacts, not weak secondary inputs.
- When a link has title, description, URL, or source-domain clues, use them actively.
- If a link has a preview image, use both the preview image and the metadata.
- If a link has no preview image, still group it based on its metadata and source affinity.
- Prefer meaningful mixed groups when links clearly belong with related images.`

function getSourceDomain(url: string | undefined) {
  if (!url) return undefined

  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return undefined
  }
}

function buildArtifactLabel(artifact: OrganizeArtifactInput, index: number) {
  const sourceDomain = getSourceDomain(artifact.url)
  const parts = [
    `Artifact ${index}`,
    `kind=${artifact.kind}`,
    sourceDomain ? `source_domain="${sourceDomain}"` : undefined,
    artifact.title ? `title="${artifact.title}"` : undefined,
    artifact.description ? `description="${artifact.description}"` : undefined,
    artifact.url ? `url="${artifact.url}"` : undefined,
    artifact.previewUrl ? 'has_preview=true' : 'has_preview=false',
  ].filter(Boolean)

  return parts.join(' | ')
}

function buildUserPrompt(artifacts: OrganizeArtifactInput[]): string {
  return `Group these ${artifacts.length} visual artifacts into proposed boards.

Return your answer as a JSON object with this exact structure:
{
  "boards": [
    {
      "board_name": "2-4 words, concise and distinctive",
      "reason": "One short sentence explaining the grouping",
      "artifact_indices": [0, 2, 4]
    }
  ]
}

Rules:
- Each artifact must belong to exactly one board
- Minimum 2 artifacts per board. If an artifact doesn't fit any group well, find its closest match.
- artifact_indices are zero-based indices matching the order artifacts were provided
- Board names must be specific to the visual content, not generic labels
- The reason should be short, concrete, and visual rather than abstract
- For links/bookmarks, use title, description, URL, and source domain as real grouping signals
- A bookmark without a preview image is still a valid artifact and must still be grouped thoughtfully
- Mixed image + link groups are good when the link clearly reinforces the same subject, mood, source, or aesthetic direction

Artifacts:
${artifacts.map((artifact, index) => `- ${buildArtifactLabel(artifact, index)}`).join('\n')}

Return ONLY valid JSON, no markdown fences, no explanation.`
}

function buildAnthropicContent(
  artifacts: OrganizeArtifactInput[],
  options?: { includeVisuals?: boolean }
): Anthropic.Messages.ContentBlockParam[] {
  const includeVisuals = options?.includeVisuals ?? true
  const content: Anthropic.Messages.ContentBlockParam[] = [{ type: 'text', text: buildUserPrompt(artifacts) }]

  artifacts.forEach((artifact, index) => {
    const label = buildArtifactLabel(artifact, index)
    content.push({ type: 'text', text: label })

    if (!includeVisuals) return

    const visualUrl = artifact.kind === 'image' ? artifact.url : artifact.previewUrl
    if (isValidRemoteVisualUrl(visualUrl)) {
      content.push({
        type: 'image' as const,
        source: {
          type: 'url' as const,
          url: visualUrl,
        },
      })
    }
  })

  return content
}

function isValidRemoteVisualUrl(url: string | undefined): url is string {
  if (!url) return false

  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

async function requestOrganizePlanFromAnthropic(artifacts: OrganizeArtifactInput[]) {
  const runRequest = async (includeVisuals: boolean) => {
    return anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildAnthropicContent(artifacts, { includeVisuals }) }],
    })
  }

  try {
    return await runRequest(true)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const shouldRetryWithoutVisuals =
      /robots\.txt|disallowed by the website|cross-origin|invalid image|messages\.\d+\.content/i.test(message)

    if (!shouldRetryWithoutVisuals) throw error

    console.warn('Organize retrying without visual URLs due to blocked remote asset:', message)
    return runRequest(false)
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { artifacts } = (await request.json()) as {
      artifacts: OrganizeArtifactInput[]
    }

    if (!artifacts?.length) {
      return NextResponse.json({ error: 'No artifacts provided' }, { status: 400 })
    }

    const response = await requestOrganizePlanFromAnthropic(artifacts)

    // Extract text response
    const textBlock = response.content.find((block) => block.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('No text response from Claude')
    }

    // Clean up Claude's response — strip markdown fences, trailing commas
    let jsonText = textBlock.text.trim()
    jsonText = jsonText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
    jsonText = jsonText.replace(/,\s*([}\]])/g, '$1')
    const parsed = JSON.parse(jsonText) as {
      boards: { board_name: string; reason: string; artifact_indices: number[] }[]
    }

    const result: OrganizePlanResponse = {
      boards: parsed.boards.map((board, index) => ({
        id: `proposal-${index + 1}`,
        board_name: board.board_name,
        reason: board.reason,
        artifact_ids: board.artifact_indices.map((i) => artifacts[i].id),
      })),
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Organize error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Organize failed' },
      { status: 500 }
    )
  }
}
