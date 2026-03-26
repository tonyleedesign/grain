// Canvas AI tool definitions — JSON schema for Claude function calling.
// Each tool maps to a canvas action executed client-side.

import Anthropic from '@anthropic-ai/sdk'

export const CANVAS_AI_SYSTEM = `You are a canvas AI assistant for Grain, a design inspiration tool. Users collect reference images on an infinite canvas, group them into boards, and extract design DNA.

You can take actions on the canvas via tools. You are a collaborator, not a lecturer.

Rules:
- When the user asks a question about their selection, use analyze_selection or place_text to respond ON THE CANVAS.
- When the user wants to organize images, use group_images.
- When the user wants to rename a board, use rename_board.
- For destructive actions (delete), always set confirm: false first — the client will prompt the user.
- Keep text responses concise — 1-3 sentences max. You're writing on a canvas, not a chat window.
- If you're unsure what the user wants, place a brief clarifying question as text on the canvas.`

export const CANVAS_AI_TOOLS: Anthropic.Messages.Tool[] = [
  {
    name: 'place_text',
    description: 'Write text on the canvas near the current selection. Use this for answers, descriptions, analysis results, or any text response.',
    input_schema: {
      type: 'object' as const,
      properties: {
        text: {
          type: 'string',
          description: 'The text to place on the canvas.',
        },
        position: {
          description: 'Where to place the text. Use "near_selection" to place it near the current selection, or provide specific {x, y} coordinates.',
          oneOf: [
            { type: 'string', enum: ['near_selection'] },
            {
              type: 'object',
              properties: {
                x: { type: 'number' },
                y: { type: 'number' },
              },
              required: ['x', 'y'],
            },
          ],
        },
      },
      required: ['text', 'position'],
    },
  },
  {
    name: 'group_images',
    description: 'Group the selected ungrouped images into a named board (frame). Only works when ungrouped images are selected.',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: {
          type: 'string',
          description: 'The name for the new board.',
        },
      },
      required: ['name'],
    },
  },
  {
    name: 'rename_board',
    description: 'Rename the selected board. Only works when exactly one board (frame) is selected.',
    input_schema: {
      type: 'object' as const,
      properties: {
        newName: {
          type: 'string',
          description: 'The new name for the board.',
        },
      },
      required: ['newName'],
    },
  },
  {
    name: 'delete_selection',
    description: 'Delete the currently selected items. Always set confirm to false — the client handles confirmation.',
    input_schema: {
      type: 'object' as const,
      properties: {
        confirm: {
          type: 'boolean',
          description: 'Must be false. The client handles confirmation.',
        },
      },
      required: ['confirm'],
    },
  },
  {
    name: 'analyze_selection',
    description: 'Describe what is currently selected — images, boards, or shapes. Returns a text description placed on the canvas.',
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'extract_dna',
    description: 'Trigger DNA extraction on the selected board. Only works when exactly one board is selected. Opens the DNA panel.',
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },
]
