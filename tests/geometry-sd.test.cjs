const test=require('node:test'),assert=require('node:assert/strict'),os=require('node:os'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process')
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'ars-preview-'))
const root=path.resolve(__dirname,'..')
const compiler=fs.existsSync(path.join(root,'node_modules/.bin/tsc'))?path.join(root,'node_modules/.bin/tsc'):'tsc'
try {
  const typeDir=fs.mkdtempSync(path.join(os.tmpdir(),'ars-types-'))
  cp.execFileSync(compiler,['lib/gcode-geometry.ts','lib/sd-card.ts','lib/gcode-job.ts','lib/printer-types.ts','--module','commonjs','--target','es2020','--outDir',tmp,'--skipLibCheck','--esModuleInterop','--typeRoots',typeDir,'--pretty','false'],{cwd:root,stdio:'pipe'})
}catch(e){throw Error('No se pudo compilar el analizador G-code: '+String(e.stderr||e.message))}
const {buildToolpath}=require(path.join(tmp,'gcode-geometry.js'))
const {parseSdListLine,isSdListBegin,isSdListEnd,isSdFileOpened,isSdFileOpenFailed}=require(path.join(tmp,'sd-card.js'))
test('G0/G1 construyen segmentos con unidades reales',()=>{
  const p=buildToolpath('G21\nG90\nG0 X10 Y20\nG1 X30 Y20 Z1\nG91\nG1 X5')
  assert.equal(p.commands,6);assert.equal(p.segments.length,3)
  assert.deepEqual(p.segments[0].to,{x:10,y:20,z:0})
  assert.deepEqual(p.segments[2].to,{x:35,y:20,z:1})
})
test('G92 cambia el punto de referencia sin dibujar un movimiento',()=>{
  const p=buildToolpath('G92 X50\nG1 X60\nG91\nG1 X10')
  assert.equal(p.segments.length,2);assert.equal(p.segments[0].from.x,50);assert.equal(p.segments[1].to.x,70)
})
test('G2/G3 dibujan arcos XY con segmentos independientes',()=>{
  const p=buildToolpath('G90\nG0 X1 Y0\nG3 X0 Y1 I-1 J0\nG2 X1 Y0 I0 J-1')
  assert.ok(p.segments.length>7);assert.equal(Math.round(p.segments.at(-1).to.x),1)
})
test('Unidades pulgadas se convierten a milímetros',()=>assert.equal(buildToolpath('G20\nG1 X2').segments[0].to.x,50.8))
test('G28 no se presenta falsamente como un recorrido físico',()=>{
  const p=buildToolpath('G28 X\nG1 X10');assert.equal(p.segments.length,1);assert.ok(p.warnings.length)
})
test('M20 reconoce lista y descarta respuestas ajenas',()=>{
  assert.ok(isSdListBegin('Begin file list'));assert.ok(isSdListEnd('End file list'))
  assert.deepEqual(parseSdListLine('CASA.GCO 123456'),{name:'CASA.GCO',size:123456})
  assert.equal(parseSdListLine('ok'),null);assert.equal(parseSdListLine('G1 X20'),null)
  assert.equal(parseSdListLine('CASA.GCO;M112'),null)
})
test('M23 exige confirmación explícita de Marlin',()=>{
  assert.ok(isSdFileOpened('File opened: CASA.GCO Size: 1234'))
  assert.ok(isSdFileOpenFailed('open failed, File: NO.GCO.'))
  assert.ok(!isSdFileOpened('ok'))
})
