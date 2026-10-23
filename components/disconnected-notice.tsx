'use client'
import { Cable } from 'lucide-react'
import { usePrinter } from '@/lib/printer-store'
export function DisconnectedNotice() {
  const { connection, emergencyStopActive, connectPrinter, webSerialSupported } = usePrinter()
  if (connection === 'connected' || emergencyStopActive) return null
  return <button type="button" onClick={() => void connectPrinter()}
    disabled={!webSerialSupported || connection === 'connecting'}
    className="flex w-full items-center gap-2 rounded-xl border border-warning/40 bg-warning/10 px-3 py-3 text-left text-xs text-warning disabled:opacity-60">
    <Cable className="size-4 shrink-0" />
    <span>{!webSerialSupported ? 'Chrome de escritorio con HTTPS es necesario para controlar el USB.' : connection === 'connecting' ? 'Conectando con Marlin…' : 'Arduino Mega sin conexión · Hacé clic para seleccionar el puerto USB. Cerrá Pronterface primero.'}</span>
  </button>
}
