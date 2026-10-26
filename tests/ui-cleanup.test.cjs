const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.join(__dirname, '..')
const read = (p) => fs.readFileSync(path.join(root, 'components', p), 'utf8')

test('La interfaz principal no muestra encabezado superior', () => {
  assert.doesNotMatch(read('printer-app.tsx'), /<AppHeader\s*\/?\s*>/)
})

test('La emergencia conserva la pulsacion de un segundo cuando la Mega esta conectada', () => {
  const content = read('emergency-stop.tsx')
  assert.match(content, /if \(connection !== 'connected'\)/)
  assert.match(content, /Mantener presionado 1 segundo/)
  assert.match(content, /hold\.current\?\.begin\(\)/)
  assert.match(content, /emergencyStopActive/)
})

test('Ante una desconexion muestra estado y permite conectar USB', () => {
  const content = read('emergency-stop.tsx')
  assert.match(content, /Impresora desconectada/)
  assert.match(content, /Error de conexión/)
  assert.match(content, /Conectar USB/)
  assert.match(content, /connectPrinter\(\)/)
})

test('Elimina notas extensas sin desactivar la seguridad real', () => {
  const files = ['programa-screen.tsx', 'gcode-visualizer.tsx']
  for (const file of files) {
    const src = read(file)
    assert.doesNotMatch(src, /Los porcentajes tienen distintos orígenes/)
    assert.doesNotMatch(src, /La visualización es informativa/)
    assert.doesNotMatch(src, /No cierres la página ni desconectes el USB/)
  }
  assert.match(read('programa-screen.tsx'), /<EmergencyStop compact\s*\/>/)
})

test('No duplica el aviso de desconexion en ninguna de las cinco pestañas', () => {
  for (const file of ['movimiento-screen.tsx', 'movement-homing.tsx', 'programa-screen.tsx', 'consola-screen.tsx']) {
    assert.doesNotMatch(read(file), /DisconnectedNotice/)
  }
})
