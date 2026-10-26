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
