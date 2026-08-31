[CmdletBinding()]
param(
  [Parameter(Mandatory)]
  [string]$ApplicationPath
)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = 'Stop'

$resolvedApplication = (Resolve-Path -LiteralPath $ApplicationPath).Path
$installDir = Split-Path -Parent $resolvedApplication
$resourcesDir = Join-Path $installDir 'resources'
$bundledNode = Join-Path $resourcesDir 'node\node.exe'
$runtimeExtractor = Join-Path $resourcesDir 'extract-runtime.mjs'
if ((Test-Path -LiteralPath $bundledNode) -and (Test-Path -LiteralPath $runtimeExtractor)) {
  & $bundledNode $runtimeExtractor $installDir $resourcesDir
  if ($LASTEXITCODE -ne 0) { throw "随包运行时解压失败，退出码：$LASTEXITCODE" }
}
$tempBase = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath())
$tempRoot = Join-Path $tempBase ("dsh-desktop-smoke-$([guid]::NewGuid().ToString('N'))")
$userDataDir = Join-Path $tempRoot 'user-data'
$dshHome = Join-Path $tempRoot 'dsh-home'
New-Item -ItemType Directory -Path $userDataDir, $dshHome -Force | Out-Null
$previousDshHome = $env:DSH_HOME
$previousSmokeReadyFile = $env:DSH_DESKTOP_SMOKE_READY_FILE
$env:DSH_HOME = $dshHome
$smokeReadyFile = Join-Path $userDataDir 'startup-ready'
$env:DSH_DESKTOP_SMOKE_READY_FILE = $smokeReadyFile
$application = $null
$bootstrapProcessId = $null

try {
  $application = Start-Process -FilePath $resolvedApplication -ArgumentList "--user-data-dir=$userDataDir" -PassThru
  $deadline = (Get-Date).AddSeconds(60)
  $port = $null
  while ((Get-Date) -lt $deadline -and $null -eq $port) {
    $bootstrap = Get-CimInstance Win32_Process | Where-Object {
      $_.ParentProcessId -eq $application.Id -and $_.CommandLine -like '*bootstrap.mjs*'
    } | Select-Object -First 1
    if ($null -ne $bootstrap) {
      $bootstrapProcessId = $bootstrap.ProcessId
      $listener = Get-NetTCPConnection -OwningProcess $bootstrapProcessId -State Listen -ErrorAction SilentlyContinue |
        Where-Object { $_.LocalAddress -eq '127.0.0.1' } |
        Select-Object -First 1
      if ($null -ne $listener) { $port = $listener.LocalPort }
    }
    if ($null -eq $port) { Start-Sleep -Milliseconds 500 }
  }
  if ($null -eq $port) { throw '打包应用在 60 秒内未启动本机 HTTP 服务。' }

  $baseUrl = "http://127.0.0.1:$port"
  $page = Invoke-WebRequest -Uri "$baseUrl/" -UseBasicParsing -SkipHttpErrorCheck
  if ($page.StatusCode -eq 401) {
    if ($page.Content -notmatch 'dsh web authentication required') {
      throw '根页面返回了未知的 HTTP 401 响应。'
    }
    # DSH 0.1.2-alpha.2 会把随机启动 token 只交给桌面 WebContents；
    # 外部冒烟请求没有它时必须被拒绝，同时应用必须仍保持运行。
    $application.Refresh()
    if ($application.HasExited) { throw '根页面通过鉴权拒绝后桌面应用意外退出。' }
    $startupError = Join-Path $userDataDir 'startup-error.log'
    while ((Get-Date) -lt $deadline -and -not (Test-Path -LiteralPath $smokeReadyFile)) {
      if (Test-Path -LiteralPath $startupError) {
        throw "桌面应用启动失败：$((Get-Content -LiteralPath $startupError -Raw).Trim())"
      }
      $application.Refresh()
      if ($application.HasExited) { throw '桌面应用在报告启动完成前意外退出。' }
      Start-Sleep -Milliseconds 250
    }
    if (-not (Test-Path -LiteralPath $smokeReadyFile)) { throw '桌面应用未在 60 秒内报告启动完成。' }
  } else {
    if ($page.StatusCode -ne 200) { throw "根页面返回 HTTP $($page.StatusCode)。" }
    $asset = [regex]::Match($page.Content, '(?:src|href)=["''](?<path>/[^"'']+\.(?:js|css))')
    if (-not $asset.Success) { throw '根页面未找到可验证的前端资源。' }
    $assetResponse = Invoke-WebRequest -Uri "$baseUrl$($asset.Groups['path'].Value)" -UseBasicParsing
    if ($assetResponse.StatusCode -ne 200) { throw "前端资源返回 HTTP $($assetResponse.StatusCode)。" }
  }
} finally {
  if ($null -ne $application) {
    $application.Refresh()
    if (-not $application.HasExited) {
      Stop-Process -Id $application.Id -Force -ErrorAction SilentlyContinue
      $application.WaitForExit(10000) | Out-Null
    }
  }
  $bootstrapStillRunning = $false
  if ($null -ne $bootstrapProcessId) {
    $deadline = (Get-Date).AddSeconds(10)
    while ((Get-Date) -lt $deadline -and (Get-Process -Id $bootstrapProcessId -ErrorAction SilentlyContinue)) {
      Start-Sleep -Milliseconds 250
    }
    if (Get-Process -Id $bootstrapProcessId -ErrorAction SilentlyContinue) {
      $bootstrapStillRunning = $true
    }
  }
  $env:DSH_HOME = $previousDshHome
  $env:DSH_DESKTOP_SMOKE_READY_FILE = $previousSmokeReadyFile
  $resolvedTempRoot = [System.IO.Path]::GetFullPath($tempRoot)
  if ($resolvedTempRoot.StartsWith($tempBase, [System.StringComparison]::OrdinalIgnoreCase)) {
    Remove-Item -LiteralPath $resolvedTempRoot -Recurse -Force -ErrorAction SilentlyContinue
  }
  if ($bootstrapStillRunning) { throw "DSH 引导进程 $bootstrapProcessId 未在应用退出后结束。" }
}
