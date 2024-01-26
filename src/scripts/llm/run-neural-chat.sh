#!/bin/bash

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
ROOT_DIR="$SCRIPT_DIR/../../.."
PROMPTS_DIR="$ROOT_DIR/.data/llm/prompts"

ollama run neuralchat<"$PROMPTS_DIR/$1.txt"
