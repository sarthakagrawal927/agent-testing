# Bonsai 2 27B local artifact

This directory contains the pinned PrismML macOS arm64 llama.cpp runtime and
the language-only Ternary Bonsai 2 27B `PTQ1_0` GGUF. It intentionally does not
contain the vision projector, MLX runtime, Open WebUI, or Jupyter dependencies.
See `PROVENANCE.json` for immutable revisions, URLs, sizes, and hashes.

## Server setup

Run from this directory, keeping the server on loopback and using a bounded
context. The caller may choose its own port and model alias:

```sh
RUNTIME="$PWD/runtime/llama-prism-b10709-9a9394a"
MODEL="$PWD/models/Ternary-Bonsai-2-27B-PTQ1_0.gguf"
"$RUNTIME/llama-server" \
  --model "$MODEL" \
  --alias bonsai-2-27b \
  --host 127.0.0.1 \
  --port 18794 \
  --ctx-size 8192 \
  --parallel 1 \
  --reasoning-budget 0 \
  --seed 42 \
  --jinja \
  --chat-template-kwargs '{"enable_thinking":false}'
```

The binary reports `0.2.0-dev (build 10709, commit 9a9394a89)` and supports
`--alias`, `--reasoning-budget`, `--parallel`, `--seed`, `--host`, `--port`,
`--ctx-size`, and `--model`. Installation did not start it or load the model.
Subsequent root-run probes are documented in `../../BONSAI.md`; use its launcher
for the full measured sampling/Metal profile and evidence capture.
