// Test runner for the standalone controller logic after the TS build.
// Requires only Node 22+ and the global/locally installed TypeScript compiler.
const test=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'ars-usb-'));
const compiler=path.resolve(__dirname,'../node_modules/.bin/tsc');
const tsc=fs.existsSync(compiler)?compiler:'tsc';
try {cp.execFileSync(tsc,['lib/gcode-job.ts','lib/printer-types.ts','--module','commonjs','--target','es2020','--outDir',tmp,'--skipLibCheck','--esModuleInterop','--pretty','false'],{cwd:path.resolve(__dirname,'..')})}catch(e){throw new Error('No se pudo compilar el protocolo: '+e.message)}
const {GCodeJobController,parseGcode}=require(path.join(tmp,'gcode-job.js'));
class MockSerial{constructor(){this.lines=[];this.numbered=false;this.onSend=null}isIdle(){return true}isNumberedProtocol(){return this.numbered}enableNumberedProtocol(){this.numbered=true}disableNumberedProtocol(){this.numbered=false}async sendTracked(cmd){this.lines.push(cmd);await new Promise(r=>setTimeout(r,0));this.onSend?.(cmd)}}
test('limpieza de comentarios y líneas',()=>assert.deepEqual(parseGcode(';hi\nG90 ;hi\nG1 X1 (hi)\nM114'),['G90','G1 X1','M114']));
test('rechaza numeración externa',()=>assert.throws(()=>parseGcode('N4 G0 X1*2'),/números de línea/));
test('cierra el planificador antes de marcar completado',async()=>{const serial=new MockSerial(),job=new GCodeJobController(serial);job.load('a',13,'G1 X1\nG1 X2');await job.start();assert.deepEqual(serial.lines,['M110 N0','G1 X1','G1 X2','M400']);assert.equal(job.job.state,'completed');assert.equal(job.job.progress,100)});
test('pausa, espera M400 y reanuda',async()=>{const s=new MockSerial(),j=new GCodeJobController(s);j.load('b',20,'G1 X1\nG1 X2\nG1 X3');s.onSend=c=>{if(c==='G1 X1')j.pause()};const p=j.start();await new Promise(r=>setTimeout(r,40));assert.equal(j.job.state,'paused');assert.deepEqual(s.lines,['M110 N0','G1 X1','M400']);j.resume();await p;assert.equal(j.job.state,'completed')});
test('cancelación controlada no transmite líneas restantes',async()=>{const s=new MockSerial(),j=new GCodeJobController(s);j.load('b',20,'G1 X1\nG1 X2\nG1 X3');s.onSend=c=>{if(c==='G1 X1')j.cancel()};await j.start();assert.equal(j.job.state,'cancelled');assert.deepEqual(s.lines,['M110 N0','G1 X1','M400'])});
