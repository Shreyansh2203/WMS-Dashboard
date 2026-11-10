"""Recon E2E gate.

Runs the critical flows against the live preview (http://localhost:4173) and
exits non-zero on any failure, so it can gate merges:

    python scripts/e2e.py            # or: npm run e2e

Checks: deep link, queue bulk assign/resolve, resolution ledger revert,
skip link + focus restore, drawer focus trap, mobile 320 overflow,
mobile card list at 375, reduced motion, print chrome, 3 data-table disclosures.
"""
from __future__ import annotations

import json
import os
import re
import sys
from playwright.sync_api import sync_playwright

from _launch import launch_chromium

BASE = os.environ.get("RECON_BASE_URL", "http://localhost:4173/").rstrip("/") + "/"
HEADLESS = True

passed = 0
failed = 0
notes: list[str] = []


def ok(name: str, good: bool, detail: str = "") -> None:
    global passed, failed
    if good:
        passed += 1
        notes.append(f"  PASS {name}")
    else:
        failed += 1
        notes.append(f"  FAIL {name} — {detail}")


def main() -> int:
    with sync_playwright() as p:
        b = launch_chromium(p)
        page = b.new_page(viewport={"width": 1440, "height": 900})

        # 0. reset storage, start from a known state
        page.goto(BASE, wait_until="networkidle")
        page.evaluate("localStorage.removeItem('recon:overrides:v2'); localStorage.removeItem('recon:resolutions:v1')")

        # 1. deep link: queue is reachable via URL
        page.goto(BASE + "?view=discrepancies", wait_until="networkidle")
        page.wait_for_timeout(500)
        heading = page.locator("h1").inner_text()
        ok("deep link opens queue", "queue" in heading.lower(), heading)

        # 2. skip link is the first Tab stop, Enter moves into main
        page.goto(BASE, wait_until="networkidle")
        page.wait_for_timeout(400)
        page.keyboard.press("Tab")
        active = page.evaluate("document.activeElement?.textContent.trim()")
        ok("skip link first on tab", active == "Skip to content", active or "")

        # 3. drawer focus trap + return
        row = page.locator("[data-ref-btn]").first
        ref_id = row.get_attribute("data-ref-id")
        row.click()
        page.wait_for_timeout(400)
        for _ in range(20):
            page.keyboard.press("Tab")
        inside = page.evaluate("!!document.activeElement && document.activeElement.closest('[role=dialog][aria-labelledby=drawer-title]') !== null")
        ok("drawer keeps focus (20x Tab)", inside, "focus escaped drawer")

        # 4. escape returns focus to originating Ref
        page.keyboard.press("Escape")
        page.wait_for_timeout(300)
        active_ref = page.evaluate("document.activeElement?.getAttribute('data-ref-id')")
        ok("drawer escape restores Ref focus", active_ref == ref_id, f"expected {ref_id}, got {active_ref}")

        # 5. bulk assign gate: bar appears only after selecting >=1 row; prefer rows that are not already Resolved
        page.goto(BASE + "?view=discrepancies", wait_until="networkidle")
        page.wait_for_timeout(500)
        actionable = []
        for i in range(page.locator("tbody tr.row-hover").count()):
            if "Resolved" not in page.locator("tbody tr.row-hover").nth(i).inner_text():
                actionable.append(i)
            if len(actionable) >= 2:
                break
        assert len(actionable) >= 2, "expected at least 2 actionable rows on page 1"
        for i in actionable:
            page.locator("tbody tr.row-hover").nth(i).locator("input[type=checkbox]").check()
        page.wait_for_timeout(150)
        bar = page.locator('[role="region"][aria-label="Bulk actions"]')
        ok("bulk bar appears on selection", bar.is_visible(), "bar missing")
        page.locator("#bulk-assign").select_option("L. Fernandez")
        page.wait_for_timeout(300)
        assign_count = page.evaluate("Object.keys(JSON.parse(localStorage.getItem('recon:overrides:v2') ?? '{}')).length")
        ok("bulk assign persists overrides", assign_count == 2, f"overrides={assign_count}")

        # 6. bulk resolve blocks posting until a root cause is chosen (validates on click, error announced)
        for i in actionable:
            page.locator("tbody tr.row-hover").nth(i).locator("input[type=checkbox]").check()
        page.wait_for_timeout(150)
        page.get_by_role("button", name="Resolve…").click()
        page.wait_for_timeout(150)
        post = page.get_by_role("button", name=re.compile(r"Post adjustment"))
        state_before_click = page.evaluate("localStorage.getItem('recon:overrides:v2')")
        post.click()
        page.wait_for_timeout(150)
        state_after_click = page.evaluate("localStorage.getItem('recon:overrides:v2')")
        error_visible = page.locator("#bulk-root-cause-error").count() > 0
        focused = page.evaluate("document.activeElement?.id")
        page.locator("#bulk-root-cause").select_option("Picking error")
        page.wait_for_timeout(100)
        error_hidden = page.locator("#bulk-root-cause-error").count() == 0
        post.click()
        page.wait_for_timeout(400)
        unchanged = state_before_click == state_after_click
        ok("bulk resolve blocks posting until root cause", error_visible and focused == "bulk-root-cause" and unchanged and error_hidden, f"error_visible={error_visible} focused={focused} unchanged={unchanged}")

        # 7. resolution ledger records the batch and supports revert
        log = json.loads(page.evaluate("localStorage.getItem('recon:resolutions:v1') ?? '[]'"))
        ok("resolution log persists batch", len(log) >= 2, f"entries={len(log)}")
        page.locator('button:has-text("Revert")').first.click()
        page.wait_for_timeout(400)
        reverted_status = json.loads(page.evaluate("localStorage.getItem('recon:overrides:v2')"))
        reverted_log = json.loads(page.evaluate("localStorage.getItem('recon:resolutions:v1') ?? '[]'"))
        log_says_reverted = any(e.get("reverted") for e in reverted_log)
        override_restored = any(v.get("status") != "Resolved" for v in reverted_status.values())
        ok("ledger revert restores override", log_says_reverted and override_restored, f"log_reverted={log_says_reverted} override_restored={override_restored}")

        # 8. mobile 320: no page overflow
        mob = b.new_page(viewport={"width": 320, "height": 720})
        mob.goto(BASE, wait_until="networkidle")
        mob.wait_for_timeout(500)
        of = mob.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
        ok("320px has no page overflow", of == 0, f"overflow={of}px")

        # 9. mobile cards exist at 375
        m375 = b.new_page(viewport={"width": 375, "height": 812})
        m375.goto(BASE + "?view=discrepancies", wait_until="networkidle")
        m375.wait_for_timeout(500)
        cards = m375.locator("ul li button[aria-label^='Open discrepancy RC-']").count()
        ok("mobile card list renders", cards > 0, f"cards={cards}")

        # 10. reduced motion kills .rise animation
        ctx = b.new_context(viewport={"width": 1440, "height": 900}, reduced_motion="reduce")
        rm = ctx.new_page()
        rm.goto(BASE, wait_until="networkidle")
        rm.wait_for_timeout(150)
        rise = rm.evaluate("""() => {
          const el = document.querySelector('.rise');
          return el ? getComputedStyle(el).animationName : null;
        }""")
        ok("reduced motion neutralizes .rise", rise in (None, "none"), f"animation={rise}")
        ctx.close()

        # 11. print hides chrome, keeps the table
        prt = b.new_page(viewport={"width": 1440, "height": 900})
        prt.goto(BASE, wait_until="networkidle")
        prt.wait_for_timeout(400)
        prt.emulate_media(media="print")
        prt.wait_for_timeout(150)
        chrome_hidden = prt.evaluate("""() => {
          const aside = document.querySelector('aside');
          const header = document.querySelector('header');
          return aside?.offsetParent === null && header?.offsetParent === null;
        }""")
        table_visible = prt.evaluate("""() => {
          const t = document.querySelector('table');
          return t ? t.offsetParent !== null : false;
        }""")
        ok("print hides chrome / keeps grid", chrome_hidden and table_visible, f"chrome={chrome_hidden} table={table_visible}")

        # 12. all three chart data-table disclosures exist and expand (on the Overview page)
        page.goto(BASE, wait_until="networkidle")
        page.wait_for_timeout(600)
        details = page.locator("details summary").all_inner_texts()
        ok("3 chart data-table disclosures", len(details) == 3, json.dumps(details))

        b.close()

    print("\n".join(notes))
    print(f"\n{passed} passed, {failed} failed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
