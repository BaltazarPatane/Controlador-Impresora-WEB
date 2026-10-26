/**
 * Preview of *tool trajectories*, not deposited-material geometry.
 * G0/G1 and XY G2/G3 are reconstructed respecting G90/G91, G20/G21 and G92.
 * Unsupported macros, homing, firmware-specific compensation and kinematics
 * cannot be predicted: a preview does not override Marlin or machine safety.
 */
import { parseGcode } from './gcode-job'
export type Point3 = { x: number; y: number; z: number }
export type PathSegment = { from: Point3; to: Point3; commandIndex: number; rapid: boolean }
export type Bounds3 = { min: Point3; max: Point3 }
export type Toolpath = { segments: PathSegment[]; bounds: Bounds3; commands: number; warnings: string[]; truncated: boolean }
const LIMIT = 180000
const MAX_ARC_STEPS = 144
const EPS = 1e-9
function numericWords(text: string): Record<string, number> {
  const values: Record<string, number> = {}
  for (const part of text.matchAll(/([A-Z])\s*([-+]?(?:\d+\.?\d*|\.\d+)(?:[Ee][-+]?\d+)?)/g)) {
    const value = Number(part[2]); if (Number.isFinite(value)) values[part[1]] = value
  }
  return values
}
const clone = (p: Point3): Point3 => ({ ...p })
function arcPoints(a: Point3, b: Point3, words: Record<string, number>, clockwise: boolean, units: number): Point3[] | null {
  let centerX: number, centerY: number
  if ('I' in words || 'J' in words) {
    centerX = a.x + (words.I ?? 0) * units
    centerY = a.y + (words.J ?? 0) * units
  } else if ('R' in words) {
    const r = Math.abs(words.R * units), dx = b.x - a.x, dy = b.y - a.y, chord = Math.hypot(dx, dy)
    if (chord < EPS || chord > 2*r+EPS || r<EPS) return null
    const h = Math.sqrt(Math.max(0, r*r - chord*chord/4))
    const mx = (a.x+b.x)/2, my=(a.y+b.y)/2, nx = -dy/chord, ny = dx/chord
    const candidates = [{x:mx+nx*h,y:my+ny*h},{x:mx-nx*h,y:my-ny*h}]
    const sweep = (c: {x:number;y:number}) => {
      const start = Math.atan2(a.y-c.y,a.x-c.x), end=Math.atan2(b.y-c.y,b.x-c.x)
      let angle = (end-start)%(2*Math.PI)
      if(clockwise && angle>=0) angle-=2*Math.PI
      if(!clockwise && angle<=0) angle+=2*Math.PI
      return angle
    }
    const selected = candidates.find(c=>words.R >= 0 ? Math.abs(sweep(c)) <= Math.PI+EPS : Math.abs(sweep(c)) >= Math.PI-EPS) ?? candidates[0]
    centerX=selected.x;centerY=selected.y
  } else return null
  const radius = Math.hypot(a.x-centerX,a.y-centerY)
  if(radius<EPS) return null
  const start=Math.atan2(a.y-centerY,a.x-centerX), end=Math.atan2(b.y-centerY,b.x-centerX)
  let delta=(end-start)%(Math.PI*2)
  if(clockwise && delta>=0) delta-=Math.PI*2
  if(!clockwise && delta<=0) delta+=Math.PI*2
  // Full turn when the endpoint coincides with the starting point and the arc has a center.
  if(Math.abs(delta)<EPS && Math.hypot(a.x-b.x,a.y-b.y)<EPS) delta=clockwise ? -Math.PI*2 : Math.PI*2
  const steps = Math.max(4,Math.min(MAX_ARC_STEPS,Math.ceil(Math.abs(delta)*radius/3)))
  const points:Point3[]=[]
  for(let k=1;k<=steps;k++) { const t=k/steps, angle=start+delta*t; points.push(k===steps ? clone(b) : { x:centerX+radius*Math.cos(angle), y:centerY+radius*Math.sin(angle), z:a.z+(b.z-a.z)*t }) }
  return points
}
export function buildToolpath(text: string): Toolpath {
  const commands=parseGcode(text)
  const segments:PathSegment[]=[]
  const bounds:Bounds3={min:{x:Infinity,y:Infinity,z:Infinity},max:{x:-Infinity,y:-Infinity,z:-Infinity}}
  const warnings:string[]=[]
  const add=(from:Point3,to:Point3,commandIndex:number,rapid:boolean)=>{
    if(segments.length>=LIMIT) return
    if(!(Object.values(from).every(Number.isFinite)&&Object.values(to).every(Number.isFinite)))return
    if(Math.hypot(to.x-from.x,to.y-from.y,to.z-from.z)<EPS)return
    segments.push({from:clone(from),to:clone(to),commandIndex,rapid})
    for(const p of [from,to]) for(const axis of ['x','y','z'] as const) { bounds.min[axis]=Math.min(bounds.min[axis],p[axis]);bounds.max[axis]=Math.max(bounds.max[axis],p[axis]) }
  }
  let pos:Point3={x:0,y:0,z:0},absolute=true, units=1, motion=1, plane=17
  let unsupported=0, arcFailures=0
  for(let i=0;i<commands.length;i++){
    if(segments.length>=LIMIT)break
    const line=commands[i].toUpperCase()
    const op=/^([GM])\s*(\d+(?:\.\d+)?)/.exec(line)
    const words=numericWords(op?line.slice(op[0].length):line)
    if(op && op[1]==='G'){
      const g=Number(op[2])
      if(g===90){absolute=true;continue}
      if(g===91){absolute=false;continue}
      if(g===20){units=25.4;continue}
      if(g===21){units=1;continue}
      if(g===17||g===18||g===19){plane=g;continue}
      if(g===92){for(const axis of ['x','y','z'] as const){if(axis.toUpperCase() in words)pos[axis]=words[axis.toUpperCase()]*units} continue}
      if(g===28||g===29||g===30){unsupported++;continue}
      if([0,1,2,3].includes(g))motion=g
      else { if(![4,10,11].includes(g))unsupported++;continue }
    } else if(op?.[1]==='M') continue
    else if(op) {unsupported++;continue}
    else if(!('X' in words||'Y' in words||'Z' in words))continue
    const next=clone(pos)
    for(const axis of ['x','y','z'] as const) {const key=axis.toUpperCase();if(key in words) next[axis]=absolute?words[key]*units:pos[axis]+words[key]*units}
    if((motion===2||motion===3) && plane===17){
      const pts=arcPoints(pos,next,words,motion===2,units)
      if(pts){let from=pos;for(const to of pts){add(from,to,i,false);from=to}}else {arcFailures++;add(pos,next,i,false)}
    }else {if(motion===2||motion===3){unsupported++} add(pos,next,i,motion===0)}
    pos=next
  }
  if(unsupported)warnings.push(`${unsupported} comandos o cambios de referencia no representables exactamente.`)
  if(arcFailures)warnings.push(`${arcFailures} arcos incompletos representados como líneas.`)
  const truncated=segments.length>=LIMIT
  if(truncated)warnings.push(`Se alcanzó el límite de ${LIMIT.toLocaleString('es-AR')} segmentos para proteger el navegador.`)
  if(!segments.length){bounds.min={x:0,y:0,z:0};bounds.max={x:0,y:0,z:0}}
  return {segments,bounds,commands:commands.length,warnings,truncated}
}
