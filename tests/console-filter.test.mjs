import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { visibleInNormalConsole, isCriticalMarlinOutput, normalConsoleEntry } from '../lib/console-log-policy.ts'

const cases = [
  ['TX','G28 X','operator',true],
  ['RX','ok','operator',true],
  ['RX','X:10.0 Y:20.0 Z:0.0','operator',true],
  ['TX','M115','startup',true],
  ['RX','Marlin 2.1.2.5','startup',true],
  ['TX','N23 G1 X0 Y20*33','file',false],
  ['RX','ok','file',false],
  ['TX','M27','internal',false],
  ['RX','Not SD printing','internal',false],
  ['RX','SD printing byte 123/600','internal',false],
  ['RX','echo:busy: processing','operator',false],
  ['RX','echo:busy: processing','file',false],
  ['RX','start','internal',true],
  ['RX','Error: Printer halted','file',true],
  ['RX','!! M112 kill() called','file',true],
  ['RX','Resend: 69','file',true],
  ['ERR','USB desconectado','internal',true],
  ['SYS','Programa iniciado','internal',true],
]
for (const [direction,content,origin,expected] of cases) {
  test(`${direction} [${origin}] ${content}`, () => {
    assert.equal(visibleInNormalConsole(direction,content,origin),expected)
  })
}
test('Alarmas críticas jamás se ocultan', () => {
  for (const msg of ['Error: MINTEMP triggered','Printer halted. kill() called','Warning: Endstop hit','Thermal Runaway','Heating failed','ALARM: emergency']) {
    assert.ok(isCriticalMarlinOutput(msg),msg)
  }
})
test('La decisión explícita de visibilidad controla el historial normal', () => {
  assert.equal(normalConsoleEntry({id:'1',timestamp:'00:00:00',direction:'RX',content:'ok',visibleInNormal:false}),false)
  assert.equal(normalConsoleEntry({id:'2',timestamp:'00:00:00',direction:'RX',content:'ok'}),true)
})
test('El transporte conserva el procesamiento real y el origen de cada comando',()=> {
  const src = readFileSync(new URL('../lib/web-serial-printer-transport.ts',import.meta.url),'utf8')
  assert.match(src,/this\.currentCommand\?\.consoleOrigin/)
  assert.match(src,/this\.emitQueue\(\{/)
  assert.match(src,/acked\.ackResolve\?\.\(\)/)
  assert.match(src,/this\.onJobEvent\?\.\(/)
  assert.match(src,/visibleInNormalConsole\(direction, content, origin\)/)
})
test('El sondeo SD es interno y se filtra sin impedir el seguimiento M27',()=>{
  const src = readFileSync(new URL('../lib/printer-store.tsx',import.meta.url),'utf8')
  assert.match(src,/sendCommand\('M27', \{ consoleOrigin: 'internal' \}\)/)
  assert.match(src,/SD printing byte/)
  assert.match(src,/recordConsoleEntry\(message\.entry\)/)
})
