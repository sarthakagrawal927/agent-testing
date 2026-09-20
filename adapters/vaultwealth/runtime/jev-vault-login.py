"""One guarded Jev login screening run against the local Vaultwealth fixture."""

from __future__ import annotations

import json
import os
import subprocess
import time
from pathlib import Path

from jev_ultrafast import Agent
from jev_ultrafast import model as jev_model
from jev_guard import SpendGuard, backend

ROOT = Path(__file__).resolve().parent
TEXT_BASE = "http://127.0.0.1:18794/v1"
GOAL = """First prove invalid credentials are rejected: enter user@example.com, continue,
enter WrongPassword1!, continue, and observe the invalid email/password message.
Then return to password entry, replace the password with SecurePass1!, continue,
enter confirmation code 123456, continue, and stop only when the Vault dashboard
for Jane is visible. Do not use any other account or values."""


def main():
    key = os.environ.get("TYPESAFE_API_KEY", "").strip()
    if not key:
        key = subprocess.run(
            ["/usr/bin/pbpaste"],
            check=True,
            capture_output=True,
            text=True,
            timeout=2,
        ).stdout.strip()
    if not key:
        raise SystemExit("Clipboard did not provide a TypeSafe key.")
    os.environ["TYPESAFE_API_KEY"] = key
    os.environ.update(
        TEXT_MODEL_API_KEY="local-placeholder",
        TEXT_MODEL_BASE_URL=TEXT_BASE,
        TEXT_MODEL="bonsai-2-27b",
        TEXT_MODEL_REASONING="none",
    )
    import httpx
    if not httpx.get("http://127.0.0.1:18794/health", timeout=2).is_success:
        raise SystemExit("Local Bonsai server is not ready.")
    backend("reset", {"fault": "clean"})
    guard = SpendGuard()
    jev_model.post_json = guard.post_json
    out = ROOT / "artifacts" / f"jev-login-{int(time.time() * 1000)}"
    out.mkdir(parents=True)
    started = time.perf_counter()
    invalid_seen = False
    snapshot = None
    error = None
    agent = None
    try:
        agent = Agent("http://127.0.0.1:18790/login", GOAL, record_dir=out / "screens")
        for snapshot in agent.run():
            invalid_seen |= "The email and password combination are invalid" in snapshot["page"]["text"]
        verification_started = time.perf_counter()
        observed = agent.browser.evaluate(
            """(() => ({path:location.pathname,
            dashboard:document.body.innerText.includes('Welcome to your Vault Dashboard, Jane.'),
            invalidVisible:document.body.innerText.includes('The email and password combination are invalid')}))()"""
        )
        account = backend(
            "api/user/v1/account",
            headers={"Authorization": "Bearer mock-login-token-final"},
        )
        verified = {
            "invalid_credentials_rejected": invalid_seen,
            "path": observed["path"],
            "dashboard_for_jane": observed["dashboard"],
            "account_id": account.get("id"),
            "passed": invalid_seen
            and observed["path"] == "/overview"
            and observed["dashboard"]
            and account.get("id") == "mock-user-id",
            "verification_ms": round((time.perf_counter() - verification_started) * 1000),
        }
    except Exception as exc:  # Preserve the failed trial without credential material.
        error = f"{type(exc).__name__}: {exc}"
        verified = {"passed": False}
    finally:
        if agent:
            agent.close()
    elapsed = round((time.perf_counter() - started) * 1000)
    result = {
        "status": "passed" if verified["passed"] else "failed",
        "goal": GOAL,
        "elapsed_ms": elapsed,
        "verification": verified,
        "error": error,
        "paid_api": {
            **guard.receipt(),
        },
        "text_model": "local Bonsai 2 27B PTQ1_0, explicit no-thinking",
        "snapshot": (
            {
                **{key: value for key, value in snapshot.items() if key != "page"},
                "page": {
                    key: value
                    for key, value in snapshot["page"].items()
                    if key != "screenshot"
                },
            }
            if snapshot
            else None
        ),
        "boundary": "Single screening run; fixed verification is separate from Jev DONE.",
    }
    (out / "result.json").write_text(json.dumps(result, indent=2))
    print(json.dumps({k: result[k] for k in ("status", "elapsed_ms", "verification", "paid_api", "error")}))
    print(out)
    raise SystemExit(0 if verified["passed"] else 1)


if __name__ == "__main__":
    main()
