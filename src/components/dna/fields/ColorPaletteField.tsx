'use client'

import {
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip'

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)] mb-1.5">
      {children}
    </div>
  )
}

interface WebColorPaletteProps {
  variant: 'web'
  colors: Array<{ hex: string; role: string }>
  overlays?: Array<{ intent: string }>
  relationship: string
}

interface ImageColorPaletteProps {
  variant: 'image'
  colors: string[]
  mood: string
}

type ColorPaletteFieldProps = WebColorPaletteProps | ImageColorPaletteProps

export function ColorPaletteField(props: ColorPaletteFieldProps) {
  return (
    <div>
      <SectionLabel>Color Palette</SectionLabel>
      <TooltipProvider>
        <div className="flex gap-2 mb-2">
          {props.variant === 'web'
            ? props.colors.map((c, i) => (
                <div key={i} className="flex flex-col items-center gap-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div
                        className="w-8 h-8 rounded-full border border-[var(--color-border)] cursor-default"
                        style={{ backgroundColor: c.hex }}
                      />
                    </TooltipTrigger>
                    <TooltipContent>
                      <span className="font-mono text-[10px]">{c.hex}</span>
                    </TooltipContent>
                  </Tooltip>
                  <span className="text-[10px] text-[var(--color-muted)] leading-tight">
                    {c.role}
                  </span>
                </div>
              ))
            : props.colors.map((hex, i) => (
                <div key={i} className="flex flex-col items-center gap-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div
                        className="w-8 h-8 rounded-full border border-[var(--color-border)] cursor-default"
                        style={{ backgroundColor: hex }}
                      />
                    </TooltipTrigger>
                    <TooltipContent>
                      <span className="font-mono text-[10px]">{hex}</span>
                    </TooltipContent>
                  </Tooltip>
                </div>
              ))}
        </div>
      </TooltipProvider>
      {props.variant === 'web' && props.overlays && props.overlays.length > 0 && (
        <div className="mb-2">
          <div className="text-[10px] mb-1" style={{ color: 'var(--color-muted)' }}>Overlays</div>
          <div className="flex flex-col gap-1">
            {props.overlays.map((overlay, i) => (
              <div key={i} className="text-[10px] leading-snug" style={{ color: 'var(--color-muted)' }}>
                {overlay.intent}
              </div>
            ))}
          </div>
        </div>
      )}
      <p className="text-[11px] text-[var(--color-muted)] m-0">
        {props.variant === 'web' ? props.relationship : props.mood}
      </p>
    </div>
  )
}
