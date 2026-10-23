'use client'

import { useEffect, useRef, useState } from 'react'
import { FileCode2, FileUp, Pause, Play, Square, Clock3, ShieldAlert, CheckCircle2 } from 'lucide-react'
import { EmergencyStop } from '@/components/emergency-stop'
import { DisconnectedNotice } from '@/components/disconnected-notice'
import { usePrinter } from '@/lib/printer-store'
import { GCODE_JOB_STATE_LABELS, JOB_ACTIVE_STATES } from '@/lib/printer-types'
import { formatSdElapsed } from '@/lib/sd-print-report'

export function ProgramaScreen() {
  const { connection, job, jobElapsedSeconds, loadProgram, startProgram, pauseProgram, resumeProgram, cancelProgram, emergencyStopActive, sdPrint } = usePrinter()
  const fileInput = useRef<HTMLInputElement>(null)
  const [processing, setProcessing] = useState(false)
  const [preview, setPreview] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [confirmCancel, setConfirmCancel] = useState(false)
  useEffect(() => { if (!JOB_ACTIVE_STATES.has(job.state)) setConfirmCancel(false) }, [job.state])

  const busy = JOB_ACTIVE_STATES.has(job.state)
  const canStart = connection === 'connected' && !emergencyStopActive && !busy && !sdPrint.active && !sdPrint.paused && ['ready', 'cancelled', 'completed'].includes(job.state)
  const [rateTick, setRateTick] = useState(0)
  useEffect(() => {
    if (!busy) return
    const timer = window.setInterval(() => setRateTick(n => n + 1), 1000)
    return () => window.clearInterval(timer)
  }, [busy])
  void rateTick

  const chooseFile = async (file?: File) => {
    if (!file || busy) return
    setProcessing(true); setError(null)
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error('Archivo mayor que 20 MB. Dividí el programa para transmitirlo desde Chrome.')
      const text = await file.text()
      loadProgram(file.name, file.size, text)
      setPreview(text.split(/\r?\n/).filter(Boolean).slice(0, 100))
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo leer el archivo') }
    finally { setProcessing(false); if (fileInput.current) fileInput.current.value = '' }
  }
  const pct = job.progress || 0
  const finished = job.state === 'completed'

  return <div className="flex h-full min-h-0 flex-col gap-3">
    <DisconnectedNotice />
    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="flex items-center gap-2 text-lg font-semibold"><FileCode2 className="size-5 text-primary"/>Programa</h2>
          <p className="text-xs text-muted-foreground">Control de G-code por USB · Archivo local · Sin Wi-Fi</p></div>
        <input ref={fileInput} type="file" accept=".gcode,.gco,.gc,.ngc,.txt" hidden onChange={e => { void chooseFile(e.target.files?.[0]) }}/>
        <button type="button" onClick={() => fileInput.current?.click()} disabled={busy || processing}
          className="flex items-center gap-2 rounded-xl border border-border bg-panel px-4 py-2.5 text-sm font-semibold hover:border-primary/40 disabled:opacity-40">
          <FileUp className="size-4"/> {processing ? 'Analizando…' : 'Abrir archivo'}</button>
      </div>

      <div className="rounded-xl border border-border bg-background/60 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1"><div className="text-[11px] uppercase tracking-wide text-muted-foreground">Archivo seleccionado</div>
            <p className="mt-1 break-all font-mono text-sm font-semibold">{job.fileName || 'Ningún programa cargado'}</p>
            <p className="mt-1 text-xs text-muted-foreground">{job.fileName ? `${(job.fileSize/1024).toFixed(1)} KB · ${job.totalCommands.toLocaleString('es-AR')} comandos` : 'El archivo se queda en esta computadora, no se envía a Cloudflare.'}</p>
          </div>
          <span className={`shrink-0 rounded-full border px-3 py-1 text-xs ${finished ? 'border-primary/40 text-primary' : 'border-border text-muted-foreground'}`}>
            {finished && <CheckCircle2 className="mr-1 inline size-3"/>}{GCODE_JOB_STATE_LABELS[job.state]}
          </span>
        </div>
        <div className="mt-5 flex items-baseline justify-between"><span className="text-sm text-muted-foreground">Progreso confirmado por Marlin</span>
          <span className="text-2xl font-bold tabular-nums">{pct.toFixed(1)}%</span></div>
        <div role="progressbar" aria-label="Comandos recibidos y confirmados" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} className="mt-2 h-3 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-[width] duration-200" style={{ width: `${pct}%` }}/></div>
        <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
          <span>{job.acknowledgedCommands.toLocaleString('es-AR')} / {job.totalCommands.toLocaleString('es-AR')} comandos confirmados</span>
          <span className="flex items-center gap-1"><Clock3 className="size-3.5"/> {formatSdElapsed(jobElapsedSeconds)}</span></div>
        <p className="mt-3 text-[11px] text-muted-foreground">La confirmación «ok» no implica que el movimiento físico haya terminado. Al finalizar se espera además la respuesta de M400.</p>
      </div>

      {error && <p role="alert" className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger">{error}</p>}
      {job.error && <p role="alert" className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger">{job.error}</p>}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <button type="button" disabled={!canStart} onClick={() => { void startProgram() }} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:opacity-40"><Play className="size-4"/> Iniciar</button>
        <button type="button" disabled={job.state !== 'printing' && job.state !== 'paused'} onClick={() => job.state === 'paused' ? resumeProgram() : pauseProgram()}
          className="flex h-12 items-center justify-center gap-2 rounded-xl border border-border bg-panel px-3 text-sm font-semibold disabled:opacity-40">
          {job.state === 'paused' ? <Play className="size-4"/> : <Pause className="size-4"/>}{job.state === 'paused' ? 'Reanudar' : 'Pausar'}</button>
        <button type="button" disabled={!busy || job.state === 'cancelling'} onClick={() => setConfirmCancel(true)}
          className="col-span-2 flex h-12 items-center justify-center gap-2 rounded-xl border border-warning/50 bg-warning/10 px-3 text-sm font-semibold text-warning disabled:opacity-40 sm:col-span-1"><Square className="size-4"/> Cancelar trabajo</button>
      </div>
      {confirmCancel && <div className="rounded-xl border border-warning/50 bg-warning/10 p-3 text-sm">
        <p className="font-semibold">¿Cancelar el envío del programa?</p>
        <p className="my-2 text-xs text-muted-foreground">Dejará de enviar nuevas líneas y esperará a que Marlin termine los movimientos ya aceptados (M400). No es una parada instantánea.</p>
        <div className="flex gap-2"><button className="rounded-lg border border-warning px-3 py-2 text-xs" onClick={() => { cancelProgram(); setConfirmCancel(false) }}>Confirmar cancelación</button>
          <button className="rounded-lg border border-border px-3 py-2 text-xs" onClick={() => setConfirmCancel(false)}>Volver</button></div>
      </div>}
      <div className="rounded-xl border border-border bg-background/60 p-3">
        <div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-semibold">Vista previa del G-code</h3><span className="text-[11px] text-muted-foreground">Primeras 100 líneas</span></div>
        <div className="max-h-36 overflow-auto rounded-lg bg-background p-3 font-mono text-xs leading-5 text-muted-foreground sm:max-h-52">
          {preview.length ? preview.map((line, i) => <div key={i} className="flex gap-4"><span className="w-8 shrink-0 select-none text-right opacity-50">{i+1}</span><span className="whitespace-pre-wrap break-all">{line}</span></div>) : 'Abrí un archivo .gcode para previsualizar su contenido.'}
        </div>
      </div>
      <p className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/5 p-3 text-xs text-muted-foreground">
        <ShieldAlert className="size-4 shrink-0 text-warning"/> No cierres ni recargues Chrome durante la ejecución. Un corte del USB o un reinicio de la Mega interrumpe el trabajo; no existe reanudación automática segura de un archivo a mitad de impresión. La parada física sigue siendo obligatoria.
      </p>
    </div>
    <div className="shrink-0"><EmergencyStop compact/></div>
  </div>
}
