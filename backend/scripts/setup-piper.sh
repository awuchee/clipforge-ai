#!/usr/bin/env bash
# Downloads the Piper TTS binary and voice models used as the offline,
# zero-cost ad-voiceover fallback when OPENAI_API_KEY is not configured.
#
# Usage: bash backend/scripts/setup-piper.sh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PIPER_DIR="$ROOT_DIR/bin/piper"
VOICES_DIR="$PIPER_DIR/voices"
PIPER_VERSION="2023.11.14-2"

mkdir -p "$PIPER_DIR" "$VOICES_DIR"

case "$(uname -s)" in
  Linux*) ASSET="piper_linux_x86_64.tar.gz" ;;
  Darwin*) ASSET="piper_macos_x64.tar.gz" ;;
  MINGW*|MSYS*|CYGWIN*) ASSET="piper_windows_amd64.zip" ;;
  *) echo "Unsupported platform: $(uname -s)"; exit 1 ;;
esac

if [ ! -e "$PIPER_DIR/piper" ] && [ ! -e "$PIPER_DIR/piper.exe" ]; then
  echo "Downloading Piper ($ASSET)..."
  TMP="$(mktemp -d)"
  curl -sL -o "$TMP/$ASSET" "https://github.com/rhasspy/piper/releases/download/$PIPER_VERSION/$ASSET"
  case "$ASSET" in
    *.zip) unzip -q "$TMP/$ASSET" -d "$TMP" ;;
    *.tar.gz) tar -xzf "$TMP/$ASSET" -C "$TMP" ;;
  esac
  cp -r "$TMP/piper/." "$PIPER_DIR/"
  chmod +x "$PIPER_DIR/piper" 2>/dev/null || true
  rm -rf "$TMP"
else
  echo "Piper executable already present, skipping download."
fi

# Builds the HF path segments (e.g. amy/medium) for a voice name like "en_US-amy-medium".
download_voice_v2() {
  local name="$1" speaker="$2" quality="$3"
  if [ ! -f "$VOICES_DIR/$name.onnx" ]; then
    echo "Downloading voice $name..."
    curl -sL -o "$VOICES_DIR/$name.onnx" "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/$speaker/$quality/$name.onnx"
  fi
  if [ ! -f "$VOICES_DIR/$name.onnx.json" ]; then
    curl -sL -o "$VOICES_DIR/$name.onnx.json" "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/$speaker/$quality/$name.onnx.json"
  fi
}

download_voice_v2 "en_US-amy-medium" "amy" "medium"
download_voice_v2 "en_US-ryan-medium" "ryan" "medium"

echo "Piper TTS fallback ready: $PIPER_DIR"
