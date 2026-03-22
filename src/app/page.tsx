// Community canvas — the landing page.
// Public access. Named guests prompted for handle, anonymous guests can view.
// Reference: grain-prd.md Section 4, 12

import { GrainCanvasLoader } from '@/components/canvas/GrainCanvasLoader'
import { getCommunityCanvasId } from '@/lib/getCanvasId'

export default async function CommunityCanvasPage() {
  const canvasId = await getCommunityCanvasId()

  return (
    <div className="h-screen w-screen">
      <GrainCanvasLoader canvasType="community" canvasId={canvasId} />
    </div>
  )
}
