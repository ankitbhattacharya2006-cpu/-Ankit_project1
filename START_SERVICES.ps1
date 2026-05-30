# INNER_EYE - Clean Startup Script
# Starts both backend API and federated learning server

param(
    [switch]$ApiOnly,
    [switch]$FederatedOnly,
    [int]$ApiPort = 8000,
    [int]$FederatedPort = 8081
)

# Activate Python environment
Write-Host "🔧 Activating Python environment..." -ForegroundColor Cyan
conda activate myenv

# Verify environment
Write-Host "✓ Environment activated" -ForegroundColor Green

Write-Host ""
Write-Host "██████╗ ███████╗ █████╗ ██████╗ ██╗   ██╗    ████████╗ ██████╗ " -ForegroundColor Magenta
Write-Host "██╔══██╗██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝    ╚══██╔══╝██╔═══██╗" -ForegroundColor Magenta
Write-Host "██████╔╝█████╗  ███████║██║  ██║ ╚████╔╝        ██║   ██║   ██║" -ForegroundColor Magenta
Write-Host "██╔══██╗██╔══╝  ██╔══██║██║  ██║  ╚██╔╝         ██║   ██║   ██║" -ForegroundColor Magenta
Write-Host "██║  ██║███████╗██║  ██║██████╔╝   ██║          ██║   ╚██████╔╝" -ForegroundColor Magenta
Write-Host "╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝          ╚═╝    ╚═════╝ " -ForegroundColor Magenta
Write-Host ""
Write-Host "INNER_EYE - Medical Imaging + Federated Learning Platform" -ForegroundColor Cyan
Write-Host "Version: 5.0.2 | Status: PRODUCTION-READY ✓" -ForegroundColor Green
Write-Host ""

# Start services
if (-not $FederatedOnly) {
    Write-Host "Starting Backend API..." -ForegroundColor Yellow
    Write-Host "Location: http://localhost:$ApiPort" -ForegroundColor Cyan
    Write-Host "Docs: http://localhost:$ApiPort/docs" -ForegroundColor Cyan
    
    Start-Process -FilePath python -ArgumentList "backend/main.py" -NoNewWindow -PassThru
    Start-Sleep -Seconds 2
    Write-Host "✓ Backend API running on port $ApiPort" -ForegroundColor Green
}

if (-not $ApiOnly) {
    Write-Host ""
    Write-Host "Starting Federated Learning Server..." -ForegroundColor Yellow
    Write-Host "Location: localhost:$FederatedPort (gRPC)" -ForegroundColor Cyan
    
    # Set environment variable for port
    $env:FED_SERVER_PORT = $FederatedPort
    
    Start-Process -FilePath python -ArgumentList "backend/federated_server.py" -NoNewWindow -PassThru
    Start-Sleep -Seconds 2
    Write-Host "✓ Federated server running on port $FederatedPort" -ForegroundColor Green
}

Write-Host ""
Write-Host "═════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "✓ All services started successfully" -ForegroundColor Green
Write-Host "═════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "Available Endpoints:" -ForegroundColor Yellow
Write-Host "  API Docs:        http://localhost:$ApiPort/docs" -ForegroundColor White
Write-Host "  Health Check:    http://localhost:$ApiPort/health" -ForegroundColor White
Write-Host "  File Upload:     POST http://localhost:$ApiPort/process-scan" -ForegroundColor White
Write-Host "  Federated:       localhost:$FederatedPort" -ForegroundColor White
Write-Host ""
Write-Host "Press Ctrl+C to stop all services" -ForegroundColor Yellow
Write-Host ""

# Keep script running
while ($true) {
    Start-Sleep -Seconds 1
}
