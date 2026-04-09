param(
  [int]$port = 3000
)

function Add-ToPathIfExists {
  param(
    [Parameter(Mandatory = $true)]
    [string]$PathToAdd
  )

  if (-not (Test-Path $PathToAdd)) {
    return
  }

  $currentPath = $env:PATH -split ';'
  if ($currentPath -contains $PathToAdd) {
    return
  }

  $env:PATH = "$PathToAdd;$env:PATH"
}

# Ensure MiKTeX and Strawberry Perl are available in this shell, even if VS Code
# was opened before installers updated user PATH.
Add-ToPathIfExists -PathToAdd "$env:LOCALAPPDATA\Programs\MiKTeX\miktex\bin\x64"
Add-ToPathIfExists -PathToAdd "C:\Program Files\MiKTeX\miktex\bin\x64"
Add-ToPathIfExists -PathToAdd "C:\Strawberry\perl\bin"
Add-ToPathIfExists -PathToAdd "C:\Strawberry\c\bin"

# Force MiKTeX to auto-install required packages so template compilation does
# not block on interactive package prompts.
$initexmf = Get-Command initexmf -ErrorAction SilentlyContinue
if ($initexmf) {
  try {
    & $initexmf.Source --set-config-value=[MPM]AutoInstall=1 | Out-Null
    Write-Host "MiKTeX AutoInstall is enabled"
  } catch {
    Write-Warning ("Failed to configure MiKTeX AutoInstall: {0}" -f $_)
  }
}

Write-Host "Stopping any process listening on port $port (if present)..."
try {
  $conns = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
} catch {
  $conns = $null
}
if ($conns) {
  $procIds = $conns | Select-Object -ExpandProperty OwningProcess -Unique | Where-Object { $_ -gt 4 }
  foreach ($ownedProcId in $procIds) {
    try {
      Write-Host "Killing PID ${ownedProcId}"
      Stop-Process -Id $ownedProcId -ErrorAction Stop -Force
    } catch {
      Write-Warning ("Failed to kill PID {0}: {1}" -f $ownedProcId, $_)
    }
  }
} else {
  Write-Host "No process found on port ${port}"
}

Write-Host "Starting Next.js dev server..."
npm run dev
