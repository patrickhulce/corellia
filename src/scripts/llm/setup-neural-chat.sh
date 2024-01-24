#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
ROOT_DIR="$SCRIPT_DIR/../../.."
MODELS_DIR="$ROOT_DIR/.data/llm/models"

cd "$ROOT_DIR"

mkdir -p "$MODELS_DIR/raw"

curl -o "$MODELS_DIR/raw/neural-chat-7b-v3-16k-q8_0.gguf" -L -C - "https://huggingface.co/NurtureAI/neural-chat-7b-v3-16k-GGUF/resolve/main/neural-chat-7b-v3-16k-q8_0.gguf"
# curl https://ollama.ai/install.sh | sh

cd "$MODELS_DIR"
echo "FROM ./raw/neural-chat-7b-v3-16k-q8_0.gguf" > Modelfile
ollama create neuralchat -f Modelfile

ollama run neuralchat 'Would you like to play a game?'
