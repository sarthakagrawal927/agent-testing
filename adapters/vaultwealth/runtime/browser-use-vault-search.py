"""Bounded Browser Use + local Bonsai screening against Vaultwealth search."""

import asyncio
import base64
import json
import os
import sys
import time
import urllib.request
from pathlib import Path

# Keep the candidate local-only: Browser Use telemetry and cloud browser are disabled.
os.environ["ANONYMIZED_TELEMETRY"] = "False"
os.environ["BROWSER_USE_CLOUD_SYNC"] = "false"

from browser_use import Agent, BrowserSession, Tools
from browser_use.llm.openai.like import ChatOpenAILike


ROOT = Path(__file__).resolve().parent
BASE = "http://127.0.0.1:18790"
BACKEND = "http://127.0.0.1:18791"
MODEL_BASE = "http://127.0.0.1:18794/v1"
CHROME = Path.home() / (
    "Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/"
    "Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"
)
GOAL = """Use only the Search combobox already on this page.
1. Search for VOO and wait until Vanguard S&P 500 ETF is visible.
2. Replace the query with QQQ and wait until Invesco QQQ Trust is visible and the Vanguard result is gone.
3. Replace the query with zz-no-match.
Finish successfully only when No results is visible and neither prior result remains.
Do not navigate away, open new tabs, or select a result."""


def backend(path: str, payload: dict | None = None) -> dict:
    request = urllib.request.Request(
        f"{BACKEND}/{path}",
        data=json.dumps(payload).encode() if payload is not None else None,
        headers={"Content-Type": "application/json", "Connection": "close"},
        method="POST" if payload is not None else "GET",
    )
    with urllib.request.urlopen(request, timeout=5) as response:
        return json.load(response)


async def run(fault: str) -> tuple[dict, Path]:
    if fault not in {"clean", "stale-search"}:
        raise ValueError("Supported faults: clean, stale-search")
    if not CHROME.is_file():
        raise FileNotFoundError(f"Pinned Playwright browser not found: {CHROME}")

    health = urllib.request.urlopen("http://127.0.0.1:18794/health", timeout=2)
    if health.status != 200:
        raise RuntimeError("Local Bonsai server is not ready")
    backend("reset", {"fault": fault})

    out = ROOT / "artifacts" / f"browser-use-search-{int(time.time() * 1000)}"
    out.mkdir(parents=True)
    browser = BrowserSession(
        is_local=True,
        executable_path=CHROME,
        headless=True,
        allowed_domains=["127.0.0.1"],
        enable_default_extensions=False,
        keep_alive=True,
        viewport={"width": 1440, "height": 900},
        minimum_wait_page_load_time=0.1,
        wait_for_network_idle_page_load_time=0.5,
        wait_between_actions=0.1,
        args=[
            "--disable-background-networking",
            "--disable-component-update",
            "--disable-domain-reliability",
            "--no-first-run",
        ],
    )
    await browser.start()
    await browser._cdp_add_init_script(
        "if (location.origin === 'http://127.0.0.1:18790') "
        "sessionStorage.setItem('token', 'mock-login-token-final');"
    )
    llm = ChatOpenAILike(
        model="bonsai-2-27b",
        api_key="local-only",
        base_url=MODEL_BASE,
        temperature=0,
        frequency_penalty=None,
        max_retries=0,
        max_completion_tokens=1200,
        add_schema_to_system_prompt=True,
    )
    agent = Agent(
        task=GOAL,
        llm=llm,
        browser_session=browser,
        tools=Tools(exclude_actions=["extract"]),
        initial_actions=[{"navigate": {"url": f"{BASE}/plan/assets/add", "new_tab": False}}],
        use_vision=False,
        use_thinking=False,
        use_judge=False,
        enable_planning=False,
        flash_mode=True,
        max_actions_per_step=3,
        max_history_items=6,
        message_compaction=False,
        max_failures=1,
        final_response_after_failure=False,
        llm_timeout=30,
        step_timeout=45,
        generate_gif=False,
        enable_signal_handler=False,
        calculate_cost=False,
    )

    started = time.perf_counter()
    error = None
    history = None
    try:
        history = await asyncio.wait_for(agent.run(max_steps=10), timeout=150)
    except Exception as exc:
        error = f"{type(exc).__name__}: {exc}"
    elapsed_ms = round((time.perf_counter() - started) * 1000, 2)

    verification_started = time.perf_counter()
    state = await browser.get_browser_state_summary(include_screenshot=True)
    text = state.dom_state.llm_representation()
    (out / "final-dom.txt").write_text(text)
    if state.screenshot:
        (out / "final.png").write_bytes(base64.b64decode(state.screenshot))
    fixture = backend("state")
    (out / "backend.json").write_text(json.dumps(fixture, indent=2))
    searches = [r for r in fixture["requests"] if r["path"].endswith("/assets/search")]
    queries = [r.get("query") for r in searches]
    mismatches = [r for r in searches if r.get("query") != r.get("servedQuery")]
    visible = {
        "no_results": "No results" in text,
        "has_voo": "Vanguard S&P 500 ETF" in text,
        "has_qqq": "Invesco QQQ Trust" in text,
    }
    functional_pass = (
        state.url.endswith("/plan/assets/add")
        and visible["no_results"]
        and not visible["has_voo"]
        and not visible["has_qqq"]
        and all(expected in queries for expected in ["VOO", "QQQ", "zz-no-match"])
    )
    passed = functional_pass if fault == "clean" else (not functional_pass and bool(mismatches))
    verification = {
        **visible,
        "url": state.url,
        "queries": queries,
        "backend_search_requests": len(searches),
        "backend_query_mismatches": len(mismatches),
        "functional_pass": functional_pass,
        "seeded_fault_detected": fault == "stale-search" and not functional_pass and bool(mismatches),
        "passed": passed,
        "verification_ms": round((time.perf_counter() - verification_started) * 1000, 2),
    }
    if history is not None:
        history.save_to_file(out / "history.json")
    result = {
        "status": ("passed" if fault == "clean" else "detected") if passed else "failed",
        "fault": fault,
        "elapsed_ms": elapsed_ms,
        "steps": len(history) if history is not None else 0,
        "model_calls": len(history.model_outputs()) if history is not None else 0,
        "agent_done": history.is_done() if history is not None else False,
        "agent_success": history.is_successful() if history is not None else None,
        "agent_final": history.final_result() if history is not None else None,
        "agent_errors": history.errors() if history is not None else [],
        "verification": verification,
        "model": "local Bonsai 2 27B PTQ1_0, explicit no-thinking",
        "paid_api_spend_usd": 0,
        "error": error,
        "boundary": "Authentication seeded before timing; all search actions and fixed UI/backend checks remain in scope.",
    }
    (out / "result.json").write_text(json.dumps(result, indent=2))
    await browser.stop()
    return result, out


async def main() -> None:
    fault = sys.argv[1] if len(sys.argv) > 1 else "clean"
    result, out = await run(fault)
    print(json.dumps(result))
    print(out)
    raise SystemExit(0 if result["verification"]["passed"] else 1)


if __name__ == "__main__":
    asyncio.run(main())
