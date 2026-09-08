const { app, BrowserWindow, WebContentsView, nativeTheme } = require('electron')
const path = require('node:path')
app.setPath('userData', path.join(app.getPath('temp'), 'dsh-native-settings-preview'))
let window
app.whenReady().then(async () => {
  window = new BrowserWindow({ width: 1280, height: 820, title: 'DSH Native Backdrop Preview', backgroundColor: '#00000000', backgroundMaterial: 'mica' })
  const view = new WebContentsView({ webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, preload: path.resolve('dist/src/dsh-view-preload.cjs'), additionalArguments: ['--dsh-native-backdrop'] } })
  view.setBackgroundColor('#00000000')
  window.contentView.addChildView(view)
  const layout = () => { const [width,height] = window.getContentSize(); view.setBounds({x:0,y:0,width,height}) }
  layout();window.on('resize',layout)
  await view.webContents.loadURL('http://127.0.0.1:4318/')
  await view.webContents.executeJavaScript("document.getElementById('root').classList.add('dcu-root')")
  for (const theme of ['dark','light']) {
    nativeTheme.themeSource=theme
    await view.webContents.executeJavaScript(`document.body.toggleAttribute('data-ds-dark-theme',${theme === 'dark'})`)
    for (const [width,height] of [[1280,820],[1800,1000]]) {
      window.setSize(width,height)
      await new Promise(resolve=>setTimeout(resolve,250))
      const result=await view.webContents.executeJavaScript(`JSON.stringify({marker:document.documentElement.dataset.dshNativeBackdrop,html:getComputedStyle(document.documentElement).backgroundColor,root:getComputedStyle(document.getElementById('root')).backgroundColor,nav:getComputedStyle(document.querySelector('.dcu-settings-nav')).backgroundColor,main:getComputedStyle(document.querySelector('.dcu-settings-main')).backgroundColor})`)
      require('node:fs').appendFileSync(path.join(app.getPath('temp'),'dsh-native-preview-results.txt'),JSON.stringify({theme,width,height,result})+'\n')
    }
  }
  nativeTheme.themeSource='light'
  await view.webContents.executeJavaScript("document.body.removeAttribute('data-ds-dark-theme')")
  window.setSize(1280,820)
  window.show()
  window.focus()
})
app.on('window-all-closed',()=>app.quit())
