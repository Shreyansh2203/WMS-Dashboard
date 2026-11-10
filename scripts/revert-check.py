"""Revert path: resolve an actionable item -> ledger entry -> revert -> status restored."""
import json
import re

from playwright.sync_api import sync_playwright

BASE = "http://localhost:4173/?view=discrepancies"

with sync_playwright() as p:
    b = p.chromium.launch(headless=True, channel="chrome")
    page = b.new_page(viewport={"width": 1440, "height": 900})
    page.goto(BASE, wait_until="networkidle")
    page.wait_for_timeout(600)
    page.evaluate("localStorage.removeItem('recon:overrides:v2'); localStorage.removeItem('recon:resolutions:v1')")
    page.reload(wait_until="networkidle")
    page.wait_for_timeout(600)

    # find the first actionable (Open / Investigating) row
    target_id = None
    for row in page.locator("tbody tr.row-hover").all():
        text = row.inner_text()
        if re.search(r"\b(Open|Investigating)\b", text):
            btn = row.locator("[data-ref-btn]").first
            target_id = btn.get_attribute("data-ref-id")
            btn.click()
            break
    assert target_id, "no actionable row found"
    print("resolving:", target_id)

    page.wait_for_timeout(500)
    page.get_by_role("button", name=re.compile(r"Mark resolved")).click()
    page.wait_for_timeout(150)
    page.locator("#drawer-root-cause").select_option("Picking error")
    page.get_by_role("button", name=re.compile(r"Post adjustment")).click()
    page.wait_for_timeout(500)
    page.keyboard.press("Escape")
    page.wait_for_timeout(400)

    before = page.evaluate("({ overrides: localStorage.getItem('recon:overrides:v2'), log: localStorage.getItem('recon:resolutions:v1') })")
    log_before = json.loads(before["log"] or "[]")
    print("log after resolve:", json.dumps([{ "id": e["id"], "reverted": e["reverted"], "rootCause": e["rootCause"], "item": e["item"][:30] } for e in log_before]))

    # Revert the first entry in the resolution log
    page.locator('button:has-text("Revert")').first.click()
    page.wait_for_timeout(500)
    after = page.evaluate("({ overrides: localStorage.getItem('recon:overrides:v2'), log: localStorage.getItem('recon:resolutions:v1') })")
    log_after = json.loads(after["log"] or "[]")
    print("after revert:", json.dumps({ "overrides": json.loads(after["overrides"] or "{}"), "entries": [{ "id": e["id"], "reverted": e["reverted"] } for e in log_after] }, indent=2))
    b.close()
