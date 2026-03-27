# Grain — Product Requirements Document
**Version:** 1.3  
**Status:** Ready for Development  
**Working Title:** Grain *(name subject to change — keep all references as a variable or config value)*

---

## 1. Problem Statement

Creative professionals collect visual inspiration constantly — from the real world, social media, and the web. That inspiration ends up scattered across phone camera rolls, desktop folders, and saved posts, becoming effectively useless. Existing tools like Miro and Mymind either require manual organization or lack the design intelligence to understand *why* images belong together.

But the deeper problem is this: **AI design tools are great at executing. They're terrible at exploring.** Tools like Claude Code, Cursor, and Midjourney generate confidently in one direction — they pick a style and commit. A human designer needs to explore multiple directions simultaneously, hold tension between them, and make a deliberate choice. No tool supports that exploration phase well.

Grain solves this by combining an infinite canvas with AI that understands aesthetic relationships — grouping images by visual DNA, extracting design patterns, and giving designers clarity on what direction they actually want to move in before they start building.

---

## 2. Product Vision

Grain is an AI-powered canvas for designers to capture inspiration, understand their aesthetic, and define their design direction. Unlike productivity canvases (Miro, Mural) or passive collection tools (Mymind, Pinterest), Grain actively analyzes your images, surfaces the design patterns embedded in your collection, and translates them into actionable design language.

**Core insight:** The problem isn't storage — it's clarity. Designers don't lack inspiration. They lack pattern recognition. Grain is the space between inspiration and decision — where a designer figures out what they actually want.

**The loop Grain enables:**
```
Collect inspiration
        ↓
AI extracts your design DNA
        ↓
Export as a portable prompt
        ↓
Paste into Claude Code, Cursor, Midjourney, any AI tool
        ↓
AI generates in YOUR aesthetic — not the default generic output
```

This directly solves the vibe coding problem: AI tools defaulting to one generic style because they don't know your taste. Grain is where you define your taste — and the export makes that definition portable across every AI tool you use.

---

## 3. Target User

**Primary:** The owner/builder — a product and graphic designer who collects visual inspiration across multiple categories (product design, graphic design, photography, motion) and wants to understand the evolution of their aesthetic taste over time.

**Secondary:** Creative professionals and design enthusiasts who access the public community canvas to explore, contribute, and play with the tool.

---

## 4. User Roles

| Role | Access | Capabilities |
|------|--------|--------------|
| **Owner** | Private canvas at `/canvas` — login required | Full canvas access, moderation, delete images, view all boards |
| **Named Guest** | Community canvas at `/` — prompted for handle on every visit | Upload images (attributed to handle), interact with canvas, view all boards, apply local theme, use AI features |
| **Anonymous Guest** | Community canvas at `/` — skip handle prompt | View and interact with existing canvas content only, cannot upload or use AI features |

**Auth model:**
- **Owner** — full Supabase Auth (email + password)
- **Named guests and anonymous guests** — Supabase anonymous auth. Every visitor gets a lightweight anonymous JWT session — no email, no password. Named guests attach a display handle to their session. Handle stamped on images at upload time — not stored in a separate Users table
- **Session duration** — 7-day JWT expiration, refreshed on activity. Stable anonymous user ID persists for ownership tracing — no separate device fingerprinting needed
- Handles are not unique — multiple people can use the same handle, intentional and fine
- No handle persistence between visits — fresh handle prompt on each visit
- Row Level Security works correctly for all roles via JWT, even for anonymous sessions

---

## 5. Core Features — V1

### 5.1 Infinite Canvas
- Built on **tldraw SDK** (React, TypeScript)
- Infinite scrollable canvas with pan and zoom
- Smooth navigation — trackpad, mouse wheel, pinch on mobile
- Light and clean aesthetic matching design DNA (see Section 9)
- Grid overlay option (toggle on/off)
- Snap to grid option (toggle on/off)

### 5.2 Image Upload
- Batch upload — 15 to 25 images per session recommended (matches AI credit limit)
- Drag and drop onto canvas OR file picker — both behave identically
- Images appear on canvas immediately in ungrouped state — instant visual feedback before AI runs
- Mobile: standard file input supports iPhone camera roll via mobile Safari
- Supported formats: JPG, PNG, HEIC, WEBP

**HEIC processing (two-step):**
- **Client-side:** `heic2any` library converts HEIC → JPEG in the browser before upload. Faster for user, no Vercel memory issues, free compute. If `heic2any` fails (rare, old browsers), upload raw file and let Sharp handle server-side as fallback.
- **Server-side:** Next.js API route runs Sharp on ALL uploaded files regardless of format — resize to 2000px max width, normalize to JPEG. This is idempotent — already-converted HEICs get resized, other formats get converted and resized. Consistent output format always.
- Flow: `HEIC → heic2any (browser) → JPEG → Sharp resize (server) → Supabase Storage`

**Additional dependency:** `heic2any` — client-side HEIC conversion library

- Images stored in **Supabase Storage**
- **Large batch notice:** if user selects 20+ images or 20MB+ total, a client-side message appears before upload: *"25 images selected. Large batches may take a moment to process."* — expectation setting only, no hard limit

**Rate limits (per anonymous session per day):**
- Max **25 images** uploaded per session per day
- Max **25 images processed by Claude** per session per day — 1:1 match with upload cap. Covers Organize calls and cursor chatbox queries combined, tracked as cumulative images sent to Claude

**Global daily limit:**
- Max **500 images** processed by Claude across all users per day
- Resets at **midnight UTC** every day
- When hit, AI features pause for everyone — canvas remains fully usable, upload still works
- All users see: *"Grain is a personal project with limited AI capacity. Daily limits keep it running for everyone. Come back tomorrow!"*

**Credit meter — minimal, neutral:**
- Small text in toolbar right side: *"12/25 credits"* — Bricolage 400, 11px, `--color-muted`
- Subtle 4px height progress bar below text, fills left to right
- Color: `--color-muted` default, `--color-accent` at 100%
- No gradients, no animations, no "AI" branding
- Turns amber at 20/25, red at 25/25
- Per-action cost preview: credit count = exact number of ungrouped images currently on canvas. Shown as *"Organize will use 12 credits"* — calculated client-side by counting ungrouped image shapes in tldraw state before API call

**When a limit is hit, users see:**
*"Grain is a personal project with limited AI capacity. Daily limits keep it running for everyone. Come back tomorrow!"*
Friendly, honest, non-alarming. No silent failures.

### 5.3 AI Grouping — On Demand
AI grouping is triggered manually by the user via the **"Organize"** button in the toolbar. Organize has one job only — grouping ungrouped images. It never touches existing boards.

**Organize button behavior:**
- Ungrouped images exist → AI analyzes and groups them into boards with DNA
- No ungrouped images exist → modal appears with message *"No new images to organize"* and upload UI embedded directly in the modal
- Organize never reorganizes existing boards — that job belongs to the cursor AI chatbox

**On "Organize"**, Claude Vision API analyzes all ungrouped images on the canvas and:
- Groups images into themed boards based on visual similarity
- Names each board (e.g. "Warm Brutalism", "Organic Minimalism", "Industrial Texture")
- Extracts **Design DNA** per board:
  - Dominant color palette (hex values) — used to subtly theme the board UI
  - Mood / feeling (3-5 words)
  - Style tags (e.g. Brutalist, Bauhaus, Wabi-Sabi)
  - Material / texture feel (e.g. Raw concrete, Linen, Aged paper)
  - Composition notes (e.g. Asymmetric, Grid-based, Negative space heavy)
  - Era / aesthetic movement reference
  - Recommended font pairing (display + body) with reasoning

**Board positioning after Organize:**
AI gently clusters resulting boards near where their images already were on the canvas — boards form organically around existing image positions with comfortable spacing between them. No full canvas reorganization. Spatial intent is respected, not overridden.

**Claude API timeout:** 45 seconds for Organize (batch processing). 15 seconds for chatbox queries (single interaction).

**Error handling:**
If Claude API is unavailable or times out during Organize:
- Images stay ungrouped on canvas — no canvas state corruption
- Toast appears: *"Grain couldn't connect to AI right now. [Retry]"* — manual retry button, no auto-retry
- Canvas remains fully usable

**Future upgrade — guided Organize flow (backlog):**
- Before Organize runs, show a warning modal explaining that AI will group inspo/assets into boards and may move or reposition items
- While AI is working, show a clear organizing state so users always know the action is in progress
- After AI returns a proposal, show a preview of the proposed boards and grouped inspo/images before committing changes
- User confirms or cancels — the live canvas should remain unchanged until confirmation
- Future TBD: allow users to manually move inspo/images between boards after organize, with optional DNA regeneration prompts

Boards are displayed as grouped clusters on the canvas. Each board's chrome is subtly tinted with its dominant DNA color (see Section 11.6). Users can expand a board to see full Design DNA in the side panel.

### 5.4 Cursor AI Chatbox
The cursor chatbox is the primary tool for all selection-based actions. It handles everything that involves a specific set of images or boards — keeping the Organize button clean and single-purpose.

- Appears when user drag-selects 2 or more images or boards
- A floating chat input appears near the cursor (not a sidebar)
- User types a natural language command, examples:
  - *"Group these into a new board"*
  - *"What do these have in common?"*
  - *"Pull the design DNA from these"*
  - *"Merge these boards"*
  - *"Rename this board"*
  - *"What mood does this collection have?"*
  - *"Split this board into two"*
- AI responds inline — either performing the action on canvas or returning a text insight
- **Non-destructive actions** (group, rename, analyze, merge suggestions) — AI acts immediately, brief confirmation toast appears: *"Done — grouped into Warm Brutalism"*
- **Destructive actions** (delete board, delete images, merge boards) — AI pauses and shows inline confirmation before acting:
  ```
  "This will delete Warm Brutalism and ungroup its 8 images. Continue? [ Yes ] [ Cancel ]"
  ```
- Undo (Cmd/Ctrl + Z) always available after any chatbox action as a safety net
- Chatbox dismisses on click away or Escape
- Available to all users on both private and community canvas

**Error handling:**
If Claude API is unavailable during a chatbox query:
- Input stays open
- Inline error appears below input: *"Something went wrong. [Retry]"* — manual retry, no auto-retry
- No canvas state affected

### 5.5 Manual Canvas Interactions
- Drag images between boards
- Drag boards to reposition on canvas
- Rename boards (double click board header)
- Resize images on canvas
- Delete images (owner only on private canvas, named guests can delete their own on community canvas)
- Undo / Redo (tldraw built-in)

### 5.6 Community Canvas (`/`)
- The landing page IS the community canvas — no separate marketing page
- On first visit, users see a simple modal: enter a handle to participate, or skip to browse anonymously
- Named guests (handle entered) can upload, use AI features, leave sticky notes — all attributed to their handle
- Anonymous guests (skipped handle) can browse and interact with existing canvas content but cannot upload or use AI features
- Shared public canvas all named guests contribute to
- Everyone's images are grouped together by AI — one collective aesthetic, not siloed by user
- Images are attributed with uploader's handle and upload date
- Canvas state persists and grows over time — it is a living board
- Owner can moderate: delete inappropriate images (soft deleted, purged from Supabase Storage after 48 hours)
- Named guests can apply themes — not persisted, resets when session ends or browser closes
- Owner login accessible via a small subtle link in the top corner of the canvas
- Both canvases (community and private) start completely empty — owner populates them intentionally over time
- Rate limits apply per anonymous session — see Section 5.2 for details

### 5.7 Sticky Notes & Text on Canvas
Both come built into tldraw SDK at zero additional cost or complexity. Styled to match Grain's design DNA.

**Sticky notes:**
- Available as a tool in the bottom toolbar
- Default tldraw yellow replaced with `--color-surface` (#FAFAF8) — slightly lighter than canvas background, feels like a real physical note
- Used for annotations, thoughts, and reactions next to boards or images
- On community canvas, guests can leave sticky notes attributed to their handle
- Resizable, draggable, same canvas interactions as images

**Text on canvas:**
- Rich text support built into tldraw — bold, italic, lists, links
- Floating text editing toolbar appears above selected text with:
  - Font selector (from Grain's curated font list)
  - Size control
  - Color picker (react-colorful)
  - Bold / Italic
- Text editing toolbar styled to match Grain's design DNA — not tldraw's default

**tldraw UI customization approach:**
- Use CSS variable overrides for base theming — maps directly to Grain's design token system
- Use component overrides (`TLComponents` prop) for toolbar, panels, and menus
- Bottom toolbar fully replaced with custom Grain component via tldraw's `Toolbar` override
- `hideUi` not used — we selectively override only what we need, keeping tldraw's proven interaction logic intact

### 5.8 Export DNA
One of Grain's most powerful features — translating your visual DNA into a portable prompt usable in any AI tool.

**The problem it solves:**
AI tools like Claude Code, Cursor, and Midjourney default to generic styles because they don't know your taste. Export DNA gives them that context — making every AI tool you use generate in your aesthetic.

**How it works:**
- **"Export DNA"** button lives in the DNA panel alongside "Apply to Grain"
- Exports the DNA of a single selected board — click Export DNA from any board's DNA panel
- On click: modal appears showing the full exportable prompt
- Modal has two actions: **[ Copy to clipboard ]** and **[ Download .md ]**
- Content is identical between both — just different delivery
- Download .md implementation: create `Blob` with markdown content, `URL.createObjectURL(blob)`, trigger via temporary `<a>` element with `download="grain-dna-[board-name].md"` attribute, revoke URL after download

**Export content structure:**
```markdown
# Design DNA — Grain Export
Generated: [date]

## Aesthetic Direction
[overall_feel for this board]

## Core Patterns
[4-6 concrete patterns from this board]

## Color System
[palette description + hex values]

## Composition Tendencies
[composition notes for this board]

## Typography Direction
[typography_direction + font_pairing recommendation]

## What Makes This Aesthetic Distinct
[what_makes_this_distinct synthesized]

## AI Prompt — Use This With Claude Code, Cursor, Midjourney
When designing, follow these principles:
[formatted as direct instructions for AI tools]
Do not: [list of things that conflict with this aesthetic]
```

**The AI prompt section** is the most important part — formatted specifically so you can paste it directly into Claude Code, Cursor, or any other AI tool and have it generate in your aesthetic rather than its default style.

### 5.9 Dynamic Theming — "Apply to Grain"
- Each Design DNA panel has an "Apply to Grain" button
- AI generates a full theme (colors, fonts, radius, shadows) from the board's DNA
- Theme applies instantly across the entire UI
- Font recommendations included in DNA panel (display + body pairing with reasoning)
- Owner theme persists in Supabase between sessions
- "Revert to default" always accessible in toolbar when custom theme is active

**Build order note:** Implement this feature last in V1, after all core canvas features are working. The theming architecture (CSS variables, theme config, ThemeContext) must be set up from day one — see Section 9.

---

## 6. V2 Features (Out of Scope for V1)

- **Grain Wrapped** — annual Spotify Wrapped-style review of your design taste: most used colors, dominant aesthetic movements, taste shifts over the year, your design constants vs trends
- **AI taste era detection** — AI automatically identifies and names distinct aesthetic periods in your timeline (e.g. "2016–2018: Dark Industrial Phase")
- **Named guest personal canvases** — persistent private canvases for non-owner users
- **Collaboration** — real-time multiplayer on shared canvases
- **Native mobile app** — for faster capture from camera
- **Export** — export boards as PDF, image, or shareable link
- **Canvas versioning** — snapshot-based version history with rollback. Out of scope for V1 personal project but worth adding if Grain scales to a wider audience
- **Find Similar** — AI-powered image discovery using Unsplash API. Select a board, click "Find similar," Grain uses the board's DNA (core patterns, palette, mood, style tags) to surface visually relevant images from Unsplash. User drags images they like onto the canvas — human curation stays central. Grain is built from YOUR inspiration, so this feature extends your existing aesthetic rather than replacing it. Full-canvas DNA synthesis — combine multiple boards into one unified direction for export

---

## 7. Technical Stack

### Frontend
| Layer | Choice | Reason |
|-------|--------|--------|
| Framework | **Next.js 16 + React + TypeScript** | App Router for file-based routing, built-in API routes for secure Claude API calls, image optimization, SSR, perfect Vercel integration |
| Canvas | **tldraw SDK** | Production-ready infinite canvas, multi-select, undo/redo, custom shapes, sticky notes, rich text — all built in. Hobby license required for production (free for non-commercial use). Commercial license $6,000/year if project monetizes. |
| UI Components | **shadcn/ui** | Composable, unstyled base components, easy to customize to design DNA |
| Styling | **Tailwind CSS** | Works naturally with shadcn |
| Icons | **Lucide React** | Clean, consistent, pairs well with shadcn |

### Backend / Infrastructure
| Layer | Choice | Reason |
|-------|--------|--------|
| Backend-as-a-Service | **Supabase** | Handles database, file storage, auth — minimal backend code needed |
| Database | **Supabase Postgres** | Canvas state, board data, image metadata |
| File Storage | **Supabase Storage** | Image storage with CDN delivery |
| Authentication | **Supabase Auth** | Owner login only in V1 |
| AI / Vision | **Claude API (claude-sonnet-4-6)** | Image analysis, grouping, design DNA extraction, canvas chat |
| Hosting | **Vercel** | Simple deployment, works naturally with Next.js, zero config |

### Architecture Flow
```
User uploads images (browser/mobile Safari)
        ↓
HEIC files converted to JPEG client-side via heic2any
        ↓
Images sent to Next.js API route
Sharp resizes all images to 2000px max
        ↓
Processed images stored in Supabase Storage
        ↓
Image URLs + metadata (upload date, uploader handle) saved to Supabase DB
Session image processing count incremented
        ↓
Next.js API route securely calls Claude API (API key never exposed to browser)
Claude receives image batch → analyzes → returns groupings + DNA
        ↓
Canvas state (boards, positions, groupings) saved to Supabase DB
        ↓
Next.js serves web app with SSR for fast initial load
        ↓
Accessible on desktop and mobile browser
```

---

## 8. Data Models (Simplified)

### Images Table
```
id, url, storage_path, uploaded_by (handle), uploaded_at,
canvas_id, board_id, position_x, position_y, width, height,
deleted_at (null for active, timestamp for soft-deleted private canvas images)
```

### Data Retention Policy
- **Community canvas images** — soft deleted, purged from Supabase Storage after **48 hours**
- **Private canvas images** — soft deleted, purged from Supabase Storage after **7 days**
- **DNA snapshot cards** — persist independently on canvas even after source board deletion. Tag updated to show board name + "Board deleted" indicator. DNA data only — no image files stored in snapshot cards.
- **Global AI limit** — resets at midnight UTC daily.

**Purge implementation — Supabase `pg_cron`:**
```sql
SELECT cron.schedule(
  'purge-deleted-images',
  '0 * * * *', -- Every hour
  $$
    DELETE FROM storage.objects
    WHERE name IN (
      SELECT storage_path FROM images
      WHERE deleted_at IS NOT NULL
      AND canvas_id IN (SELECT id FROM canvases WHERE type = 'community')
      AND deleted_at < NOW() - INTERVAL '48 hours'
      UNION
      SELECT storage_path FROM images
      WHERE deleted_at IS NOT NULL
      AND canvas_id IN (SELECT id FROM canvases WHERE type = 'private')
      AND deleted_at < NOW() - INTERVAL '7 days'
    )
  $$
);
```

### Boards Table
```
id, canvas_id, name, color_palette (JSON), core_patterns (array),
mood_tags (array), style_tags (array), material_tags (array),
composition_notes, era_reference, typography_display, typography_body,
typography_reasoning, what_makes_distinct, position_x, position_y,
created_at, updated_at
```

### Users Table
```
id (Supabase auth user id), role (owner | anonymous), created_at
```
Note: Named guest handles are not stored in this table. They are attached to the anonymous JWT session and stamped directly on image records at upload time. No separate guest user records needed.

---

## 9. Theming Architecture

### 9.1 Overview
Grain supports dynamic theming — the UI can retheme itself based on the Design DNA extracted from a user's image boards. This is a V1 feature, implemented last after core functionality is working.

**Critical rule for Claude Code:** All user-visible theme values must reference a CSS variable or the theme config object. tldraw internals, shadcn defaults, and interaction states (hover, focus, active) may use inline values where necessary — but any color, font, radius, or shadow that affects Grain's visual identity must go through the token system. When in doubt, use a token.

### 9.2 Theme Config File
All theme values live in one central file:

```typescript
// config/theme.ts

export interface GrainTheme {
  colors: {
    bg: string
    surface: string
    accent: string
    text: string
    muted: string
    border: string
  }
  typography: {
    fontFamily: string
    fontUrl: string
  }
  radius: {
    sm: string
    md: string
    lg: string
    xl: string
  }
  shadows: {
    toolbar: string
    card: string
    panel: string
    cursor: string
  }
}

export const defaultTheme: GrainTheme = {
  colors: {
    bg:      '#F0EDE8',
    surface: '#FAFAF8',
    accent:  '#6B7F6E',
    text:    '#1A1C19',
    muted:   '#8C8C85',
    border:  '#E2DDD8',
  },
  typography: {
    fontFamily: 'Bricolage Grotesque',
    fontUrl: 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@300;400;500;600&display=swap'
  },
  radius: {
    sm: '4px',
    md: '6px',
    lg: '8px',
    xl: '12px',
  },
  shadows: {
    toolbar: '0 4px 24px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)',
    card:    '0 2px 12px rgba(0,0,0,0.06)',
    panel:   '0 8px 32px rgba(0,0,0,0.10)',
    cursor:  '0 4px 16px rgba(0,0,0,0.08)',
  }
}
```

### 9.3 Theme Applier Function
A single function applies any theme object to the document root:

```typescript
// lib/applyTheme.ts

export function applyTheme(theme: GrainTheme) {
  const root = document.documentElement

  // Colors
  root.style.setProperty('--color-bg',      theme.colors.bg)
  root.style.setProperty('--color-surface', theme.colors.surface)
  root.style.setProperty('--color-accent',  theme.colors.accent)
  root.style.setProperty('--color-text',    theme.colors.text)
  root.style.setProperty('--color-muted',   theme.colors.muted)
  root.style.setProperty('--color-border',  theme.colors.border)

  // Typography
  root.style.setProperty('--font-family', theme.typography.fontFamily)
  loadFont(theme.typography.fontUrl)

  // Radius
  root.style.setProperty('--radius-sm', theme.radius.sm)
  root.style.setProperty('--radius-md', theme.radius.md)
  root.style.setProperty('--radius-lg', theme.radius.lg)
  root.style.setProperty('--radius-xl', theme.radius.xl)

  // Shadows
  root.style.setProperty('--shadow-toolbar', theme.shadows.toolbar)
  root.style.setProperty('--shadow-card',    theme.shadows.card)
  root.style.setProperty('--shadow-panel',   theme.shadows.panel)
  root.style.setProperty('--shadow-cursor',  theme.shadows.cursor)
}

function loadFont(url: string) {
  const existing = document.querySelector(`link[href="${url}"]`)
  if (!existing) {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = url
    document.head.appendChild(link)
  }
}
```

### 9.4 Theme Context
Theme state lives in a React context so any component can read it and the whole app reacts instantly when it changes:

```typescript
// context/ThemeContext.tsx

'use client'

import { createContext, useContext, useState } from 'react'
import { GrainTheme, defaultTheme } from '@/config/theme'
import { applyTheme } from '@/lib/applyTheme'

interface ThemeContextType {
  theme: GrainTheme
  setTheme: (theme: GrainTheme) => void
  resetTheme: () => void
}

const ThemeContext = createContext<ThemeContextType | null>(null)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<GrainTheme>(defaultTheme)

  const setTheme = (newTheme: GrainTheme) => {
    applyTheme(newTheme)
    setThemeState(newTheme)
  }

  const resetTheme = () => {
    applyTheme(defaultTheme)
    setThemeState(defaultTheme)
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resetTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
```

### 9.5 AI Theme Generation
When the user clicks "Apply to Grain" from a Design DNA panel, a Next.js API route calls Claude with the board's DNA and asks it to return a valid GrainTheme object:

```
POST /api/generate-theme
Body: { dna: BoardDNA }
Returns: GrainTheme
```

Claude receives the design DNA (colors, mood, style tags, material, era) and returns a complete GrainTheme JSON object with appropriate values. The API route validates the response before returning it to the client.

### 9.6 UI for Theming

**AI Generated Theme:**
- Each Design DNA panel has an "Apply to Grain" button
- On click: opens the **Theme Editor panel** pre-populated with AI suggested values
- User can accept as-is or manually adjust before applying
- Theme previews in real time as user adjusts in the editor
- "Apply" button confirms and saves
- Toolbar always shows a "Revert to default" option when a custom theme is active — small undo icon with tooltip

**Theme persistence — per canvas, not global:**
- **Owner private canvas** — theme saved to Supabase, persists between sessions. Private canvas and community canvas have independent saved themes.
- **Owner community canvas** — separate theme saved to Supabase for the community canvas. Does not affect private canvas theme.
- **Named guests** — theme is session only. Resets when session ends or browser closes. No localStorage persistence. Each visit starts on Grain default.

**Theme scope:**
- Theme applies to the canvas the user is currently on — never bleeds across canvases
- Owner changing theme on private canvas does not affect community canvas appearance for any user

**Manual Theme Editor Panel:**
- Opens as a panel (separate from DNA panel)
- Sections:
  - **Colors** — color picker (react-colorful) for each CSS variable: bg, surface, accent, text, muted, border
  - **Typography** — font selector dropdown (shadcn Select) with curated list of ~25 Google Fonts
  - **Shadows** — shadcn Slider for shadow intensity (subtle → strong)
- All changes preview in real time as user adjusts — CSS variables update instantly via `applyTheme`
- "Reset to AI suggestion" button restores the AI generated values
- "Reset to Grain default" button restores the original Grain theme
- "Apply" button confirms and saves to Supabase

**Additional dependency:** `react-colorful` — tiny zero-dependency color picker

### 9.7 Curated Font List & Recommendations
Hand-picked Google Fonts that work well for creative tools. Defined in `config/fonts.ts`. Claude also recommends a specific pairing from this list as part of Design DNA extraction — shown in the DNA panel with reasoning.

```typescript
export const curatedFonts = [
  // Warm & Humanist
  { name: 'Bricolage Grotesque', url: 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@300;400;500;600&display=swap', feel: 'Warm, quirky, handcrafted' },
  { name: 'DM Sans', url: 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500&display=swap', feel: 'Clean, friendly, modern' },
  { name: 'Plus Jakarta Sans', url: 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500&display=swap', feel: 'Contemporary, versatile' },
  { name: 'Nunito', url: 'https://fonts.googleapis.com/css2?family=Nunito:wght@300;400;500&display=swap', feel: 'Soft, rounded, approachable' },

  // Sharp & Editorial
  { name: 'Geist', url: 'https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500&display=swap', feel: 'Crisp, technical, elegant' },
  { name: 'Inter', url: 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500&display=swap', feel: 'Neutral, reliable, clean' },
  { name: 'Space Grotesk', url: 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500&display=swap', feel: 'Geometric, editorial' },
  { name: 'Syne', url: 'https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600&display=swap', feel: 'Avant-garde, editorial' },
  { name: 'Bebas Neue', url: 'https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap', feel: 'Bold, condensed, strong' },

  // Organic & Expressive
  { name: 'Fraunces', url: 'https://fonts.googleapis.com/css2?family=Fraunces:wght@300;400;500&display=swap', feel: 'Optical, expressive, literary' },
  { name: 'Playfair Display', url: 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500&display=swap', feel: 'Elegant, high contrast, refined' },
  { name: 'Cormorant Garamond', url: 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500&display=swap', feel: 'Delicate, editorial, luxury' },
  { name: 'Unbounded', url: 'https://fonts.googleapis.com/css2?family=Unbounded:wght@300;400;500&display=swap', feel: 'Wide, futuristic, bold' },
  { name: 'Lexend', url: 'https://fonts.googleapis.com/css2?family=Lexend:wght@300;400;500&display=swap', feel: 'Readable, open, neutral' },
]
// Note: Satoshi is available via Fontshare, not Google Fonts.
// URL: https://api.fontshare.com/v2/css?f[]=satoshi@300,400,500&display=swap
// Include separately if desired — requires different @import path
```

**DNA panel typography recommendation format:**
```
Typography Direction
Display — Bebas Neue
Body    — DM Sans Regular
Why     — Your warm organic palette pairs with humanist
          sans-serifs that have natural stroke contrast
```

---

## 10. Design DNA

**Name:** Grain *(variable: `APP_NAME`)*
**Tagline:** *Your visual identity, defined.*

### Color Palette — Calm Linen
```
--color-bg:       #F0EDE8   /* Linen background */
--color-surface:  #FAFAF8   /* Card / panel surface */
--color-accent:   #6B7F6E   /* Sage green — primary action color */
--color-text:     #1A1C19   /* Near black with warm undertone */
--color-muted:    #8C8C85   /* Secondary text, labels */
--color-border:   #E2DDD8   /* Subtle borders */
```

### Typography — Bricolage Grotesque
```
Font: Bricolage Grotesque (Google Fonts)
Weights: 300 (light), 400 (regular), 500 (medium), 600 (semibold)
```

| Use | Weight | Size |
|-----|--------|------|
| Board names | 500 | 14px |
| Body / labels | 400 | 13px |
| Metadata / muted | 300 | 11px |
| Section headers | 600 | 11px uppercase tracked |

### Vibe
Minimal · Warm · Organic · Studio-like
*Think: a high-end creative studio that uses natural materials but keeps things uncluttered.*

### Interaction Principles
- Animations should feel calm and intentional — no aggressive transitions
- AI actions should feel like a quiet collaborator, not a loud assistant
- The canvas is the hero — UI chrome should recede

---

## 11. UI Specification

### 11.1 Design Tokens
```
--radius-sm:      4px    /* Tags, chips, small elements */
--radius-md:      6px    /* Buttons, inputs, cards */
--radius-lg:      8px    /* Panels, modals, toolbar */
--radius-xl:      12px   /* Large cards, DNA panel */

--shadow-toolbar: 0 4px 24px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)
--shadow-card:    0 2px 12px rgba(0,0,0,0.06)
--shadow-panel:   0 8px 32px rgba(0,0,0,0.10)
--shadow-cursor:  0 4px 16px rgba(0,0,0,0.08)

--transition:     all 0.18s ease
```

### 11.2 Bottom Toolbar
A floating pill anchored to the bottom center of the canvas viewport. Always visible. Never scrolls with canvas.

**Layout (left to right):**
```
[ Grain wordmark ] [ divider ] [ Select | Upload | Text | Sticky note | Pen | Shapes ] [ divider ] [ Organize ] [ divider ] [ Home | Zoom out | Zoom % | Zoom in | Grid toggle ] [ divider ] [ AI credits meter ]
```

**Home button:**
- Icon: target or house icon (Lucide React)
- Action: calls `editor.zoomToFit({ animation: { duration: 250 } })` — tldraw SDK built-in
- Calculates bounding box of all shapes on canvas and centers camera so everything is visible at once
- Elegant one-liner — no manual coordinate calculation needed

- Background: `--color-surface` (`#FAFAF8`)
- Shadow: `--shadow-toolbar`
- Border radius: `--radius-lg` (8px)
- Height: 48px
- Padding: 8px 16px
- Gap between tools: 4px
- Tool icons: Lucide React, 18px, color `--color-muted`
- Active tool: icon color `--color-accent` (`#6B7F6E`), subtle `--color-bg` background pill behind icon

**Grain wordmark (left section):**
- Font: Bricolage Grotesque 500
- Size: 15px
- Color: `--color-text`
- Right of wordmark: 1px vertical divider in `--color-border`
- Clear visual separation — wordmark is not a clickable tool

**Divider between tools and zoom controls:**
- 1px vertical line, `--color-border`

**Position:** `fixed`, `bottom: 24px`, `left: 50%`, `transform: translateX(-50%)`

### 11.3 Design DNA Panel
The full design brief. Everything lives here — all fields, full reasoning, editable, live, actionable. Detaching creates a snapshot card on canvas — the panel stays open and live.

- Triggered by clicking a board header
- Slides in from the right edge of the viewport
- Width: 300px
- Background: `--color-surface`
- Shadow: `--shadow-panel`
- Border radius: `--radius-lg` on left edge only
- Always **live** — reflects current board state
- Has a detach button (drag handle icon) top right

**Full panel contents:**
```
● SOMBER URBAN DECAY      [ ··· ]  [ detach ]
──────────────────────────────────────────────
Color palette  [ ● ● ● ● ● ]  hex values on hover

Core patterns
  · High contrast shadows and isolated light
  · Desaturated with single muted accent
  · Texture-heavy — concrete, rust, asphalt
  · Grain and noise throughout
  · Asymmetric framing, subjects at edges

Mood           Witnessed · Atmospheric · Cold
Style tags     [ Decay ] [ Grain ] [ Asymmetric ]
               [ Industrial ] [ Cinematic ]
Material       Concrete · Rust · Wet asphalt
Composition    Asymmetric, subjects pushed to edges,
               deliberate empty space
Era            Early 2000s indie film, Fincher-era

Typography
Display — Bebas Neue
Body    — Geist Light
Why     — Condensed cold geometry carries urban
          weight without decoration

What makes this distinct
Unlike generic dark aesthetics that rely on pure
black, this uses near-blacks with cool undertones
and deliberate grain. Feels atmospheric rather
than designed.
──────────────────────────────────────────────
[ Regenerate DNA ]    [ Edit DNA manually ]
[ Apply to Grain ]    [ Export DNA ]
```

**[ ··· ] board actions menu:**
```
Rename board
Regenerate DNA
Edit DNA manually
Delete board
```

**Edit DNA manually:**
All DNA fields are editable — user corrects or refines what AI generated:
- **Board name** — free text
- **Color palette** — color picker (react-colorful) per swatch, add or remove swatches
- **Core patterns** — editable list items, add or remove
- **Mood** — editable tags, add or remove
- **Style tags** — editable tags, add or remove
- **Material** — editable tags, add or remove
- **Composition** — free text
- **Era** — free text
- **Typography** — font selector from curated list, editable reasoning
- **What makes this distinct** — free text
Changes save instantly and update board tinting on canvas

**Empty board behavior:**
- When the last image is dragged out of a board, the board auto-deletes
- No confirmation needed — clean and automatic
- **Sticky notes do not prevent auto-delete** — they are annotations, not content. If a board has sticky notes but no images, it still auto-deletes
- Images become ungrouped on canvas
- To regroup, user hits Organize

**Regenerate DNA:**
- Re-analyzes all current images in the board
- Live panel updates with new DNA
- Detached snapshot cards remain unchanged
- User can detach new result and compare alongside previous snapshots

**On detach:**
- Creates a frozen snapshot card on canvas — panel stays open and live
- Snapshot card is condensed — see Section 11.4 for snapshot card spec
- Tag always shows: *"Snapshot — [Board Name]"*
- If source board deleted: *"Snapshot — [Board Name] · Board deleted"*
- Multiple snapshots can coexist for comparison
- User can close/delete individual snapshot cards independently

**Error handling:**
If Claude API unavailable during DNA generation:
- Board still forms with images grouped correctly
- DNA panel shows: *"DNA unavailable. Tap to retry."*
- Board tinting and dot use neutral fallback color until retry succeeds

### 11.4 Snapshot Card
The condensed wall reference. Glanceable. Lives on the canvas next to the work. Frozen — never updates after detach. Independent from the live panel.

**Snapshot card contents:**
```
● SOMBER URBAN DECAY
[ Snapshot — Somber Urban Decay ]
──────────────────────────────────────────────
[ ● ] [ ● ] [ ● ] [ ● ] [ ● ]
Witnessed · Atmospheric · Cold
[ Decay ] [ Grain ] [ Asymmetric ]
Bebas Neue / Geist Light

Unlike generic dark aesthetics, this feels
atmospheric rather than designed.
──────────────────────────────────────────────
[ Apply to Grain ]    [ Export DNA ]
```

**Snapshot card spec:**
- Default width: 240px — compact, lives comfortably next to boards
- Resizable by user
- `--shadow-card`, `--radius-xl`
- Close button top right corner
- Shows: color swatches, top 3 mood words, top 3 style tags, font pairing (display/body names only), condensed "what makes this distinct" (2 lines max)
- Does NOT show: full core patterns list, material, composition, era, full typography reasoning — those live in the side panel
- Has Apply to Grain and Export DNA buttons — no Regenerate or Edit (those only make sense on the live panel)
- If source board deleted: tag updates to *"Snapshot — [Board Name] · Board deleted"*

**Three surfaces, one DNA — information hierarchy:**
```
Side panel     → full brief, all fields, editable, live
Snapshot card  → condensed reference, frozen, portable on canvas
Export (.md)   → formatted for AI tools, copy/download
```

### 11.5 Cursor AI Chatbox
- Appears when user drag-selects 2 or more images
- Positioned 12px below and right of the selection bounding box
- Never goes off screen — flips position if within 60px of any viewport edge. If near right edge: chatbox flips to left of selection bounding box. If near bottom edge: chatbox flips above selection bounding box.
- Background: `#FFFFFF`
- Shadow: `--shadow-cursor`
- Border radius: `--radius-lg` (8px)
- Width: 260px
- Contains: small text input + send button
- Placeholder: *"Ask AI about these images..."*
- Send button: sage green (`--color-accent`), arrow icon
- Dismisses on: Escape, click outside, or after AI responds
- AI response appears inline below the input as a soft text block

### 11.6 Image Cards on Canvas
- No border by default
- On hover: subtle `--shadow-card` appears, slight scale up (1.02)
- On select: sage green outline (`--color-accent`), 2px
- Corner radius: `--radius-md` (6px)

### 11.7 Board Clusters
- Board background stays neutral — `--color-bg` at 60% opacity, `--radius-lg`
- Board border: 1px dashed — color is the dominant DNA color of that board at 30% opacity, not `--color-border`. This gives each board a subtle unique tint without being loud
- Board header accent: a small colored dot (8px circle) before the board name, filled with the dominant DNA color at full opacity
- Board name: Bricolage 500, 13px uppercase tracked, `--color-muted`
- Header sits above the image cluster with 8px gap
- Board name is double-click to rename inline
- Images are the visual hero — board chrome recedes, DNA color is a hint not a statement

**Example:**
```
● WARM BRUTALISM        ← dot is terracotta, border is terracotta at 30%
  [ img ] [ img ]
  [ img ] [ img ]

● ORGANIC STUDIO        ← dot is sage, border is sage at 30%
  [ img ] [ img ]
```

**Board sizing and image layout:**
- Images maintain their natural aspect ratios — no forced cropping or uniform sizing
- Boards don't need to be clean or consistent — the beauty of design is in the messiness and inconsistency
- On initial Organize, AI positions boards on canvas with comfortable spacing — but image arrangement within boards is organic, not grid-locked
- After initial layout, boards auto-expand when new images are added
- After initial AI layout, everything is free to move and resize manually
- The canvas should feel like a physical pinboard or studio wall, not a spreadsheet

**Drag image onto existing board — wash effect:**
```
User drags image over a board
        ↓
Board highlights with a wash effect —
a ripple sweeps across from the point of entry
using the board's DNA accent color at low opacity
(like light catching a surface, not a harsh color change)
        ↓
Cursor changes to a "drop here" indicator
        ↓
User releases image
        ↓
Image lands where it was dropped — free flowing,
no auto-reorganization of existing images
        ↓
Small non-blocking prompt appears near board:
"Image added to Warm Brutalism. Regenerate DNA? [ Yes ] [ Skip ]"
Prompt auto-dismisses after 4 seconds if ignored
```

**Key principle:** AI organizes once on initial Organize. After that the board is the user's — free flowing, no forced reflows. New images land where dropped. AI steps back and lets the user curate.

**Drag over empty canvas vs board:**
- Empty canvas — no effect, image follows cursor freely
- Over a board — wash highlight triggers, cursor changes
- The visual distinction must be clear so users always know where they're dropping

**DNA regeneration prompt (new image added to board):**
- Appears when an image is manually dragged into a board
- Debounced 500ms after last drop — handles rapid consecutive drops cleanly without complex drag-state management
- Copy: *"Image added to [Board Name]. Regenerate DNA?"*
- Non-blocking — small toast-style prompt near the board
- Auto-dismisses after 4 seconds
- [ Yes ] triggers regeneration, [ Skip ] dismisses immediately

### 11.8 General UI Principles
- No heavy chrome — the canvas is the hero, UI should recede
- Animations: 180ms ease, nothing bouncy or aggressive
- Empty state canvas: subtle centered message — *"Drop your inspiration here"* with an upload button, `--color-muted`, Bricolage 300
- Ungrouped images (before Organize is hit) sit freely on canvas with no board chrome
- Loading state when AI is organizing: soft pulsing sage green indicator in toolbar, text *"Grain is thinking..."*
- All text: Bricolage Grotesque, never system fonts
- No pure black anywhere — always use `--color-text` (`#1A1C19`)
- **Design philosophy:** the canvas should feel like a physical pinboard or studio wall — alive, human, and intentionally imperfect. The beauty of design is in its inconsistency and messiness. Never force uniformity on the canvas.

---

## 12. Routes

| Route | Description | Access |
|-------|-------------|--------|
| `/` | Community canvas — this IS the landing page | Public |
| `/canvas` | Owner's private canvas | Owner only |
| `/login` | Owner login — linked subtly from community canvas top corner | Public |

---

## 13. Canvas Interactions Reference

| Interaction | Behavior |
|-------------|----------|
| Click + drag on empty canvas | Pan |
| Scroll / pinch | Zoom |
| Click image | Select |
| Shift + click | Multi-select |
| Click + drag to select | Lasso multi-select |
| Drag selected images | Move freely on canvas |
| Drag image over a board | Board wash highlight triggers |
| Drop image onto board | Image lands where dropped, DNA regenerate prompt appears |
| Drag last image out of board | Board auto-deletes, images become ungrouped |
| Multi-select images or boards | Cursor AI chatbox appears |
| Type in chatbox | AI performs action or returns insight |
| Click Organize (ungrouped images exist) | AI groups all ungrouped images into boards |
| Click Organize (no ungrouped images) | Modal appears with upload UI |
| Click board header | DNA panel slides in from right |
| Double-click board header | Rename board inline |
| Click detach icon on DNA panel | Panel becomes frozen snapshot card on canvas |
| Drag image to different board | Reassign, reflow, DNA prompt |
| Double-click canvas | Place sticky note |
| Select text | Text editing toolbar appears above selection |
| Escape | Deselect / dismiss chatbox |
| Cmd/Ctrl + Z | Undo |
| Cmd/Ctrl + Shift + Z | Redo |

---

## 14. AI Prompting Strategy

### Image Analysis (Batch Grouping + DNA Extraction)

**System prompt:**
```
You are a senior product and visual designer with strong taste.
Your job is to analyze a set of images and extract their shared 
design patterns. Do NOT give generic labels like "modern", "clean", 
or "minimal". Everything you say must be grounded in visible, 
repeated patterns across the images. Avoid fluff, filler, and 
vague adjectives.
```

**User prompt structure:**
```
Analyze these images and extract a clear Design DNA.
Return your answer as structured JSON with these exact fields:

1. board_name
   - 2-4 words max, concise and distinctive
   - Avoid generic names like "Modern Minimalism"

2. core_patterns (array of 4-6 items)
   - Each must describe something visual and repeatable
   - Be concrete ("muted warm neutrals" not "nice colors")
   - Only include patterns clearly visible across multiple images

3. color_palette
   - Describe in words first
   - Then provide 4-6 hex values that best represent it

4. composition
   - Layout tendencies: grid, asymmetry, spacing, density

5. typography_direction
   - Describe type style (not just font names)
   - Suggest 1-2 Google Fonts that match from this list: [curated font list]

6. overall_feel
   - 1-2 lines max
   - Synthesis, not a list of adjectives

7. what_makes_this_distinct
   - What separates this group from other possible directions

8. font_pairing
   - display: font name + weight
   - body: font name + weight  
   - reasoning: one sentence why this pairing fits

Before finalizing, check:
- Did you use any vague or generic terms?
- Are all patterns clearly visible across multiple images?
- Would a designer who created these images recognize 
  their own aesthetic in this output?
If not, revise to be more specific.
```

All DNA responses returned as structured JSON for UI parsing. Human-readable language layered on top for display in the DNA panel.

### Design Direction Query (Chatbox)
When a user asks for design directions via the cursor chatbox — e.g. *"I'm designing a landing page, group these and give me 3 design directions I could go with"* — Claude:

1. Groups the selected images into boards (same as Organize)
2. Extracts DNA per board
3. Returns 3 concrete named directions based on the DNA, each with:
   - A direction name
   - 3-5 specific design decisions a designer would make
   - What makes this direction distinct from the others

Example output:
```
Direction 1 — Warm Editorial
Large type, muted terracotta palette, generous whitespace.
Asymmetric grid with editorial rhythm.

Direction 2 — Raw Tactile  
Rough textures, asymmetric layout, monochrome with 
one warm accent. Linen and concrete material language.

Direction 3 — Soft Minimal
Linen tones, small typography, generous breathing room.
No decoration — structure carries everything.
```

### Canvas Chat (Cursor Chatbox)
Send selected image URLs + current board context + user's natural language command.
Claude returns either:
- An action (structured JSON): `{ action: "group", board_name: "...", dna: {...} }`
- An insight (text): returned as a floating response near the cursor
- A set of directions (structured): when user asks for design direction guidance

---

## 15. Case Study Screenshot Checklist

Capture these moments during the build for your case study:

**Before (capture now):**
- [ ] Your messy desktop folders
- [ ] Your camera roll with scattered inspiration
- [ ] Any existing "system" you've tried (folders, notes, etc.)

**During the build:**
- [ ] First canvas rendering (even if broken)
- [ ] First successful AI grouping
- [ ] Design DNA panel working for first time
- [ ] Cursor chatbox first interaction
- [ ] Theme applied from DNA for first time
- [ ] Community canvas with first guest upload
- [ ] Any interesting bugs or unexpected behaviors

**Final product:**
- [ ] Clean canvas with multiple boards
- [ ] Design DNA panel expanded
- [ ] Cursor chatbox in action
- [ ] Custom theme applied from a board
- [ ] Community canvas with multiple contributors
- [ ] Mobile browser view

---

## 16. Open Questions / Future Decisions

- Final app name (Grain is working title)
- Domain name
- Whether to open-source the project
- Whether community canvas gets moderation tools beyond owner delete
- Monitor Claude API costs as community canvas usage grows — no hard limits in V1 but worth watching

---

## 17. Licensing Notes

**tldraw SDK**
- Free in development — no license key needed while building
- Apply for a **hobby license** before going live (free for non-commercial use)
- If Grain ever monetizes, commercial license is $6,000/year
- Apply at: tldraw.dev/pricing

**Claude API**
- Pay per use — fractions of a cent per image analysis
- Estimated personal use cost: $1-5/month
- Per session limit: 25 images processed by Claude per day
- Global limit: 500 images processed per day across all users, resets midnight UTC
- Community canvas AI usage is open to named guests — monitor for abuse
- No hard enforcement beyond daily limits in V1 — add stricter controls if costs become a concern

---

*Last updated: March 2026*  
*Built with: Next.js 16 · tldraw · shadcn/ui · Supabase · Claude API · Vercel*
