"""Mobile overlay geometry probe at 320px: site listbox, stream popover,
bell panel, command palette and the detail drawer must all stay in-viewport.
"""
import json
import os

from playwright.sync_api import sync_playwright

from _launch import launch_chromium

BASE = os.environ.get("RECON_BASE_URL", "http://localhost:4173/").rstrip("/") + "/"
VIEWPORT = int(os.environ.get("VP", "320"))
RECT = "el => { const r = el.getBoundingClientRect(); return { left: Math.round(r.left), right: Math.round(r.right), top: Math.round(r.top), bottom: Math.round(r.bottom), width: Math.round(r.width), height: Math.round(r.height) }; }"


def measure(page, selector):
    page.wait_for_selector(selector, state="visible")
    return page.eval_on_selector(selector, RECT)


def main():
    out = {"viewport": VIEWPORT, "overlays": {}, "drawer": None, "focusReturn": None, "errors": []}
    with sync_playwright() as p:
        b = launch_chromium(p)
        page = b.new_page(viewport={"width": VIEWPORT, "height": 900})
        page.goto(BASE, wait_until="networkidle")
        page.wait_for_timeout(400)

        # warehouse listbox
        page.click('button[aria-haspopup="listbox"]')
        out["overlays"]["siteListbox"] = measure(page, '[role="listbox"][aria-label="Switch warehouse"]')
        page.keyboard.press("Escape")
        page.wait_for_timeout(150)

        # stream health popover
        page.click('button[title="Open sync details"]')
        out["overlays"]["streamPopover"] = measure(page, '[role="dialog"][aria-label="Stream health"]')
        page.keyboard.press("Escape")
        page.wait_for_timeout(150)

        # bell panel
        page.click('button[aria-label^="Needs attention"]')
        out["overlays"]["bellPanel"] = measure(page, '[role="dialog"][aria-label^="Critical discrepancies"]')
        page.keyboard.press("Escape")
        page.wait_for_timeout(150)

        # command palette
        page.click('button[aria-label^="Open command palette"]')
        out["overlays"]["palette"] = measure(page, '[role="dialog"][aria-label="Command palette"]')
        page.keyboard.press("Escape")
        page.wait_for_timeout(150)

        # drawer + focus restore (overview also renders the highest-value queue)
        ref = page.locator("[data-ref-btn]").first
        ref_id = ref.get_attribute("data-ref-id")
        ref.click()
        page.wait_for_timeout(400)
        out["drawer"] = measure(page, '[role="dialog"][aria-labelledby="drawer-title"]')
        out["drawer"]["pageOverflowX"] = page.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
        page.keyboard.press("Escape")
        page.wait_for_timeout(250)
        out["focusReturn"] = {
            "expected": ref_id,
            "actual": page.evaluate("document.activeElement?.getAttribute('data-ref-id')"),
        }
        out["errors"] = page.evaluate("window.__errs || []")
        b.close()
    print(json.dumps(out, indent=2))


if __name__ == "__main__":
    main()
