import {
  EMPTY_JOB, type GCodeJob, type JobPrinterTransport,
} from './printer-types'

/** Strictly host-streamed files. No backend, local file never leaves Chrome. */
export function parseGcode(text: string): string[] {
  const lines: string[] = []
  for (const original of text.replace(/^\uFEFF/, '').split(/\r\n|\n|\r/)) {
    const line = original.replace(/\([^)]*\)/g, '').split(';', 1)[0].trim()
    if (!line || line.startsWith('%') || line.startsWith('//')) continue
    // The C3/Marlin Mega config has a finite command buffer. Reserve bytes for N + checksum.
    if (!/^[\x20-\x7E]+$/.test(line)) throw new Error('El archivo contiene comandos con caracteres no ASCII.')
    if (line.length > 76) throw new Error(`Comando demasiado largo (${line.length} caracteres): ${line.slice(0, 32)}`)
    // Avoid accidental injection of pre-numbered protocol in an uploaded file.
    if (/^N\d+\b/i.test(line) || /^M110\b/i.test(line)) throw new Error('El archivo ya contiene números de línea N; exportalo como G-code sin numerar.')
    lines.push(line)
  }
  if (!lines.length) throw new Error('El archivo no contiene comandos ejecutables.')
  if (lines.length > 500000) throw new Error('Archivo demasiado grande para transmisión desde el navegador.')
  return lines
}

export class GCodeJobController {
  private lines: string[] = []
  private snapshot: GCodeJob = { ...EMPTY_JOB }
  private readonly listeners = new Set<(job: GCodeJob) => void>()
  private pauseRequested = false
  private cancelRequested = false
  private resumeWaiting: (() => void) | null = null
  private task: Promise<void> | null = null
  private generation = 0
  private started = 0
  private elapsedMs = 0
  private tickStart = 0

  constructor(private readonly serial: JobPrinterTransport) {}

  get job(): GCodeJob { return { ...this.snapshot } }
  subscribe(fn: (job: GCodeJob) => void): () => void {
    this.listeners.add(fn)
    fn(this.job)
    return () => this.listeners.delete(fn)
  }
  private set(patch: Partial<GCodeJob>) {
    this.snapshot = { ...this.snapshot, ...patch }
    for (const fn of this.listeners) fn(this.job)
  }
  get elapsedSeconds(): number {
    return Math.floor((this.elapsedMs + (this.tickStart ? Date.now() - this.tickStart : 0)) / 1000)
  }
  get active(): boolean { return !!this.task }

  load(name: string, bytes: number, content: string): void {
    if (this.active) throw new Error('No se puede cargar otro archivo mientras el trabajo está activo.')
    const lines = parseGcode(content)
    this.lines = lines
    this.elapsedMs = 0
    this.tickStart = 0
    this.set({ fileName: name, fileSize: bytes, totalCommands: lines.length, acknowledgedCommands: 0, progress: 0, state: 'ready', error: undefined })
  }

  async start(): Promise<void> {
    if (this.snapshot.state !== 'ready' && this.snapshot.state !== 'completed' && this.snapshot.state !== 'cancelled') throw new Error('Primero cargá un archivo válido.')
    if (this.task || !this.serial.isIdle() || this.serial.isNumberedProtocol()) throw new Error('Marlin está ocupado. Esperá a que termine la cola de comandos.')
    this.pauseRequested = false
    this.cancelRequested = false
    const token = ++this.generation
    this.elapsedMs = 0
    this.tickStart = 0
    this.set({ state: 'starting', progress: 0, acknowledgedCommands: 0, error: undefined })
    this.task = this.run(token)
    await this.task
  }

  private async run(token: number): Promise<void> {
    try {
      // Reset the numbering on both ends and await the real acknowledgement.
      await this.serial.sendTracked('M110 N0', { jobTag: 'm110' })
      if (token !== this.generation) return
      this.serial.enableNumberedProtocol()
      this.started = Date.now()
      this.tickStart = Date.now()
      this.set({ state: 'printing' })
      for (let i = 0; i < this.lines.length; i++) {
        if (token !== this.generation) throw new Error('Trabajo interrumpido')
        if (this.cancelRequested) break
        if (this.pauseRequested) {
          this.set({ state: 'waiting-for-motion-finish' })
          // Host pause: stop feeding lines; M400 drains real queued movements.
          await this.serial.sendTracked('M400', { jobTag: 'pause-m400' })
          this.stopClock()
          if (this.cancelRequested) break
          this.set({ state: 'paused' })
          await new Promise<void>(resolve => { this.resumeWaiting = resolve })
          this.resumeWaiting = null
          if (token !== this.generation) throw new Error('Trabajo interrumpido')
          if (this.cancelRequested) break
          this.pauseRequested = false
          this.tickStart = Date.now()
          this.set({ state: 'printing' })
        }
        if (this.cancelRequested) break
        await this.serial.sendTracked(this.lines[i], { jobTag: 'file', ackId: i })
        if (token !== this.generation) throw new Error('Trabajo interrumpido')
        this.set({ acknowledgedCommands: i + 1, progress: (i + 1) / this.lines.length * 100 })
      }
      this.set({ state: this.cancelRequested ? 'cancelling' : 'finalizing' })
      await this.serial.sendTracked('M400', { jobTag: this.cancelRequested ? 'cancel-m400' : 'final-m400' })
      this.stopClock()
      this.set({ state: this.cancelRequested ? 'cancelled' : 'completed' })
    } catch (e) {
      this.stopClock()
      this.set({ state: 'interrupted', error: e instanceof Error ? e.message : 'Se interrumpió la comunicación con Marlin' })
    } finally {
      this.serial.disableNumberedProtocol()
      this.task = null
      this.pauseRequested = false
      this.cancelRequested = false
      this.resumeWaiting = null
    }
  }

  private stopClock() {
    if (this.tickStart) this.elapsedMs += Date.now() - this.tickStart
    this.tickStart = 0
  }
  pause() {
    if (this.snapshot.state !== 'printing') return
    this.pauseRequested = true
    this.set({ state: 'pause-requested' })
  }
  resume() {
    if (this.snapshot.state !== 'paused') return
    this.set({ state: 'resuming' })
    this.resumeWaiting?.()
  }
  cancel() {
    if (!this.task) return
    this.cancelRequested = true
    this.pauseRequested = false
    this.set({ state: 'cancelling' })
    this.resumeWaiting?.()
  }
  interrupt(message: string) {
    if (!this.task) return
    this.generation++
    this.cancelRequested = true
    this.resumeWaiting?.()
    this.stopClock()
    this.set({ state: 'interrupted', error: message })
    // The in-flight sendTracked will reject on serial disconnect/emergency.
  }
}
