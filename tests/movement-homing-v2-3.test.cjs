const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const root = path.join(__dirname, '..', 'components')
const read = name => fs.readFileSync(path.join(root, name), 'utf8')

test('Movimiento conserva XYZ, pasos, XY, Z y homing a la derecha', () => {
  const s = read('movimiento-screen.tsx')
  for (const name of ['PositionDisplay','StepSelector','XyJogControl','ZJogControl','MovementHoming','EmergencyStop']) {
    assert.match(s, new RegExp('<' + name))
  }
  assert.ok(s.indexOf('<XyJogControl') < s.indexOf('<ZJogControl'))
  assert.ok(s.indexOf('<ZJogControl') < s.indexOf('<MovementHoming'))
})
test('Homing general, X, Y, Z: respeta los bloqueos y reutiliza home()', () => {
  const s = read('movement-homing.tsx')
  for (const target of ['all','x','y','z']) assert.ok(s.includes("target: '" + target + "'"))
  assert.match(s, /void home\(target\)/)
  assert.match(s, /!canOperate \|\| busyAction !== null \|\| homing/)
  assert.doesNotMatch(s, /navigator\.serial|sendCommand\(/)
})
test('Control no presenta homing; conserva ejecución y progreso USB/SD', () => {
  const s = read('programa-screen.tsx')
  assert.doesNotMatch(s, /HomingControls/)
  assert.match(s, /aria-label="Progreso de impresión"/)
  for (const action of ['startProgram','pauseProgram','resumeProgram','cancelProgram','startSdProgram','pauseSdProgram','resumeSdProgram','cancelSdProgram']) {
    assert.ok(s.includes(action))
  }
})
test('Parada de emergencia conserva confirmación de un segundo', () => {
  assert.match(read('movimiento-screen.tsx'), /<EmergencyStop compact\s*\/>/)
  assert.match(read('emergency-stop.tsx'), /Mantener presionado 1 segundo/)
})

test('El panel Z conserva ambos desplazamientos sin duplicar la lectura de posición', () => {
  const z = read('z-jog-control.tsx')
  assert.match(z, /jog\('z', 1\)/)
  assert.match(z, /jog\('z', -1\)/)
  assert.doesNotMatch(z, /formatMm|position\.z/)
})

test('Z y Homing ganan ancho frente al control XY', () => {
  const movement = read('movimiento-screen.tsx')
  assert.ok(movement.includes('grid-cols-[minmax(0,1fr)_clamp(5.2rem,16vw,11rem)_clamp(5.2rem,16vw,11rem)]'))
  assert.match(read('movement-homing.tsx'), /min-h-\[52px\]/)
})

test('Movimiento usa el ancho completo mientras las otras pestañas conservan su límite', () => {
  const app = read('printer-app.tsx')
  assert.match(app, /tab === 'movimiento'/)
  assert.match(app, /max-w-none flex-col px-4 py-3/)
  assert.match(app, /max-w-5xl flex-col px-4 py-3/)
})
