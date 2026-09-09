import type { PetWindowState } from './pet-window-policy.js'

/** Desktop 自有渲染器；函数序列化到隔离透明窗口，只调用有限 preload 接口。 */
export function renderPetWindow(): void {
  type Item = NonNullable<PetWindowState['notifications']>['items'][number]
  type Answer = { id: string; selected: string[]; custom?: string }
  const bridge = (window as unknown as { petWindow: { onState(fn: (state: PetWindowState) => void): () => void; ready(): void; pointer(value: boolean): void; move(dx: number, dy: number): void; command(value: unknown): Promise<void>; action(value: string): void } }).petWindow
  let state: PetWindowState | undefined, expanded = false, menu = false, latest = false, detail = '', error = ''
  const drafts = new Map<string, Answer[]>(), busy = new Set<string>()
  let pose = '', frame = 0, last = 0, motion = '', motionTimer: ReturnType<typeof setTimeout> | undefined
  let dragging: { x: number; y: number; startX: number; startY: number; moved: boolean } | undefined
  const anim: Record<string, [number, number[]]> = {
    idle: [0, [280, 110, 110, 140, 140, 320]], 'running-right': [1, [120,120,120,120,120,120,120,220]], 'running-left': [2, [120,120,120,120,120,120,120,220]],
    waving: [3, [140,140,140,280]], jumping: [4, [140,140,140,140,280]], failed: [5,[140,140,140,140,140,140,140,240]], waiting: [6,[150,150,150,150,150,260]], running: [7,[120,120,120,120,120,220]], review: [8,[150,150,150,150,150,280]],
  }
  const en: Record<string, string> = { '会话':'Conversations','关闭通知':'Dismiss notification','关闭本轮提醒，任务继续运行':'Dismiss this turn; the task keeps running','查看并处理':'View and respond','打开会话回复':'Open conversation to reply','停止当前轮次':'Stop current turn','最新优先':'Newest first','待处理优先':'Needs attention first','打个招呼':'Wave','跳一跳':'Jump','查看任务':'View task','宠物设置':'Pet settings','收起宠物':'Hide pet','恢复已关闭通知':'Restore dismissed notifications','拒绝':'Reject','仅允许一次':'Allow once','提交回答':'Submit answer','输入回答或补充说明':'Enter an answer or additional details','工具审批':'Tool approval','此工具需要你的批准。':'This tool needs your approval.','请打开会话处理此请求。':'Open the conversation to handle this request.','正在工作':'Working','等待你处理':'Waiting for you','任务出错了':'Task failed','已完成，待你查看':'Completed, ready for review' }
  const t = (text: string) => /^zh/i.test(state?.language ?? 'zh') ? text : en[text] ?? text
  const element = <K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = '') => { const node = document.createElement(tag); node.className = className; node.textContent = text; return node }
  const sprite = element('button', 'pet'); sprite.type = 'button'
  const image = element('div', 'sprite'); sprite.append(image)
  const panel = element('section', 'panel'); document.body.append(panel, sprite)
  const iconPaths: Record<string,string> = { close:'M4 4l8 8M12 4l-8 8', reply:'M6 3L2 7l4 4M2 7h7a4 4 0 0 1 0 8', stop:'M4 4h8v8H4z', question:'M6 5a2 2 0 1 1 3 2c-1 .5-1 1-1 2M8 12h.01', sort:'M2 4h12M2 8h9M2 12h6' }
  const button = (label: string, action: () => void, icon?: string) => {
    const node = element('button', icon ? 'icon' : '', icon ? '' : t(label)); node.type = 'button'; node.title = t(label); node.setAttribute('aria-label',t(label)); node.onclick = action
    if (icon) { const svg = document.createElementNS('http://www.w3.org/2000/svg','svg'); svg.setAttribute('viewBox','0 0 16 16'); const path = document.createElementNS(svg.namespaceURI,'path'); path.setAttribute('d',iconPaths[icon]); svg.append(path); node.append(svg) }
    return node
  }
  const identity = (item: Item) => `${item.id}:${item.token}:${item.request?.key ?? ''}`
  const run = async (value: unknown, key = 'global') => {
    if (busy.has(key)) return
    busy.add(key); error = ''; render()
    try { await bridge.command(value) } catch (e) { error = e instanceof Error ? e.message : String(e) }
    finally { busy.delete(key); render() }
  }
  const perform = (value: string) => { clearTimeout(motionTimer); motion = value; motionTimer = setTimeout(() => { motion = '' }, anim[value][1].reduce((sum, duration) => sum + duration, 0)) }
  const formFor = (item: Item) => {
    const request = item.request!, key = identity(item), base = { id:item.id,token:item.token,requestKey:request.key }
    const box = element('div','request')
    if (request.kind === 'approval') {
      box.append(element('strong','',request.toolName ?? t('工具审批')),element('p','',request.reason ?? t('此工具需要你的批准。')))
      box.append(button('拒绝',()=>void run({...base,type:'reject'},key)),button('仅允许一次',()=>void run({...base,type:'approve'},key)))
    } else if (request.questions) {
      const form = element('form')
      const answers: Answer[] = drafts.get(key) ?? request.questions.map(q=>({id:q.id,selected:[]})); drafts.set(key,answers)
      request.questions.forEach((q,index)=>{
        const group = element('fieldset'); group.disabled = busy.has(key); group.append(element('legend','',q.question))
        if(q.detail)group.append(element('pre','',q.detail))
        const answer = answers[index]
        const inputs: HTMLInputElement[] = []
        const custom = element('textarea'); custom.value = answer.custom ?? ''; custom.maxLength = 10000; custom.placeholder = t('输入回答或补充说明'); custom.setAttribute('aria-label',q.question)
        q.options?.forEach(option=>{
          const label = element('label'), input = element('input'); input.type=q.multiSelect?'checkbox':'radio'; input.name=`q${index}`; input.checked=answer.selected.includes(option.label); inputs.push(input)
          input.onchange=()=>{answer.selected=q.multiSelect?(input.checked?[...answer.selected,option.label]:answer.selected.filter(v=>v!==option.label)):[option.label];if(!q.multiSelect){answer.custom='';custom.value=''}}
          label.append(input,document.createTextNode(option.label)); if(option.description)label.append(element('small','',option.description));group.append(label)
        })
        custom.oninput=()=>{answer.custom=custom.value;if(!q.multiSelect){answer.selected=[];for(const input of inputs)input.checked=false}}
        group.append(custom);form.append(group)
      })
      const submit = element('button','',t('提交回答'));submit.type='submit';form.append(submit)
      form.onsubmit=event=>{event.preventDefault();void run({...base,type:'answer',answers:{answers}},key)};box.append(form)
    } else box.append(element('p','',t('请打开会话处理此请求。')))
    if(busy.has(key))for(const control of box.querySelectorAll<HTMLButtonElement>('button'))control.disabled=true
    return box
  }
  function render() {
    if(!state)return
    const size=state.config.size,height=size*208/192
    sprite.style.width=`${size}px`;sprite.style.height=`${height}px`;sprite.setAttribute('aria-label',state.pet.name)
    image.style.backgroundImage=`url("${state.pet.url}")`;image.style.backgroundSize=`${size*8}px ${height*(state.pet.version===2?11:9)}px`
    panel.style.bottom=`${height+42}px`;panel.style.maxHeight=`${Math.max(100,innerHeight-height-66)}px`;panel.replaceChildren()
    if(menu){
      panel.className='panel menu'
      panel.append(button('打个招呼',()=>{perform('waving');menu=false;render()}),button('跳一跳',()=>{perform('jumping');menu=false;render()}))
      if(state.notifications?.hidden)panel.append(button('恢复已关闭通知',()=>{menu=false;void run({type:'restore'})}))
      if(state.activity.sessionId)panel.append(button('查看任务',()=>{menu=false;bridge.action('open');render()}))
      panel.append(button('宠物设置',()=>{menu=false;bridge.action('settings');render()}),button('收起宠物',()=>bridge.action('hide')))
    } else {
      panel.className='panel'
      const items=state.notifications?.items??[]
      if(items.length>1){const toolbar=element('header');toolbar.append(button(`${t('会话')} ${items.length}`,()=>{expanded=!expanded;render()}));if(expanded)toolbar.append(button(latest?'最新优先':'待处理优先',()=>{latest=!latest;void run({type:'sort',latest})},'sort'));panel.append(toolbar)}
      for(const item of expanded?items:items.slice(0,1)){
        const key=identity(item), article=element('article'),card=element('div','card'),actions=element('div','actions')
        const dismiss=button('关闭本轮提醒，任务继续运行',()=>void run({type:'dismiss',id:item.id,token:item.token},key),'close');dismiss.classList.add('dismiss');article.append(dismiss)
        const link=button(item.title,()=>void run({type:'open',id:item.id,token:item.token},key));link.className='link';link.replaceChildren(element('strong','',item.title),element('span','',t(item.text)));card.append(link)
        actions.append(item.request?button('查看并处理',()=>{detail=detail===key?'':key;expanded=true;render()},'question'):button('打开会话回复',()=>void run({type:'open',id:item.id,token:item.token},key),'reply'))
        if(item.pose==='running')actions.append(button('停止当前轮次',()=>void run({type:'stop',id:item.id,token:item.token},key),'stop'))
        card.append(actions);article.append(card);if(item.request&&detail===key)article.append(formFor(item));panel.append(article)
        if(busy.has(key))for(const control of article.querySelectorAll<HTMLButtonElement>('button'))control.disabled=true
      }
    }
    if(error){const alert=element('p','error',error);alert.setAttribute('role','alert');panel.append(alert)}
    panel.hidden=panel.childElementCount===0
  }
  sprite.oncontextmenu=event=>{event.preventDefault();menu=!menu;render()}
  sprite.onpointerdown=event=>{if(event.button!==0)return;sprite.setPointerCapture(event.pointerId);dragging={x:event.screenX,y:event.screenY,startX:event.screenX,startY:event.screenY,moved:false};menu=false;render()}
  sprite.onpointermove=event=>{if(!dragging)return;const dx=event.screenX-dragging.x,dy=event.screenY-dragging.y;if(Math.hypot(event.screenX-dragging.startX,event.screenY-dragging.startY)>4)dragging.moved=true;if(dragging.moved){motion=dx<0?'running-left':'running-right';bridge.move(dx,dy)}dragging.x=event.screenX;dragging.y=event.screenY}
  sprite.onpointerup=()=>{const moved=dragging?.moved;dragging=undefined;motion='';if(!moved)perform('waving')}
  sprite.onpointercancel=()=>{dragging=undefined;motion=''}
  sprite.ondblclick=()=>perform('jumping')
  sprite.onkeydown=event=>{if(event.key==='Enter')perform('waving');if(event.key==='ContextMenu'||(event.shiftKey&&event.key==='F10')){event.preventDefault();menu=true;render()}}
  document.addEventListener('keydown',event=>{if(event.key==='Escape'){menu=false;detail='';render()}})
  document.addEventListener('pointermove',event=>bridge.pointer(!!(event.target as Element).closest('button,input,textarea,fieldset,.menu,.request')))
  document.addEventListener('pointerdown',event=>{if(menu&&!panel.contains(event.target as Node)&&!sprite.contains(event.target as Node)){menu=false;render()}})
  const reduced=matchMedia('(prefers-reduced-motion: reduce)')
  const tick=(time:number)=>{
    if(state){const next=motion||state.activity.pose;if(next!==pose){pose=next;frame=0;last=time}const [row,durations]=anim[pose]??anim.idle;if(!reduced.matches&&time-last>=durations[frame]){frame=(frame+1)%durations.length;last=time}image.style.backgroundPosition=`${-frame*state.config.size}px ${-row*state.config.size*208/192}px`}
    requestAnimationFrame(tick)
  }
  bridge.onState(value=>{state=value;const keys=new Set(value.notifications?.items.map(identity));for(const key of drafts.keys())if(!keys.has(key))drafts.delete(key);render()})
  requestAnimationFrame(tick);bridge.ready()
}
