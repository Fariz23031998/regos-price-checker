# Builds installer\output\RegosPriceChecker-Setup.exe
# Requires this machine's Node.js, network access, and Inno Setup 6 (installed with winget if missing).

$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$installerRoot = $PSScriptRoot
$repoRoot = Split-Path -Parent $installerRoot
$staging = Join-Path $installerRoot "staging"
$output = Join-Path $installerRoot "output"
$winswVersion = "2.12.0"
$winswUrl = "https://github.com/winsw/winsw/releases/download/v$winswVersion/WinSW-x64.exe"

function Write-Utf8NoBom {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string]$Text
  )
  $utf8 = New-Object System.Text.UTF8Encoding $false
  [System.IO.File]::WriteAllText($Path, $Text, $utf8)
}

function Find-Iscc {
  $candidates = @(
    (Join-Path ${env:ProgramFiles(x86)} "Inno Setup 6\ISCC.exe"),
    (Join-Path $env:ProgramFiles "Inno Setup 6\ISCC.exe")
  )
  foreach ($candidate in $candidates) {
    if ($candidate -and (Test-Path -LiteralPath $candidate)) {
      return $candidate
    }
  }
  return $null
}

Write-Host "Building frontend and backend"
Push-Location $repoRoot
try {
  npm run build
  if ($LASTEXITCODE -ne 0) { throw "npm run build failed" }
} finally {
  Pop-Location
}

$nodeVersion = (& node -p "process.version").Trim()
if (-not $nodeVersion.StartsWith("v")) { throw "Unexpected Node version: $nodeVersion" }
Write-Host "Packaging Node $nodeVersion"

if (Test-Path -LiteralPath $staging) {
  Remove-Item -LiteralPath $staging -Recurse -Force
}
New-Item -ItemType Directory -Path $staging | Out-Null
New-Item -ItemType Directory -Path (Join-Path $output ".") -Force | Out-Null

$backendStage = Join-Path $staging "backend"
$frontendStage = Join-Path $staging "frontend\dist"
New-Item -ItemType Directory -Path $backendStage | Out-Null
Copy-Item -Path (Join-Path $repoRoot "backend\dist") -Destination (Join-Path $backendStage "dist") -Recurse
Copy-Item -Path (Join-Path $repoRoot "backend\package.json") -Destination (Join-Path $backendStage "package.json")
New-Item -ItemType Directory -Path (Split-Path -Parent $frontendStage) | Out-Null
Copy-Item -Path (Join-Path $repoRoot "frontend\dist") -Destination $frontendStage -Recurse

$depsRoot = Join-Path ([System.IO.Path]::GetTempPath()) "regos-price-checker-deps"
if (Test-Path -LiteralPath $depsRoot) {
  Remove-Item -LiteralPath $depsRoot -Recurse -Force
}
New-Item -ItemType Directory -Path $depsRoot | Out-Null
Copy-Item -Path (Join-Path $repoRoot "backend\package.json") -Destination (Join-Path $depsRoot "package.json")
Write-Host "Installing production dependencies"
Push-Location $depsRoot
try {
  npm install --omit=dev
  if ($LASTEXITCODE -ne 0) { throw "npm install failed" }
  # npm may skip the native install script until it is listed in allowScripts.
  Push-Location (Join-Path $depsRoot "node_modules\better-sqlite3")
  try {
    node "..\prebuild-install\bin.js"
    if ($LASTEXITCODE -ne 0) { throw "better-sqlite3 prebuild install failed" }
  } finally {
    Pop-Location
  }
} finally {
  Pop-Location
}
Copy-Item -Path (Join-Path $depsRoot "node_modules") -Destination (Join-Path $backendStage "node_modules") -Recurse
Remove-Item -LiteralPath $depsRoot -Recurse -Force

$nodeZipName = "node-$nodeVersion-win-x64.zip"
$nodeUrl = "https://nodejs.org/dist/$nodeVersion/$nodeZipName"
$nodeZip = Join-Path ([System.IO.Path]::GetTempPath()) $nodeZipName
$nodeExtract = Join-Path ([System.IO.Path]::GetTempPath()) "regos-price-checker-node"
Write-Host "Downloading $nodeUrl"
Invoke-WebRequest -Uri $nodeUrl -OutFile $nodeZip
if (Test-Path -LiteralPath $nodeExtract) {
  Remove-Item -LiteralPath $nodeExtract -Recurse -Force
}
Expand-Archive -LiteralPath $nodeZip -DestinationPath $nodeExtract
$nodeHome = Join-Path $nodeExtract "node-$nodeVersion-win-x64"
if (-not (Test-Path -LiteralPath (Join-Path $nodeHome "node.exe"))) {
  throw "Node archive did not contain node.exe"
}
Copy-Item -Path $nodeHome -Destination (Join-Path $staging "runtime") -Recurse
Remove-Item -LiteralPath $nodeZip -Force
Remove-Item -LiteralPath $nodeExtract -Recurse -Force

Write-Host "Checking better-sqlite3 with the packaged Node runtime"
Push-Location $backendStage
try {
  & (Join-Path $staging "runtime\node.exe") -e "require('better-sqlite3')"
  if ($LASTEXITCODE -ne 0) { throw "Packaged Node could not load better-sqlite3" }
} finally {
  Pop-Location
}

Write-Host "Downloading WinSW $winswVersion"
Invoke-WebRequest -Uri $winswUrl -OutFile (Join-Path $staging "RegosPriceChecker.exe")
Copy-Item -Path (Join-Path $installerRoot "RegosPriceChecker.xml") -Destination (Join-Path $staging "RegosPriceChecker.xml")
Copy-Item -Path (Join-Path $repoRoot "RegosPriceChecker.bat") -Destination (Join-Path $staging "RegosPriceChecker.bat")

Write-Utf8NoBom -Path (Join-Path $backendStage "config.json") -Text @"
{
    "host": "localhost",
    "port": 3050,
    "database": "C:/REGOS BASE/REGOS.FDB",
    "user": "SYSDBA",
    "password": "masterkey",
    "price_type": 1,
    "check_time": 60,
    "sqlite_path": "data/prices.sqlite",
    "listen_port": 3000
}

"@

Write-Utf8NoBom -Path (Join-Path $backendStage "settings.json") -Text @"
{
    "sync_time": 60,
    "name_font_size": 70,
    "price_font_size": 100,
    "background_color": "#000000",
    "name_font_color": "#03c2fc",
    "price_font_color": "#03c2fc",
    "update_screen_time": 15,
    "show_image": true,
    "price_formula_enabled": false,
    "price_formula": ""
}

"@

$iscc = Find-Iscc
if (-not $iscc) {
  Write-Host "Installing Inno Setup 6"
  winget install --id JRSoftware.InnoSetup -e --accept-package-agreements --accept-source-agreements
  if ($LASTEXITCODE -ne 0) { throw "winget could not install Inno Setup 6" }
  $iscc = Find-Iscc
}
if (-not $iscc) { throw "ISCC.exe was not found after installing Inno Setup 6" }

Write-Host "Compiling installer"
& $iscc (Join-Path $installerRoot "RegosPriceChecker.iss")
if ($LASTEXITCODE -ne 0) { throw "ISCC failed" }

$setup = Join-Path $output "RegosPriceChecker-Setup.exe"
if (-not (Test-Path -LiteralPath $setup)) { throw "Setup executable was not created" }
Write-Host "Created $setup"
