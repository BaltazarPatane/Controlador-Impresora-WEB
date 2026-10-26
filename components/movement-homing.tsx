'use client'

import { Home, Loader2 } from 'lucide-react'
import { usePrinter } from '@/lib/printer-store'
import type { Axis } from '@/lib/printer-types'
import { cn } from '@/lib/utils'

type HomeTarget = Axis | 'all'

const TARGETS: { target: HomeTarget; label: string; accessible: string }[] = [
  { target: 'all', label: 'Todos', accessible: 'Homing general: referenciar todos los ejes' },
  { target: 'x', label: 'X', accessible: 'Homing individual del eje X' },
  { target: 'y', label: 'Y', accessible: 'Homing individual del eje Y' },
  { target: 'z', label: 'Z', accessible: 'Homing individual del eje Z' },
]

/**
 * Columna de homing junto a Z. Utiliza el controlador home() centralizado,
 * con los mismos bloqueos que el movimiento y el mismo puerto USB.
 */
export function MovementHoming({ className }: { className?: string }) {
  const { home, canOperate, busyAction, machineState } = usePrinter()
  const homing = machineState === 'homing'
  const disabled = !canOperate || busyAction !== null || homing

  return (
    <section
      className={cn('flex h-full min-h-0 min-w-0 flex-col gap-2', className)}
      aria-labelledby="home-movement-title"
    >
      <h2 id="home-movement-title" className="text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Homing
      </h2>
      <div className="grid min-h-0 flex-1 grid-rows-4 gap-1.5 rounded-2xl border border-border bg-panel p-1.5 sm:gap-2 sm:p-2.5">
        {TARGETS.map(({ target, label, accessible }) => {
          const busy = busyAction === 'home:' + target
          return (
            <button
              key={target}
              type="button"
              onClick={() => { void home(target) }}
              disabled={disabled}
              aria-label={accessible}
              title={accessible}
              className={cn(
                'flex min-h-[52px] min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl border font-semibold transition-colors',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                'active:translate-y-px disabled:pointer-events-none disabled:opacity-40',
                target === 'all'
                  ? 'border-primary/50 bg-primary/10 text-primary hover:bg-primary/20'
                  : 'border-border bg-muted/50 text-foreground hover:border-primary/40 hover:bg-muted',
                busy && 'border-primary bg-primary/20',
              )}
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : target === 'all' ? (
                <Home className="size-5" aria-hidden="true" />
              ) : (
                <span className="font-mono text-base font-bold">{label}</span>
              )}
              {target === 'all' && <span className="text-[9px] font-semibold leading-none sm:text-[10px]">Todos</span>}
            </button>
          )
        })}
      </div>
    </section>
  )
}
