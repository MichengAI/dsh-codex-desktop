/** 协议替身加真实 preload、IPC 和原生渲染；不要求安装宠物插件或相邻仓库。 */
import { app, BrowserWindow } from 'electron'
import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import assert from 'node:assert/strict'
import { installPetWindow } from '../dist/src/pet-window.js'
const root = fileURLToPath(new URL('../', import.meta.url))
app.setAppPath(root)
app.setPath('userData', process.env.DSH_PET_SMOKE_DIR)
const snapshot = { pet: { id: 'test', name: '测试', description: '', version: 2, source: 'builtin', url: '/dsh-codex-pet/asset/test' }, config: { selected: 'test', visible: true, size: 120, position: null }, language: 'en', notifications: { items: [{ id: 'a', token: '1', pose: 'running', title: '主会话', text: '正在工作', updatedAt: 1 }, { id: 'b', token: '2', pose: 'waiting', title: '审批', text: '等待你处理', updatedAt: 2, request: { kind: 'approval', key: 'q', toolName: 'test' } }], hidden: 0, activity: { pose: 'running', title: '主会话', text: '正在工作', sessionId: 'a' } } }
const html = `<!doctype html><script>
window.snapshot=${JSON.stringify(snapshot)};window.leases=0;window.commands=[];window.listeners=new Set();
window.publish=()=>{for(const listener of listeners)listener(snapshot)};
window.dshPet={version:1,getSnapshot:()=>structuredClone(snapshot),subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn)},acquireDisplay:()=>{leases++;let done=false;return()=>{if(!done){done=true;leases--}}},command:async value=>{if(value.type==='stop')throw Error('test rejection');commands.push(value)},updateConfig:async value=>{Object.assign(snapshot.config,value);publish()},openSettings:()=>{window.settingsOpened=true}};
</script>`
const server = createServer((request, response) => {
  if(request.url.startsWith('/dsh-codex-pet/asset/')) { if(!request.headers.cookie?.includes('pet-test=1')){response.writeHead(401);response.end();return} response.setHeader('Content-Type','image/png'); response.end(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6O9sAAAAASUVORK5CYII=','base64')); return }
  response.setHeader('Set-Cookie','pet-test=1; SameSite=Strict; Path=/'); response.setHeader('Content-Type','text/html; charset=utf-8'); response.end(html)
})
const until = async (check, label) => { const deadline=Date.now()+8000;while(Date.now()<deadline){if(await check())return;await new Promise(resolve=>setTimeout(resolve,30))}throw Error(`等待超时：${label}`) }
let source, dispose, revealed = false
async function main() {
try {
  await app.whenReady(); await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
  source=new BrowserWindow({show:false,webPreferences:{preload:join(root,'dist','src','dsh-view-preload.cjs'),sandbox:true,contextIsolation:true}})
  dispose=installPetWindow({source:()=>source.webContents,reveal:()=>{revealed=true}})
  await source.loadURL(`http://127.0.0.1:${server.address().port}`)
  const read=code=>source.webContents.executeJavaScript(code)
  const pet=()=>BrowserWindow.getAllWindows().find(value=>value!==source)
  await until(()=>read('leases===1'),'原生窗口接管')
  await until(()=>pet().isAlwaysOnTop(),'原生置顶');assert.equal(pet().webContents.getURL().startsWith('data:text/html'),true)
  assert.equal(await pet().webContents.executeJavaScript('document.querySelector(".link strong").textContent'),'主会话')
  assert.equal(await pet().webContents.executeJavaScript('document.querySelector(".link span").textContent'),'Working')
  await pet().webContents.executeJavaScript(`petWindow.command({type:'open',id:'a',token:'1'})`);assert.equal(revealed,true)
  assert.equal(await pet().webContents.executeJavaScript(`new Promise(resolve=>{const img=new Image();img.onload=()=>resolve(true);img.onerror=()=>resolve(false);img.src=getComputedStyle(document.querySelector('.sprite')).backgroundImage.slice(5,-2)})`),true)
  await pet().webContents.executeJavaScript(`document.querySelector('[aria-label="Stop current turn"]').click()`)
  await until(()=>pet().webContents.executeJavaScript(`document.querySelector('[role="alert"]')?.textContent.includes('test rejection')`),'错误回传')
  await pet().webContents.executeJavaScript(`document.querySelector('header button').click();document.querySelector('[aria-label="View and respond"]').click();[...document.querySelectorAll('.request button')].find(b=>b.textContent==='Allow once').click()`)
  await until(()=>read(`commands.some(c=>c.type==='approve'&&c.requestKey==='q')`),'审批回传')
  await read(`snapshot.notifications.items=[{id:'c',token:'3',pose:'waiting',title:'问题',text:'等待你处理',updatedAt:3,request:{kind:'question',key:'q2',questions:[{id:'question',question:'选择',options:[{label:'原文选项'}]}]}}];publish()`)
  await until(()=>pet().webContents.executeJavaScript(`document.querySelector('.link strong')?.textContent==='问题'`),'新问题渲染')
  await pet().webContents.executeJavaScript(`document.querySelector('[aria-label="View and respond"]').click();document.querySelector('input').click();document.querySelector('form').requestSubmit()`)
  await until(()=>read(`commands.some(c=>c.type==='answer'&&c.answers.answers[0].selected[0]==='原文选项')`),'回答保留原文')
  await assert.rejects(pet().webContents.executeJavaScript(`petWindow.command({type:'open',id:'c',token:'stale'})`))
  await read('snapshot.notifications.items=[];publish()')
  await until(()=>pet().webContents.executeJavaScript(`document.querySelector('.panel').hidden`),'无会话无气泡')
  pet().destroy();await until(()=>read('leases===0'),'意外关闭恢复页内')
  await read('publish()');await until(()=>read('leases===1'),'重新接管')
  pet().webContents.forcefullyCrashRenderer();await until(()=>read('leases===0'),'渲染崩溃恢复页内')
  await read('publish()');await until(()=>read('leases===1'),'崩溃后重新接管')
  await read('delete window.dshPet;dispatchEvent(new Event("dsh-pet-disposed"))')
  await until(async()=>await read('leases===0')&&!pet(),'卸载关闭原生窗口')
  await source.loadURL(source.webContents.getURL());await until(()=>read('leases===1'),'重载接管')
  await pet().webContents.executeJavaScript(`petWindow.action('hide')`)
  await until(async()=>await read('!snapshot.config.visible&&leases===0')&&!pet(),'隐藏同步')
  dispose();dispose=undefined
  console.log('Desktop pet smoke passed: native rendering, image CSP, notifications, commands, rejection, unload, reload, hide and lease recovery')
} catch(error){console.error(error);process.exitCode=1}
finally {dispose?.();for(const window of BrowserWindow.getAllWindows())window.destroy();server.close();app.exit(process.exitCode??0)}
}
void main()
