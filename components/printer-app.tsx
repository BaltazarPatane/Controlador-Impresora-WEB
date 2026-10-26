'use client'

import { useState } from 'react'
import { ToastProvider } from '@/components/toaster'
import { PrinterProvider } from '@/lib/printer-store'
import { MovimientoScreen } from '@/components/movimiento-screen'
import { ControlScreen } from '@/components/control-screen'
import { ProgramaScreen } from '@/components/programa-screen'
import { ConsolaScreen } from '@/components/consola-screen'
import { BottomNavigation, type TabId } from '@/components/bottom-navigation'

/**
 * Interfaz visual v3.4 adaptada a escritorio: columna de altura completa,
 *   active screen → bottom navigation.
 * The whole app never scrolls; only the console history scrolls internally.
 * Tab switching is UI-only — the PrinterProvider (transport, position, queue,
 * pause) lives above this and is never remounted when switching tabs.
 */
function AppShell() {
  const [tab, setTab] = useState<TabId>('movimiento')

  return (
    <div className="flex h-[100dvh] flex-col bg-background">
      <main className="min-h-0 flex-1 overflow-hidden">
        <div className="mx-auto flex h-full w-full max-w-5xl flex-col px-4 py-3">
          {tab === 'movimiento' && <MovimientoScreen />}
          {tab === 'control' && <ControlScreen />}
          <div className={tab === 'programa' ? 'flex h-full min-h-0 flex-col' : 'hidden'}><ProgramaScreen /></div>
          {tab === 'consola' && <ConsolaScreen />}
        </div>
      </main>

      <BottomNavigation active={tab} onChange={setTab} />
    </div>
  )
}

export function PrinterApp({ mode = 'wifi' }: { mode?: 'wifi' | 'usb' }) {
  return (
    <ToastProvider>
      <PrinterProvider>
        <AppShell />
      </PrinterProvider>
    </ToastProvider>
  )
}
