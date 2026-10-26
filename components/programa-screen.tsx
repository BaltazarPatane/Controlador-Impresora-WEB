'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { FileCode2, FileUp, Pause, Play, Square, Clock3, ShieldAlert, Save, Download, RefreshCcw, HardDrive, MemoryStick, PencilLine, ChartNoAxesCombined, Boxes } from 'lucide-react'
import { EmergencyStop } from '@/components/emergency-stop'
import { DisconnectedNotice } from '@/components/disconnected-notice'
import { GcodeVisualizer } from '@/components/gcode-visualizer'
import { usePrinter } from '@/lib/printer-store'
import { GCODE_JOB_STATE_LABELS, JOB_ACTIVE_STATES } from '@/lib/printer-types'
import { formatSdElapsed, sdFraction } from '@/lib/sd-print-report'

type Section='file'|'progress'|'visualizer'
type Source='usb'|'sd'
const MAX_FILE = 20*1024*1024
const allowedFile=/\.(?:gcode|gco|gc|ngc|txt)$/i

export function ProgramaScreen() {
  const {
    connection, job, jobElapsedSeconds, loadProgram, startProgram, pauseProgram, resumeProgram, cancelProgram,
    emergencyStopActive, sdPrint, sdDetails, refreshSdDetails, sdFiles, sdBusy, sdError,
    refreshSdFiles, startSdProgram, pauseSdProgram, resumeSdProgram, cancelSdProgram,
  }=usePrinter()
  const picker=useRef<HTMLInputElement>(null)
  const [section,setSection]=useState<Section>('file')
  const [source,setSource]=useState<Source>('usb')
  const [fileName,setFileName]=useState('')
  const [draft,setDraft]=useState('')
  const [saved,setSaved]=useState<string|null>(null)
  const [selectedSd,setSelectedSd]=useState('')
  const [processing,setProcessing]=useState(false)
  const [error,setError]=useState<string|null>(null)
  const [cancelConfirm,setCancelConfirm]=useState(false)
  const [rateTick,setRateTick]=useState(0)
  const hostBusy=JOB_ACTIVE_STATES.has(job.state)
  const sdActive=sdPrint.active||sdPrint.paused
  const busy=hostBusy||sdActive
  const selectedSource:Source=hostBusy?'usb':sdActive?'sd':source
  const dirty=!!fileName && saved!==draft
  const connected=connection==='connected'&&!emergencyStopActive
  const canStartUsb=connected&&!busy&&!sdBusy&&!dirty&&!!saved&&['ready','completed','cancelled'].includes(job.state)
  const canStartSd=connected&&!busy&&!sdBusy&&!!selectedSd
  const sdPercent=sdActive?sdFraction(sdPrint.done,sdPrint.total):null
  const percent=selectedSource==='usb'?job.progress:sdPercent
  const currentFile=selectedSource==='usb'?(job.fileName||fileName):(sdDetails.filename||selectedSd)
  const elapsed=selectedSource==='usb'?formatSdElapsed(jobElapsedSeconds):sdActive?formatSdElapsed(sdDetails.elapsedSeconds):'—'
  const stateLabel=selectedSource==='usb'?GCODE_JOB_STATE_LABELS[job.state]:sdPrint.paused?'SD pausada':sdPrint.active?'Imprimiendo desde SD':sdBusy?'Preparando SD':'Lista para iniciar desde SD'
  useEffect(()=>{if(!busy)setCancelConfirm(false)},[busy])
  useEffect(()=>{if(!sdActive)return;void refreshSdDetails();const i=setInterval(()=>{void refreshSdDetails()},30000);return()=>clearInterval(i)},[sdActive,refreshSdDetails])
  useEffect(()=>{if(!busy)return;const i=setInterval(()=>setRateTick(x=>x+1),1000);return()=>clearInterval(i)},[busy])
  void rateTick

  const openFile=async(file?:File)=>{
    if(!file||hostBusy)return
    setProcessing(true);setError(null)
    try{
      if(!allowedFile.test(file.name))throw Error('Seleccioná un archivo .gcode, .gco, .gc, .ngc o .txt.')
      if(file.size>MAX_FILE)throw Error('El archivo supera el máximo de 20 MB.')
      const text=await file.text()
      loadProgram(file.name,file.size,text)
      setFileName(file.name);setDraft(text);setSaved(text);setSource('usb');setSection('file')
    }catch(e){setError(e instanceof Error?e.message:'No se pudo abrir el archivo.')}
    finally{setProcessing(false);if(picker.current)picker.current.value=''}
  }
  const saveChanges=()=>{
    setError(null)
    if(hostBusy||!fileName)return
    try{
      const bytes=new Blob([draft]).size
      if(bytes>MAX_FILE)throw Error('El archivo modificado supera los 20 MB.')
      loadProgram(fileName,bytes,draft)
      setSaved(draft) // The job is now updated and selected automatically.
    }catch(e){setError(e instanceof Error?e.message:'No se pudieron guardar los cambios.')}
  }
  const download=()=>{
    if(!fileName)return
    const url=URL.createObjectURL(new Blob([draft],{type:'text/plain;charset=utf-8'}))
    const a=document.createElement('a');a.href=url;a.download=fileName;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
  }
  const chooseSource=(mode:Source)=>{if(busy)return;setSource(mode);setCancelConfirm(false)}
  const progress=percent??0
  const tabOptions:[Section,string,typeof FileUp][]=[['file','Cargar archivo',FileUp],['progress','Progreso',ChartNoAxesCombined],['visualizer','Visualizador',Boxes]]

  return <div className="flex h-full min-h-0 flex-col gap-3">
    <DisconnectedNotice />
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden rounded-2xl border border-border bg-card p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="flex items-center gap-2 text-lg font-semibold"><FileCode2 className="size-5 text-primary"/>Programa</h2>
        <span className="rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground">{busy?stateLabel:'Listo para cargar o ejecutar'}</span></div>
      <div className="grid shrink-0 grid-cols-3 gap-1 rounded-xl bg-background/70 p-1" role="tablist" aria-label="Secciones de Programa">
        {tabOptions.map(([key,title,Icon])=><button key={key} role="tab" aria-selected={section===key} type="button" onClick={()=>setSection(key)}
          className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-2.5 text-xs font-semibold transition-colors sm:text-sm ${section===key?'bg-panel text-primary shadow-sm':'text-muted-foreground hover:text-foreground'}`}><Icon className="size-4 shrink-0"/>{title}</button>)}
      </div>

      {section==='file'&&<section role="tabpanel" className="min-h-0 flex-1 space-y-3 overflow-y-auto">
        <div className="flex flex-wrap items-center gap-2">
          <input ref={picker} type="file" hidden accept=".gcode,.gco,.gc,.ngc,.txt" onChange={e=>{void openFile(e.target.files?.[0])}}/>
          <button onClick={()=>picker.current?.click()} disabled={hostBusy||processing} className="flex items-center gap-2 rounded-xl bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-40"><FileUp className="size-4"/>{processing?'Abriendo…':'Abrir archivo'}</button>
          {dirty&&<button onClick={saveChanges} disabled={hostBusy} className="flex items-center gap-2 rounded-xl border border-success/60 bg-success/10 px-3 py-2.5 text-sm font-semibold text-success disabled:opacity-40"><Save className="size-4"/>Guardar cambios</button>}
          <button onClick={download} disabled={!fileName} className="flex items-center gap-2 rounded-xl border border-border bg-panel px-3 py-2.5 text-sm font-semibold disabled:opacity-40"><Download className="size-4"/>Guardar en mi PC</button>
        </div>
        <div className="rounded-xl border border-border bg-background/60 p-3">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Programa abierto</div>
          <p className="mt-1 break-all font-mono text-sm font-semibold">{fileName||'Todavía no se seleccionó ningún archivo'}</p>
          <p className="mt-1 text-xs text-muted-foreground">{fileName?`${new Blob([draft]).size.toLocaleString('es-AR')} bytes · ${draft.split(/\r?\n/).length.toLocaleString('es-AR')} líneas${dirty?' · Cambios sin guardar':''}`:'Podés abrir, editar y guardar una copia en esta computadora.'}</p>
        </div>
        <div className="flex min-h-[280px] flex-col rounded-xl border border-border bg-background/60 p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><h3 className="flex items-center gap-2 text-sm font-semibold"><PencilLine className="size-4 text-primary"/>Vista previa y editor</h3><span className="text-xs text-muted-foreground">Archivo completo, editable</span></div>
          <textarea aria-label="Editor del archivo G-code" spellCheck={false} disabled={!fileName||hostBusy} value={draft} onChange={e=>setDraft(e.target.value)}
            placeholder="Abrí un programa para ver y editar su contenido…" className="min-h-[300px] w-full flex-1 resize-y rounded-lg border border-border bg-background p-3 font-mono text-[12px] leading-[1.6] text-foreground outline-none focus-visible:border-primary disabled:opacity-50 sm:min-h-[380px]"/>
          <p className="mt-2 text-xs text-muted-foreground">«Guardar cambios» valida el G-code y vuelve a cargar automáticamente la versión modificada para imprimir y visualizar. «Guardar en mi PC» descarga el contenido mostrado. Durante la ejecución USB el editor queda bloqueado para no alterar el trabajo activo.</p>
        </div>
      </section>}

      {section==='progress'&&<section role="tabpanel" className="min-h-0 flex-1 space-y-3 overflow-y-auto">
        <div className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-background/60 p-1" role="group" aria-label="Origen del programa">
          {([['usb','Archivo de PC',HardDrive],['sd','Tarjeta SD',MemoryStick]] as const).map(([id,label,Icon])=><button key={id} type="button" disabled={busy&&selectedSource!==id} onClick={()=>chooseSource(id)}
            className={`rounded-md px-2 py-2.5 text-sm font-medium disabled:opacity-40 ${selectedSource===id?'bg-primary/15 text-primary':'text-muted-foreground hover:bg-panel'}`}><Icon className="mr-2 inline size-4"/>{label}</button>)}
        </div>
        {selectedSource==='sd'&&<div className="rounded-xl border border-border bg-background/60 p-3">
          <div className="mb-2 flex items-center justify-between gap-2"><h3 className="text-sm font-semibold">Archivos de la tarjeta SD</h3><button disabled={!connected||sdBusy||hostBusy} onClick={()=>{void refreshSdFiles()}} className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs disabled:opacity-40"><RefreshCcw className="size-4"/>Actualizar lista</button></div>
          <select aria-label="Seleccionar archivo SD" disabled={!connected||busy||sdBusy} value={selectedSd} onChange={e=>setSelectedSd(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground disabled:opacity-50">
            <option value="">{sdFiles.length?'Elegí un archivo…':'Consultá los archivos de la tarjeta SD'}</option>
            {sdFiles.map(f=><option key={f.name} value={f.name}>{f.name}{f.size!==null?` · ${(f.size/1024).toFixed(1)} KB`:''}</option>)}
          </select>
          <p className="mt-2 text-xs text-muted-foreground">La lista se lee de Marlin. También podés controlar una impresión SD que ya se haya iniciado desde la pantalla de la máquina.</p>
        </div>}
        <div className="rounded-xl border border-border bg-background/60 p-4">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Programa {selectedSource==='sd'?'de la SD':'de la computadora'}</div>
          <p className="mt-1 break-all font-mono text-sm font-semibold">{currentFile||'Ningún programa seleccionado'}</p>
          <p className="mt-1 text-xs text-muted-foreground">{stateLabel}</p>
          <div className="mt-5 flex items-baseline justify-between"><span className="text-sm text-muted-foreground">{selectedSource==='sd'?'Avance del archivo SD':'Comandos confirmados'}</span><span className="text-3xl font-bold tabular-nums">{percent===null?'—':`${percent.toFixed(1)} %`}</span></div>
          <div role="progressbar" aria-label="Progreso de impresión" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent??undefined} className="mt-2 h-3 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{width:`${progress}%`}}/></div>
          <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-muted-foreground"><span>{selectedSource==='sd'?(sdActive&&sdPrint.total?`${sdPrint.done.toLocaleString('es-AR')} / ${sdPrint.total.toLocaleString('es-AR')} bytes · M27`:'Sin contador SD activo'):`${job.acknowledgedCommands.toLocaleString('es-AR')} / ${job.totalCommands.toLocaleString('es-AR')} comandos`}</span><span className="flex items-center gap-1"><Clock3 className="size-3.5"/>{elapsed}</span></div>
        </div>
        <div className="grid grid-cols-2 gap-2"><div className="rounded-xl border border-border bg-background/60 p-3"><div className="text-xs text-muted-foreground">Tiempo transcurrido</div><p className="mt-1 text-lg font-semibold tabular-nums">{elapsed}</p><div className="mt-1 text-[11px] text-muted-foreground">{selectedSource==='sd'?'Informado por Marlin':'Medido por la aplicación'}</div></div>
          <div className="rounded-xl border border-border bg-background/60 p-3"><div className="text-xs text-muted-foreground">Tiempo restante</div><p className="mt-1 text-base font-semibold">No disponible</p><div className="mt-1 text-[11px] text-muted-foreground">Sin estimación fiable</div></div></div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <button disabled={selectedSource==='usb'?!canStartUsb:!canStartSd} onClick={()=>{ if(selectedSource==='usb')void startProgram();else void startSdProgram(selectedSd) }} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:opacity-40"><Play className="size-4"/>Iniciar</button>
          <button disabled={!connected|| (selectedSource==='usb'? !['printing','paused'].includes(job.state) : !sdActive||sdBusy)} onClick={()=>{
            if(selectedSource==='usb'){job.state==='paused'?resumeProgram():pauseProgram()}
            else {void(sdPrint.paused?resumeSdProgram():pauseSdProgram())}
          }} className="flex h-12 items-center justify-center gap-2 rounded-xl border border-border bg-panel px-3 text-sm font-semibold disabled:opacity-40">
            {selectedSource==='usb'&&job.state==='paused'||selectedSource==='sd'&&sdPrint.paused?<Play className="size-4"/>:<Pause className="size-4"/>}{selectedSource==='usb'&&job.state==='paused'||selectedSource==='sd'&&sdPrint.paused?'Reanudar':'Pausar'}</button>
          <button disabled={!connected||(selectedSource==='usb'?!hostBusy:!sdActive||sdBusy)} onClick={()=>setCancelConfirm(true)} className="col-span-2 flex h-12 items-center justify-center gap-2 rounded-xl border border-warning/50 bg-warning/10 px-3 text-sm font-semibold text-warning disabled:opacity-40 sm:col-span-1"><Square className="size-4"/>Cancelar</button>
        </div>
        {cancelConfirm&&<div className="rounded-xl border border-warning/50 bg-warning/10 p-3 text-sm"><p className="font-semibold">¿Cancelar el trabajo activo?</p><p className="my-2 text-xs text-muted-foreground">{selectedSource==='sd'?'Se solicitará a Marlin abortar la impresión SD (M524). Confirmá la detención en la máquina.':'Se detiene el envío desde Chrome y se espera M400. Los movimientos ya aceptados pueden continuar; no es una parada inmediata.'}</p><div className="flex gap-2"><button onClick={()=>{if(selectedSource==='usb')cancelProgram();else void cancelSdProgram();setCancelConfirm(false)}} className="rounded-lg border border-warning px-3 py-2 text-xs">Confirmar</button><button onClick={()=>setCancelConfirm(false)} className="rounded-lg border border-border px-3 py-2 text-xs">Volver</button></div></div>}
        {selectedSource==='sd'&&sdActive&&<button onClick={()=>{void refreshSdDetails()}} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs"><RefreshCcw className="size-4"/>Actualizar tiempo y archivo SD</button>}
        {sdError&&selectedSource==='sd'&&<p role="alert" className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">{sdError}</p>}
        {job.error&&selectedSource==='usb'&&<p role="alert" className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">{job.error}</p>}
        <p className="text-xs text-muted-foreground">Los porcentajes tienen distintos orígenes: SD = bytes que informa Marlin; PC = comandos aceptados con «ok». Ninguno garantiza que los movimientos físicos hayan terminado.</p>
      </section>}

      {section==='visualizer'&&<section role="tabpanel" className="flex min-h-0 flex-1 flex-col overflow-y-auto"><GcodeVisualizer content={saved} progress={selectedSource==='usb'?job.progress:(sdPercent??0)} source={selectedSource} active={busy}/></section>}
      {error&&<p role="alert" className="shrink-0 rounded-lg border border-danger/40 bg-danger/10 p-3 text-xs text-danger">{error}</p>}
      <p className="flex shrink-0 items-start gap-2 rounded-xl border border-warning/30 bg-warning/5 p-2.5 text-[11px] leading-relaxed text-muted-foreground"><ShieldAlert className="size-4 shrink-0 text-warning"/> No cierres la página ni desconectes el USB mientras se envía un archivo desde esta computadora. La cancelación no es una parada física inmediata. Para emergencias utilizá el pulsador cableado.</p>
    </div>
    <div className="shrink-0"><EmergencyStop compact/></div>
  </div>
}
