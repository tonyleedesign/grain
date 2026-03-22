// Owner's private canvas — login required.
// TODO: Add auth check, redirect to /login if not authenticated
// Reference: grain-prd.md Section 4, 12

import { GrainCanvasLoader } from '@/components/canvas/GrainCanvasLoader'

export default function PrivateCanvasPage() {
  // Auth + canvasId will be wired when Supabase Auth is implemented.
  // For now, render canvas without upload capability.
  return (
    <div className="h-screen w-screen">
      <GrainCanvasLoader canvasType="private" canvasId="" />
    </div>
  )
}
