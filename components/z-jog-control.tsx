'use client'

import { ArrowUp, ArrowDown } from 'lucide-react'
import { usePrinter } from '@/lib/printer-store'
import { cn } from '@/lib/utils'

export function ZJogControl({ className }: { className?: string }) {
  const { jog, canOperate, busyAction } = usePrinter()
  const disabled = !canOperate

  const btn =
    'flex flex-1 min-h-[44px] flex-col items-center justify-center rounded-xl border border-border bg-muted/50 font-semibold transition-colors hover:bg-muted hover:border-primary/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:translate-y-px active:bg-primary/15 active:border-primary/60 disabled:pointer-events-none disabled:opacity-40'

  return (
    <section className={cn('flex h-full flex-col gap-2', className)} aria-labelledby="z-title">
      <h2
        id="z-title"
        className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
      >
        Movimiento Z
      </h2>
      <div className="flex min-h-0 flex-1 flex-col gap-2 rounded-2xl border border-border bg-panel p-2.5">
        <button
          type="button"
          onClick={() => void jog('z', 1)}
          disabled={disabled}
          aria-label="Subir eje Z (Z positivo)"
          className={cn(btn, busyAction === 'jog:z:1' && 'border-primary/60 bg-primary/15')}
        >
          <ArrowUp className="size-5" aria-hidden="true" />
          <span className="font-mono text-sm">Z+</span>
        </button>

        <button
          type="button"
          onClick={() => void jog('z', -1)}
          disabled={disabled}
          aria-label="Bajar eje Z (Z negativo)"
          className={cn(btn, busyAction === 'jog:z:-1' && 'border-primary/60 bg-primary/15')}
        >
          <span className="font-mono text-sm">Z−</span>
          <ArrowDown className="size-5" aria-hidden="true" />
        </button>
      </div>
    </section>
  )
}
