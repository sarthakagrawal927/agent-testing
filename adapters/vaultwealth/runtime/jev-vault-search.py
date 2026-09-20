"""One guarded Jev dynamic-search screening run against local Vaultwealth."""

import json
import os
import subprocess
import sys
import time
from pathlib import Path

import httpx
from jev_ultrafast import Agent
from jev_ultrafast import model as jev_model

from jev_guard import SpendGuard, backend

ROOT = Path(__file__).resolve().parent
GOAL = """In the Search assets field, search for VOO and wait until Vanguard S&P 500 ETF is visible.
Then replace the query with QQQ and wait until Invesco QQQ Trust is visible and the Vanguard result is gone.
Finally replace the query with zz-no-match and stop only when No results is visible and neither prior result remains."""


def sanitize(snapshot):
    if not snapshot:
        return None
    return {
        **{key: value for key, value in snapshot.items() if key != "page"},
        "page": {key: value for key, value in snapshot["page"].items() if key != "screenshot"},
    }


def main():
    fault = sys.argv[1] if len(sys.argv) > 1 else "clean"
    if fault not in {"clean", "stale-search"}:
        raise SystemExit("Supported faults: clean, stale-search")
    key = subprocess.run(
        ["/usr/bin/pbpaste"], check=True, capture_output=True, text=True, timeout=2
    ).stdout.strip()
    if not key or any(char.isspace() for char in key):
        raise SystemExit("Clipboard did not provide a raw TypeSafe key.")
    os.environ.update(
        TYPESAFE_API_KEY=key,
        TEXT_MODEL_API_KEY="local-placeholder",
        TEXT_MODEL_BASE_URL="http://127.0.0.1:18794/v1",
        TEXT_MODEL="bonsai-2-27b",
        TEXT_MODEL_REASONING="none",
    )
    if not httpx.get("http://127.0.0.1:18794/health", timeout=2).is_success:
        raise SystemExit("Local Bonsai server is not ready.")
    backend("reset", {"fault": fault})
    guard = SpendGuard()
    jev_model.post_json = guard.post_json
    out = ROOT / "artifacts" / f"jev-search-{int(time.time() * 1000)}"
    out.mkdir(parents=True)
    snapshot = None
    error = None
    agent = None
    started = None
    seen = {"voo": False, "qqq_without_voo": False, "no_results": False}
    try:
        agent = Agent("http://127.0.0.1:18790/login", GOAL, record_dir=out / "screens")
        agent.browser.evaluate(
            "localStorage.clear();sessionStorage.clear();"
            "sessionStorage.setItem('token','mock-login-token-final')"
        )
        agent.browser.call("Page.navigate", url="http://127.0.0.1:18790/plan/assets/add")
        deadline = time.monotonic() + 15
        while time.monotonic() < deadline:
            page = agent.browser.observe(screenshot=True)
            if any(action.get("kind") == "fill" and "Search" in action.get("label", "") for action in page["actions"]):
                agent.state["page"] = page
                break
            time.sleep(0.1)
        else:
            raise RuntimeError("Search UI did not become ready")
        agent.state["started_at"] = None
        started = time.perf_counter()
        for snapshot in agent.run():
            text = snapshot["page"]["text"]
            seen["voo"] |= "Vanguard S&P 500 ETF" in text
            seen["qqq_without_voo"] |= "Invesco QQQ Trust" in text and "Vanguard S&P 500 ETF" not in text
            seen["no_results"] |= "No results" in text
        verification_started = time.perf_counter()
        observed = agent.browser.evaluate(
            """(() => {const t=document.body.innerText;return {
            path:location.pathname,noResults:t.includes('No results'),
            hasVoo:t.includes('Vanguard S&P 500 ETF'),hasQqq:t.includes('Invesco QQQ Trust')};})()"""
        )
        state = backend("state")
        search_requests = [
            request for request in state["requests"] if request["path"].endswith("/assets/search")
        ]
        functional_pass = (
            all(seen.values())
            and observed["path"] == "/plan/assets/add"
            and observed["noResults"]
            and not observed["hasVoo"]
            and not observed["hasQqq"]
            and len(search_requests) >= 3
        )
        mismatches = [request for request in search_requests if request.get("query") != request.get("servedQuery")]
        verification = {
            **seen,
            **observed,
            "backend_search_requests": len(search_requests),
            "functional_pass": functional_pass,
            "seeded_fault_detected": fault == "stale-search" and not functional_pass and bool(mismatches),
            "backend_query_mismatches": len(mismatches),
            "passed": functional_pass if fault == "clean" else (not functional_pass and bool(mismatches)),
            "verification_ms": round((time.perf_counter() - verification_started) * 1000),
        }
    except Exception as exc:
        error = f"{type(exc).__name__}: {exc}"
        verification = {**seen, "passed": False}
    finally:
        if agent:
            agent.close()
    result = {
        "status": ("passed" if fault == "clean" else "detected") if verification["passed"] else "failed",
        "fault": fault,
        "elapsed_ms": round((time.perf_counter() - started) * 1000) if started else None,
        "verification": verification,
        "paid_api": guard.receipt(),
        "text_model": "local Bonsai 2 27B PTQ1_0, explicit no-thinking",
        "error": error,
        "snapshot": sanitize(snapshot),
        "boundary": "Authentication seeded before timing; all search interactions and fixed checks remain in scope.",
    }
    (out / "result.json").write_text(json.dumps(result, indent=2))
    print(json.dumps({key: result[key] for key in ("status", "elapsed_ms", "verification", "paid_api", "error")}))
    print(out)
    raise SystemExit(0 if verification["passed"] else 1)


if __name__ == "__main__":
    main()
