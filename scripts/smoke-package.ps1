[CmdletBinding()]
param(
  [Parameter(Mandatory)]
  [string]$ApplicationPath
)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = 'Stop'

$resolvedApplication = (Resolve-Path -LiteralPath $ApplicationPath).Path
$tempBase = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath())
$tempRoot = Join-Path $tempBase ("dsh-desktop-smoke-$([guid]::NewGuid().ToString('N'))")
$userDataDir = Join-Path $tempRoot 'user-data'
$dshHome = Join-Path $tempRoot 'dsh-home'
New-Item -ItemType Directory -Path $userDataDir, $dshHome -Force | Out-Null
$previousDshHome = $env:DSH_HOME
$previousSmokeReadyFile = $env:DSH_DESKTOP_SMOKE_READY_FILE
$previousNpmOffline = $env:npm_config_offline
$env:DSH_HOME = $dshHome
$env:npm_config_offline = 'true'
$smokeReadyFile = Join-Path $userDataDir 'startup-ready'
$env:DSH_DESKTOP_SMOKE_READY_FILE = $smokeReadyFile
$application = $null
$bootstrapProcessId = $null
$startupTimeoutSeconds = 180
$unresponsiveSince = $null

try {
  $application = Start-Process -FilePath $resolvedApplication -ArgumentList "--user-data-dir=$userDataDir" -PassThru
  $deadline = (Get-Date).AddSeconds($startupTimeoutSeconds)
  $port = $null
  while ((Get-Date) -lt $deadline -and $null -eq $port) {
    $application.Refresh()
    if ($application.HasExited) { throw '打包应用在初始化期间意外退出。' }
    if ($application.MainWindowHandle -ne 0 -and -not $application.Responding) {
      if ($null -eq $unresponsiveSince) { $unresponsiveSince = Get-Date }
      if (((Get-Date) - $unresponsiveSince).TotalSeconds -ge 10) {
        throw '便携版首启窗口连续 10 秒未响应。'
      }
    } else {
      $unresponsiveSince = $null
    }
    $bootstrap = Get-CimInstance Win32_Process | Where-Object {
      $_.ParentProcessId -eq $application.Id -and $_.CommandLine -like '*bootstrap.mjs*'
    } | Select-Object -First 1
    if ($null -ne $bootstrap) {
      $bootstrapProcessId = $bootstrap.ProcessId
      $listeners = Get-NetTCPConnection -OwningProcess $bootstrapProcessId -State Listen -ErrorAction SilentlyContinue |
        Where-Object { $_.LocalAddress -eq '127.0.0.1' }
      foreach ($listener in $listeners) {
        try {
          $candidate = Invoke-WebRequest -Uri "http://127.0.0.1:$($listener.LocalPort)/" -UseBasicParsing -SkipHttpErrorCheck -TimeoutSec 2
          if ($candidate.StatusCode -eq 200 -or ($candidate.StatusCode -eq 401 -and $candidate.Content -match 'dsh web authentication required')) {
            $port = $listener.LocalPort
            break
          }
        } catch {
          # 监听端口可能仍在启动，也可能是 bootstrap 的其他内部端点。
        }
      }
    }
    if ($null -eq $port) { Start-Sleep -Milliseconds 500 }
  }
  if ($null -eq $port) { throw "打包应用在 $startupTimeoutSeconds 秒内未启动本机 HTTP 服务。" }

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
  } else {
    if ($page.StatusCode -ne 200) { throw "根页面返回 HTTP $($page.StatusCode)。" }
    $asset = [regex]::Match($page.Content, '(?:src|href)=["''](?<path>/[^"'']+\.(?:js|css))')
    if (-not $asset.Success) { throw '根页面未找到可验证的前端资源。' }
    $assetResponse = Invoke-WebRequest -Uri "$baseUrl$($asset.Groups['path'].Value)" -UseBasicParsing
    if ($assetResponse.StatusCode -ne 200) { throw "前端资源返回 HTTP $($assetResponse.StatusCode)。" }
  }

  $startupError = Join-Path $userDataDir 'startup-error.log'
  while ((Get-Date) -lt $deadline -and -not (Test-Path -LiteralPath $smokeReadyFile)) {
    if (Test-Path -LiteralPath $startupError) {
      throw "桌面应用启动失败：$((Get-Content -LiteralPath $startupError -Raw).Trim())"
    }
    $application.Refresh()
    if ($application.HasExited) { throw '桌面应用在报告启动完成前意外退出。' }
    Start-Sleep -Milliseconds 250
  }
  if (-not (Test-Path -LiteralPath $smokeReadyFile)) { throw "桌面应用未在 $startupTimeoutSeconds 秒内报告启动完成。" }

  $verifierPath = Join-Path (Split-Path -Parent $PSScriptRoot) 'dist\scripts\smoke-packaged-plugins.mjs'
  if (-not (Test-Path -LiteralPath $verifierPath -PathType Leaf)) { throw "未找到内置插件校验脚本：$verifierPath" }
  & node $verifierPath $dshHome
  if ($LASTEXITCODE -ne 0) { throw "内置插件校验失败，退出码：$LASTEXITCODE" }
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
  $env:npm_config_offline = $previousNpmOffline
  $resolvedTempRoot = [System.IO.Path]::GetFullPath($tempRoot)
  if ($resolvedTempRoot.StartsWith($tempBase, [System.StringComparison]::OrdinalIgnoreCase)) {
    Remove-Item -LiteralPath $resolvedTempRoot -Recurse -Force -ErrorAction SilentlyContinue
  }
  if ($bootstrapStillRunning) { throw "DSH 引导进程 $bootstrapProcessId 未在应用退出后结束。" }
}
