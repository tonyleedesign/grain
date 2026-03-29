// Canvas AI types — request/response shapes, tool parameters, selection context.

// --- Selection context sent to the API ---

export interface CanvasAISelectionContext {
  selectionType: 'image' | 'board' | 'mixed' | 'shapes' | 'none'
  selectedImages?: {
    urls: string[]
    ungrouped: boolean
    boardName?: string
    boardId?: string
  }
  selectedBoards?: {
    names: string[]
    boards: Array<{
      id?: string
      name: string
      imageCount: number
      imageUrls: string[]
    }>
  }
  selectedLinks?: {
    urls: string[]
    links: Array<{
      url: string
      title?: string
      description?: string
      previewImageUrl?: string
      boardId?: string
      boardName?: string
      shapeType: 'bookmark' | 'embed'
    }>
  }
  selectedShapes?: {
    count: number
    shapeTypes: string[]
  }
  canvasOverview: {
    totalBoards: number
    totalUngroupedImages: number
    boardNames: string[]
  }
}

// --- API request/response ---

export interface CanvasAIRequest {
  message: string
  context: CanvasAISelectionContext
  canvasId: string
  conversationId?: string
}

export interface CanvasAIToolCall {
  name: string
  input: Record<string, unknown>
}

export interface CanvasAIResponse {
  toolCalls: CanvasAIToolCall[]
  textResponse?: string
  error?: string
}

// --- Tool parameter types (one per tool) ---

export interface PlaceTextParams {
  text: string
  position: 'near_selection' | { x: number; y: number }
}

export interface GroupImagesParams {
  name: string
}

export interface RenameBoardParams {
  newName: string
}

export interface DeleteSelectionParams {
  confirm: boolean
}

// analyze_selection and extract_dna take no parameters

// --- Suggestion chip ---

export interface AISuggestion {
  label: string
  message: string
}

// --- Chat card message ---

export interface ChatMessage {
  role: 'assistant' | 'user'
  text: string
  timestamp: number
}

// --- SSE streaming types ---

export type SSEEvent =
  | { type: 'text_delta'; text: string }
  | { type: 'tool_call'; name: string; input: Record<string, unknown> }
  | { type: 'done' }
  | { type: 'error'; message: string }

// --- Multi-turn request ---

export interface CanvasAIChatRequest {
  messages: ChatMessage[]
  originalContext: string       // JSON stringified original selection context
  currentContext: CanvasAISelectionContext
  canvasId: string
}
