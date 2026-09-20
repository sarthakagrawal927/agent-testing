"""Shared paid-call guard and local fixture access for Jev screening."""

import json
import os
import time
import urllib.request
from pathlib import Path

import httpx

CAP_USD = 5.0
PRICE_PER_INPUT_TOKEN_USD = 0.042 / 1_000_000
MAX_PAID_REQUESTS = 20
TYPESAFE_URL = "https://api.typesafe.ai/v1/systemone"
BUDGET_PATH = Path(__file__).resolve().parent / "artifacts" / "jev-budget.json"


class SpendGuard:
    def __init__(self):
        self.calls = []
        self.reserved_usd = 0.0

    def budget(self):
        return json.loads(BUDGET_PATH.read_text())

    def write_budget(self, value):
        temporary = BUDGET_PATH.with_suffix(".tmp")
        temporary.write_text(json.dumps(value, indent=2))
        os.replace(temporary, BUDGET_PATH)

    def post_json(self, url, key, body):
        paid = url == TYPESAFE_URL
        encoded = json.dumps(body, separators=(",", ":")).encode()
        reserve = len(encoded) * PRICE_PER_INPUT_TOKEN_USD if paid else 0.0
        if paid and len(self.calls) >= MAX_PAID_REQUESTS:
            raise RuntimeError("Paid Jev request-count cap reached; no action executed.")
        if paid:
            budget = self.budget()
            if budget["consumed_upper_bound_usd"] + reserve > CAP_USD:
                raise RuntimeError("Total paid Jev spend cap would be exceeded; no action executed.")
            budget["consumed_upper_bound_usd"] += reserve
            budget["attempts"] += 1
            self.write_budget(budget)
            self.reserved_usd += reserve
        started = time.perf_counter()
        try:
            response = httpx.post(
                url,
                json=body,
                headers={"Authorization": f"Bearer {key}"},
                timeout=25,
            )
            if response.is_error:
                raise RuntimeError(f"Model provider returned HTTP {response.status_code}; no action executed.")
            result = response.json()
        except httpx.HTTPError:
            raise RuntimeError("Model connection failed; no action executed.") from None
        if paid:
            usage = result.get("usage", {})
            input_tokens = usage.get("input_tokens", usage.get("prompt_tokens"))
            estimated = input_tokens * PRICE_PER_INPUT_TOKEN_USD if isinstance(input_tokens, int) else reserve
            self.calls.append(
                {
                    "request": len(self.calls) + 1,
                    "request_bytes": len(encoded),
                    "reserved_usd": reserve,
                    "estimated_usd": estimated,
                    "usage": usage,
                    "latency_ms": round((time.perf_counter() - started) * 1000),
                }
            )
            budget = self.budget()
            budget["accepted_estimated_spend_usd"] += estimated
            budget["accepted_calls"] += 1
            self.write_budget(budget)
        return result

    def receipt(self):
        return {
            "provider": "TypeSafe",
            "price_usd_per_million_input_tokens": 0.042,
            "cap_usd": CAP_USD,
            "calls": self.calls,
            "request_count": len(self.calls),
            "estimated_spend_usd": sum(call["estimated_usd"] for call in self.calls),
            "reserved_upper_bound_usd": self.reserved_usd,
            "retries": 0,
            "total_budget_ledger": self.budget(),
        }


def backend(path, body=None, headers=None):
    payload = json.dumps(body).encode() if body is not None else None
    request = urllib.request.Request(
        "http://127.0.0.1:18791/" + path,
        data=payload,
        headers={"Content-Type": "application/json", "Connection": "close", **(headers or {})},
        method="POST" if body is not None else "GET",
    )
    with urllib.request.urlopen(request, timeout=5) as response:
        return json.load(response)
