param(
  [int]$port = 3000
)

Write-Host "Stopping any process listening on port $port (if present)..."
try {
  $conns = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
} catch {
  $conns = $null
}
if ($conns) {
  $procIds = $conns | Select-Object -ExpandProperty OwningProcess -Unique | Where-Object { $_ -gt 4 }
  foreach ($procId in $procIds) {
    try {
      Write-Host "Killing PID ${procId}"
      Stop-Process -Id ${procId} -ErrorAction Stop -Force
    } catch {
      Write-Warning "Failed to kill PID ${procId}: $_"
    }
  }
} else {
  Write-Host "No process found on port ${port}"
}

Write-Host "Starting Next.js dev server..."
npm run dev
