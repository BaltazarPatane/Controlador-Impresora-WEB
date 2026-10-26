'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { RotateCcw, Eye, EyeOff, Orbit, ZoomIn, ZoomOut } from 'lucide-react'
import { buildToolpath, type Point3, type Toolpath } from '@/lib/gcode-geometry'

type Mode = 'live' | 'final'
type View = 'iso' | 'top'
const format = (n: number) => Number.isFinite(n) ? n.toFixed(1) : '—'

function paint(canvas: HTMLCanvasElement, path: Toolpath, ratio: number, mode: Mode, view: View, yaw: number, zoom: number, showRapids: boolean) {
  const rect = canvas.getBoundingClientRect()
  if (!rect.width || !rect.height) return
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  canvas.width = Math.round(rect.width * dpr)
  canvas.height = Math.round(rect.height * dpr)
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.scale(dpr, dpr)
  const w = rect.width, h = rect.height
  ctx.fillStyle = '#12181f'; ctx.fillRect(0,0,w,h)
  ctx.strokeStyle = '#27303a'; ctx.lineWidth = 1
  for(let x=0;x<=w;x+=32){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke()}
  for(let y=0;y<=h;y+=32){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke()}
  if(!path.segments.length){ctx.fillStyle='#9aa7b6';ctx.textAlign='center';ctx.font='14px sans-serif';ctx.fillText('No hay movimientos XYZ para representar',w/2,h/2);return}
  const c = {x:(path.bounds.min.x+path.bounds.max.x)/2,y:(path.bounds.min.y+path.bounds.max.y)/2,z:(path.bounds.min.z+path.bounds.max.z)/2}
  const cosine=Math.cos(yaw),sine=Math.sin(yaw)
  const project=(p:Point3):[number,number]=>{
    const x=p.x-c.x,y=p.y-c.y,z=p.z-c.z
    if(view==='top')return [x,-y]
    return [x*cosine-y*sine,(x*sine+y*cosine)*0.51-z*0.86]
  }
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity
  const corners=[] as Point3[]
  for(const x of [path.bounds.min.x,path.bounds.max.x])for(const y of [path.bounds.min.y,path.bounds.max.y])for(const z of [path.bounds.min.z,path.bounds.max.z])corners.push({x,y,z})
  for(const p of corners){const [x,y]=project(p);minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y)}
  const scale=Math.min((w-58)/Math.max(1,maxX-minX),(h-58)/Math.max(1,maxY-minY))*zoom
  const screen=(p:Point3):[number,number]=>{const [x,y]=project(p);return [w/2+x*scale,h/2+y*scale]}
  const count=path.segments.length
  // Any given G-code command may generate multiple segments (arcs). Command
  // confirmation is an ordering signal, not physical deposition completion.
  const done=Math.floor(path.commands*ratio)
  ctx.lineCap='round';ctx.lineJoin='round';ctx.lineWidth=1.45
  // One pass over paths. Avoid line batching across gaps (would create false segments).
  const stride=Math.max(1,Math.ceil(count/40000))
  for(let i=0;i<count;i+=stride){
    const seg=path.segments[i]
    if(seg.rapid && !showRapids)continue
    const executed=mode==='final'||seg.commandIndex<done
    ctx.strokeStyle=seg.rapid?(executed?'#b38447':'#635439'):(executed?'#48c79b':'#597b9a')
    ctx.globalAlpha=mode==='final'?0.9:executed?1:0.23
    ctx.lineWidth=seg.rapid?0.9:1.65
    const a=screen(seg.from),b=screen(seg.to)
    ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.stroke()
  }
  ctx.globalAlpha=1
  if(mode==='live'){
    let last:Point3|undefined
    for(let i=count-1;i>=0;i--){if(path.segments[i].commandIndex<done){last=path.segments[i].to;break}}
    if(last){const [x,y]=screen(last);ctx.beginPath();ctx.fillStyle='#63f0bd';ctx.arc(x,y,5,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#072e25';ctx.lineWidth=2;ctx.stroke()}
  }
  // Coordinate triad, for orientation.
  const origin={x:path.bounds.min.x,y:path.bounds.min.y,z:path.bounds.min.z}
  const span=Math.max(path.bounds.max.x-path.bounds.min.x,path.bounds.max.y-path.bounds.min.y,path.bounds.max.z-path.bounds.min.z,1)*0.13
  for(const [axis,color] of [['x','#ef6767'],['y','#77cc72'],['z','#69a8fa']] as const){
    const far={...origin,[axis]:origin[axis]+span}
    const a=screen(origin),b=screen(far)
    ctx.strokeStyle=color;ctx.globalAlpha=.9;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.stroke()
  }
  ctx.globalAlpha=1
  ctx.font='11px sans-serif';ctx.fillStyle='#a5b2c1';ctx.fillText(view==='top'?'Vista superior XY':'Vista isométrica XYZ',14,20)
}

export function GcodeVisualizer({ content, progress, source, active }: { content: string | null; progress: number; source: 'usb'|'sd'; active: boolean }) {
  const canvasRef=useRef<HTMLCanvasElement>(null)
  const [mode,setMode]=useState<Mode>('final')
  const [view,setView]=useState<View>('iso')
  const [yaw,setYaw]=useState(Math.PI/4)
  const [zoom,setZoom]=useState(1)
  const [showRapids,setShowRapids]=useState(false)
  const drag=useRef<{x:number;y:number}|null>(null)
  const path=useMemo(()=>{
    if(!content)return null
    try{ return buildToolpath(content) }
    catch(e){return e instanceof Error?e.message:'No se pudo analizar el G-code'}
  },[content])
  const drawing=path&&typeof path!=='string'?path:null
  const draw=useCallback(()=>{
    if(drawing&&canvasRef.current)paint(canvasRef.current,drawing,Math.max(0,Math.min(1,progress/100)),mode,view,yaw,zoom,showRapids)
  },[drawing,progress,mode,view,yaw,zoom,showRapids])
  // The streaming controller may receive dozens of acknowledgements a second.
  // Throttle canvas redraws without delaying any USB commands on the main thread.
  const latestDraw=useRef(draw)
  latestDraw.current=draw
  const repaintTimer=useRef<ReturnType<typeof setTimeout>|null>(null)
  const lastPaint=useRef(0)
  useEffect(()=>{
    if(repaintTimer.current!==null)return
    const delay=Math.max(0,220-(performance.now()-lastPaint.current))
    repaintTimer.current=setTimeout(()=>{
      repaintTimer.current=null
      lastPaint.current=performance.now()
      latestDraw.current()
    },delay)
  },[draw])
  useEffect(()=>()=>{if(repaintTimer.current!==null)clearTimeout(repaintTimer.current)},[])
  useEffect(()=>{if(!canvasRef.current)return;const ro=new ResizeObserver(()=>latestDraw.current());ro.observe(canvasRef.current);return()=>ro.disconnect()},[drawing])
  useEffect(()=>{if(active)setMode('live')},[active])
  const reset=()=>{setYaw(Math.PI/4);setZoom(1);setView('iso')}
  return <section className="flex min-h-0 flex-1 flex-col gap-3">
    <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="text-base font-semibold">Trayectoria del G-code</h3><p className="text-xs text-muted-foreground">Recorrido XYZ calculado · no representa volumen ni compensaciones del firmware</p></div>
      <div className="flex rounded-lg border border-border bg-background/60 p-1 text-xs"><button className={`rounded-md px-3 py-2 ${mode==='live'?'bg-primary/20 text-primary':''}`} onClick={()=>setMode('live')}>En ejecución</button><button className={`rounded-md px-3 py-2 ${mode==='final'?'bg-primary/20 text-primary':''}`} onClick={()=>setMode('final')}>Diseño final</button></div></div>
    {!drawing? <div className="flex min-h-60 flex-1 items-center justify-center rounded-xl border border-dashed border-border bg-background/40 p-6 text-center text-sm text-muted-foreground">{typeof path==='string'?path:'Cargá y guardá un archivo G-code en «Programa» para visualizar su trayectoria. Los archivos de la SD no se descargan automáticamente; podés abrir una copia local para consultarlos.'}</div>:
    <>
      <div className="relative min-h-[270px] flex-1 overflow-hidden rounded-xl border border-border bg-background" style={{touchAction:'none'}}>
        <canvas ref={canvasRef} aria-label="Visualización del recorrido G-code" className="block size-full"
          onPointerDown={e=>{drag.current={x:e.clientX,y:e.clientY};e.currentTarget.setPointerCapture(e.pointerId)}}
          onPointerMove={e=>{if(!drag.current)return;const dx=e.clientX-drag.current.x;drag.current={x:e.clientX,y:e.clientY};if(view==='iso')setYaw(v=>v+dx*.009)}}
          onPointerUp={()=>{drag.current=null}} onPointerCancel={()=>{drag.current=null}}
          onWheel={e=>{setZoom(v=>Math.max(.3,Math.min(5,v*(e.deltaY>0?.9:1.1))))}}/>
        <div className="pointer-events-none absolute bottom-3 left-3 rounded-lg bg-black/65 px-3 py-2 text-[11px] text-foreground">
          <div><span className="text-success">●</span> {mode==='live'?'Comandos confirmados':'Recorrido final'} <span className="ml-2 text-info">●</span> Pendiente</div>
          <div className="mt-1">{drawing.segments.length.toLocaleString('es-AR')} segmentos · {drawing.commands.toLocaleString('es-AR')} comandos</div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={()=>setView(v=>v==='iso'?'top':'iso')} className="rounded-lg border border-border px-3 py-2 text-xs"><Orbit className="mr-1 inline size-4"/>{view==='iso'?'Vista superior':'Vista 3D'}</button>
        <button onClick={()=>setShowRapids(s=>!s)} className="rounded-lg border border-border px-3 py-2 text-xs">{showRapids?<Eye className="mr-1 inline size-4"/>:<EyeOff className="mr-1 inline size-4"/>}{showRapids?'Ocultar rápidos':'Mostrar rápidos'}</button>
        <button onClick={reset} className="rounded-lg border border-border px-3 py-2 text-xs"><RotateCcw className="mr-1 inline size-4"/>Restablecer vista</button>
        <button onClick={()=>setZoom(v=>Math.max(.3,v/1.2))} title="Alejar" className="rounded-lg border border-border p-2"><ZoomOut className="size-4"/></button>
        <button onClick={()=>setZoom(v=>Math.min(5,v*1.2))} title="Acercar" className="rounded-lg border border-border p-2"><ZoomIn className="size-4"/></button>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{(['x','y','z'] as const).map(axis=><div key={axis} className="rounded-lg border border-border bg-background/60 px-3 py-2"><p className="text-xs text-muted-foreground">Eje {axis.toUpperCase()}</p><p className="text-sm font-semibold tabular-nums">{format(drawing.bounds.max[axis]-drawing.bounds.min[axis])} mm</p></div>)}<div className="rounded-lg border border-border bg-background/60 px-3 py-2"><p className="text-xs text-muted-foreground">Avance en vista</p><p className="text-sm font-semibold">{mode==='final'?'Completo':`${progress.toFixed(1)} %`}</p></div></div>
      {drawing.segments.length>40000&&<p className="text-xs text-warning">Para conservar fluidez en archivos grandes se simplifica el dibujo a una muestra de hasta 40.000 segmentos; el archivo transmitido a Marlin no se modifica.</p>}
      {drawing.warnings.map(w=><p key={w} className="text-xs text-warning">{w}</p>)}
      {source==='sd'&&active&&<p className="text-xs text-warning">En SD, el trazado progresivo es una referencia proporcional a bytes procesados, no una posición de herramienta confirmada. Para que corresponda al diseño, abrí una copia local del mismo archivo SD.</p>}
    </>}
  </section>
}
