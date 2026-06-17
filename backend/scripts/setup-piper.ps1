# Downloads the Piper TTS binary and voice models used as the offline,
# zero-cost ad-voiceover fallback when OPENAI_API_KEY is not configured.
#
# Usage: powershell -File backend/scripts/setup-piper.ps1
$ErrorActionPreference = 'Stop'

$RootDir = Split-Path -Parent $PSScriptRoot
$PiperDir = Join-Path $RootDir 'bin\piper'
$VoicesDir = Join-Path $PiperDir 'voices'
$PiperVersion = '2023.11.14-2'

New-Item -ItemType Directory -Force -Path $PiperDir, $VoicesDir | Out-Null

$piperExe = Join-Path $PiperDir 'piper.exe'
if (-not (Test-Path $piperExe)) {
    Write-Host "Downloading Piper (piper_windows_amd64.zip)..."
    $tmp = Join-Path $env:TEMP "piper-setup-$(Get-Random)"
    New-Item -ItemType Directory -Force -Path $tmp | Out-Null
    $zipPath = Join-Path $tmp 'piper.zip'
    Invoke-WebRequest -Uri "https://github.com/rhasspy/piper/releases/download/$PiperVersion/piper_windows_amd64.zip" -OutFile $zipPath
    Expand-Archive -Path $zipPath -DestinationPath $tmp -Force
    Copy-Item -Path (Join-Path $tmp 'piper\*') -Destination $PiperDir -Recurse -Force
    Remove-Item -Recurse -Force $tmp
} else {
    Write-Host "Piper executable already present, skipping download."
}

function Get-Voice($Name, $Speaker, $Quality) {
    $onnxPath = Join-Path $VoicesDir "$Name.onnx"
    $jsonPath = Join-Path $VoicesDir "$Name.onnx.json"
    if (-not (Test-Path $onnxPath)) {
        Write-Host "Downloading voice $Name..."
        Invoke-WebRequest -Uri "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/$Speaker/$Quality/$Name.onnx" -OutFile $onnxPath
    }
    if (-not (Test-Path $jsonPath)) {
        Invoke-WebRequest -Uri "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/$Speaker/$Quality/$Name.onnx.json" -OutFile $jsonPath
    }
}

Get-Voice 'en_US-amy-medium' 'amy' 'medium'
Get-Voice 'en_US-ryan-medium' 'ryan' 'medium'

Write-Host "Piper TTS fallback ready: $PiperDir"
