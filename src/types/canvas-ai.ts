// Canvas AI types — request/response shapes, tool parameters, selection context.

// --- Selection context sent to the API ---

export interface CanvasAISelectionContext {
  selectionType: 'image' | 'board' | 'mixed' | 'shapes' | 'none'
  selectedImages?: {
    urls: string[]
    ungrouped: boolean
    boardName?: string
  }
  selectedBoards?: {
    names: string[]
    dnaSummaries?: string[]
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
