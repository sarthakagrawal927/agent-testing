# Local Bonsai text-helper experiment

Scope: a synthetic compatibility probe for Jev's selected-field text helper,
not a complete browser agent and not an application defect-detection result.
All inputs are synthetic; the password in the probe is a seeded fixture value.
No TypeSafe API request or paid text-model request is made by these commands.

## Measured screening — 20 September 2026

Mac M5 Pro, 48 GB RAM. Five repetitions per case; 25 requests per profile.
The downloaded weights are 5.95 GB. Both profiles completed all 25 exact-output
checks, including the five missing-information refusals, without a retry.

| Profile                                 | Median / observed p95 | Sampled peak server RSS | Prompt / output tokens |
| --------------------------------------- | --------------------- | ----------------------- | ---------------------- |
| Budget-only (reasoning still generated) | 4.907s / 8.943s       | 9.252 GB / 8.617 GiB    | 4,760 / 2,525          |
| Explicit template no-thinking           | 1.082s / 1.193s       | 7.305 GB / 6.803 GiB    | 3,860 / 215            |

The second profile is 4.54× faster by the pooled median, with 91.5% fewer
output tokens and 44.1% fewer total reported tokens. Calls remain 25 each.
Actual paid API spend is $0. API output contains reasoning in the first profile
despite `--reasoning-budget 0` and Jev's `reasoning.enabled:false`; the template
override removes it. This is a measured configuration compatibility issue, not
proof that reasoning should be disabled for harder tasks.

| Selected field | Budget-only median / p95 | No-thinking median / p95 |
| -------------- | ------------------------ | ------------------------ |
| Email          | 4.316s / 5.206s          | 1.082s / 1.547s          |
| Password       | 4.060s / 4.136s          | 1.108s / 1.183s          |
| Amount         | 8.887s / 8.968s          | 1.178s / 1.193s          |
| Search         | 4.889s / 4.994s          | 0.968s / 0.994s          |
| Missing value  | 6.693s / 6.812s          | 0.908s / 0.916s          |

Evidence: `artifacts/bonsai-typing-1789882390878` and
`artifacts/bonsai-typing-1789882598800`. Requests, complete responses, timings,
usage, exact-output verdicts and sampled RSS are retained. Startup receipts are
`artifacts/bonsai-server-1789882366200` (1.786s) and
`artifacts/bonsai-server-1789882579058` (1.289s); these are individual process
startups with potentially cached model files, not three disk-cold trials.
The model download took 4m08s, separately from inference. Both owned model
servers were stopped after their probes; the pinned artifacts remain installed.

Use no-thinking for the next Jev typing-helper trial. Do not select an overall
testing-stack winner or package a winner skill on these synthetic results.
Live TypeSafe integration, guarded paid-call accounting and full browser
journeys remain unexecuted.

## Reproduce isolated artifacts

Run from this experiment directory, on macOS arm64. No global dependencies,
vision projector, MLX, web UI, or Python environment are required.
Do not overwrite an existing download without inspecting it first.

```sh
mkdir -p tools/bonsai/models tools/bonsai/runtime
curl --fail --location --max-time 1200 \
  https://huggingface.co/prism-ml/Ternary-Bonsai-2-27B-gguf/resolve/6ed5e12bf84b7a63069882c91dd9e9218647d17b/Ternary-Bonsai-2-27B-PTQ1_0.gguf \
  --output tools/bonsai/models/Ternary-Bonsai-2-27B-PTQ1_0.gguf
curl --fail --location --max-time 120 \
  https://github.com/PrismML-Eng/llama.cpp/releases/download/prism-b10709-9a9394a/llama-prism-b10709-9a9394a-bin-macos-arm64.tar.gz \
  --output tools/bonsai/runtime/llama-prism-b10709-9a9394a-bin-macos-arm64.tar.gz
shasum -a 256 tools/bonsai/models/Ternary-Bonsai-2-27B-PTQ1_0.gguf
shasum -a 256 tools/bonsai/runtime/llama-prism-b10709-9a9394a-bin-macos-arm64.tar.gz
```

Require these exact checksums before extracting/running:

- Model (5,946,648,928 bytes): `53107f530aa52eb00912263ab1ee29bd199261c87cd7b4ad4ca1318c1fe33ee3`
- Runtime archive (11,500,187 bytes): `f9cdf245fb7b832f1996dd776b321d4ae1f23b6d88c380100f636742c3a980ff`

Model hash matches Hugging Face's LFS SHA-256; archive hash matches GitHub's
release digest. Inspect `tar -tzf` first, then extract into `tools/bonsai/runtime`.
The extracted directory is `llama-prism-b10709-9a9394a`. Runtime identifies as
`0.2.0-dev`, build 10709, commit `9a9394a89`. Model is Apache-2.0 licensed;
see the upstream model repository for LICENSE and NOTICE.

## Run sequentially

Stop competing benchmarks and model inference. The launcher refuses an occupied
port, binds only 127.0.0.1:18794, writes a startup receipt/log/props, and prints
its owned child PID. In a separate terminal use that PID for the probe.

```sh
node bonsai-server.mjs "$PWD/tools/bonsai/runtime/llama-prism-b10709-9a9394a/llama-server" budget-only
node bonsai-typing-probe.mjs <printed-server-pid> budget-only
```

After the probe exits, stop the launcher with Ctrl-C. Verify that the owned
server exited before starting the other profile:

```sh
node bonsai-server.mjs "$PWD/tools/bonsai/runtime/llama-prism-b10709-9a9394a/llama-server" template-no-thinking
node bonsai-typing-probe.mjs <printed-server-pid> template-no-thinking
```

Both use 8192 context, one slot, seed 42, temperature 1, top-p 0.95, top-k 20,
full Metal offload and zero reasoning budget. The second adds template kwargs
`enable_thinking:false`. The API request otherwise matches Jev's text helper:
1024 output-token limit, JSON object response, `reasoning.enabled:false`.
Five cases (email, password, amount, search, missing information), five repeated
rounds, one request each, 25-second timeout and no retries. Exact output values
are checked. Missing information must return null; Jev then refuses to type.

The prompt is from MIT-licensed `browser-use/jev-ultrafast` commit
`1231850a0bf1a0c0341fe408ef1668dbbfdfac46`. This Node probe mirrors its request
shape; it does not execute Jev's Python validator or browser harness.

## Interpretation limits

These are fixed-seed, short-context, prompt-cache-warm repetitions. They do not
measure unfamiliar-task exploration, long prompts, image understanding, or
blinded defect detection. Sequential profile order and small samples limit
latency/reliability conclusions. Initial model setup and startup are separate
from request latency; startup after downloading is not disk-cold evidence.

Memory is server RSS sampled every 200ms, including measurement overhead; it
is neither an exact peak nor total unified-memory consumption. Weight-file size
alone is not a total-RAM requirement. Cache allocation can grow across requests.
Actual paid API spend for this probe is $0; coding-agent subscription usage is
separate and not measured by it. Jev still requires securely configured TypeSafe
credentials and an enforced $5 total cap before any paid live run.
