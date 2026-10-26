'use client'

import { PositionDisplay } from '@/components/position-display'
import { StepSelector } from '@/components/step-selector'
import { XyJogControl } from '@/components/xy-jog-control'
import { ZJogControl } from '@/components/z-jog-control'
import { MovementHoming } from '@/components/movement-homing'
import { EmergencyStop } from '@/components/emergency-stop'

/**
 * Movimiento tab — exclusively manual axis movement. A fixed-height flex column
 * that fits the viewport without page scrolling: connection warning, current
 * position, step selector, the XY + Z jog pads (which flex to fill the free
 * space), homing general e individual a la derecha, y emergencia al pie.
 * El seguimiento de programas USB/SD sigue en Control.
 */
export function MovimientoScreen() {
  return (
    <div className="flex h-full flex-col gap-3">
      <PositionDisplay compact />
      <StepSelector />
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,0.86fr)_clamp(5.2rem,18vw,7.2rem)_clamp(5.2rem,18vw,7.2rem)] gap-2 sm:gap-3">
        <XyJogControl />
        <ZJogControl />
        <MovementHoming />
      </div>
      <EmergencyStop compact />
    </div>
  )
}
