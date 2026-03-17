# ============================================================
# run_test.ps1 — Full Test #1 Launcher (Windows, no WSL)
# Starts LiveKit + Agent + Token Server + Frontend
# ============================================================

$ErrorActionPreference = "Stop"
$ROOT_DIR = (Get-Item $PSScriptRoot).Parent.FullName

Write-Host ""
Write-Host "============================================================"
Write-Host "  Kassel Academy — Voice Avatar System"
Write-Host "  Test #1: gpt-4o-realtime-mini + Simli"
Write-Host "============================================================"
Write-Host ""

# Step 1 — Check .env
$envPath = Join-Path $ROOT_DIR ".env"
if (-not (Test-Path $envPath)) {
    Write-Host "  .env not found. Run: cp .env.example .env  and fill in your keys." -ForegroundColor Red
    exit 1
}
Write-Host "  .env found" -ForegroundColor Green

# Step 2 — Start LiveKit (Docker)
Write-Host ""
Write-Host "  Starting LiveKit server (self-hosted)..."
$configFile = Join-Path $ROOT_DIR "config\livekit.yaml"
if (Get-Command docker -ErrorAction SilentlyContinue) {
    $existing = docker ps -a -q -f "name=kassel-livekit" 2>$null
    if ($existing) {
        docker start kassel-livekit 2>$null
        Write-Host "  LiveKit container started" -ForegroundColor Green
    } else {
        docker run -d `
            --name kassel-livekit `
            -p 7880:7880 `
            -p 7881:7881/tcp `
            -p 50000-50100:50000-50100/udp `
            -v "${configFile}:/etc/livekit.yaml" `
            livekit/livekit-server:latest `
            --config /etc/livekit.yaml --dev
        Write-Host "  LiveKit running on ws://localhost:7880" -ForegroundColor Green
    }
} else {
    Write-Host "  Docker not found. Install Docker Desktop or start LiveKit manually." -ForegroundColor Yellow
}
Start-Sleep -Seconds 3

# Step 3 — Start Agent + Token Server (new window)
Write-Host ""
Write-Host "  Starting LiveKit Agent (new window)..."
$agentDir = Join-Path $ROOT_DIR "agent"
$venvPython = Join-Path $agentDir ".venv\Scripts\python.exe"
$venvActivate = Join-Path $agentDir ".venv\Scripts\Activate.ps1"

if (-not (Test-Path (Join-Path $agentDir ".venv"))) {
    Write-Host "  Creating agent venv..."
    Set-Location $agentDir
    python -m venv .venv
    Set-Location $ROOT_DIR
}

$agentCmd = @"
cd '$agentDir'
. '.venv\Scripts\Activate.ps1'
pip install -q -r requirements.txt
cd '$ROOT_DIR'
`$env:PYTHONPATH = 'agent'
Start-Process -FilePath 'python' -ArgumentList 'agent/token_server.py' -WindowStyle Hidden -WorkingDirectory '$ROOT_DIR'
Start-Sleep -Seconds 1
python agent/agent.py start
"@

Start-Process powershell -ArgumentList "-NoExit", "-Command", $agentCmd
Write-Host "  Agent window opened" -ForegroundColor Green
Start-Sleep -Seconds 4

# Step 4 — Start Frontend (new window)
Write-Host ""
Write-Host "  Starting Frontend (new window)..."
$frontendDir = Join-Path $ROOT_DIR "frontend"
Set-Location $frontendDir
npm install --silent 2>$null
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$frontendDir'; npm run dev"
Set-Location $ROOT_DIR
Start-Sleep -Seconds 3

Write-Host ""
Write-Host "============================================================"
Write-Host "  ALL SERVICES RUNNING"
Write-Host ""
Write-Host "  Frontend:    http://localhost:5173"
Write-Host "  Token API:   http://localhost:8080/token"
Write-Host "  LiveKit:     ws://localhost:7880"
Write-Host "  Logs:        .\logs\benchmark_*.jsonl"
Write-Host "============================================================"
Write-Host ""
Write-Host "Open http://localhost:5173 in your browser to start."
Write-Host "Close the Agent and Frontend PowerShell windows to stop them."
Write-Host "Stop LiveKit:  docker stop kassel-livekit"
Write-Host ""
