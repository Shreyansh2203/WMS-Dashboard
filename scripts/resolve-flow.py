"""End-to-end resolution flow: open drawer, require root cause, post, verify."""
import json

from playwright.sync_api import sync_playwright

BASE = "http://localhost:4173/"

with sync_playwright() as p:
    b = p.chromium.launch(headless=True, channel="chrome")
    ctx = b.new_context(viewport={"width": 1440, "height": 900})
    page = ctx.new_page()
    errors: list[str] = []
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(BASE, wait_until="networkidle")
    page.wait_for_timeout(600)

    # clear any saved overrides
    page.evaluate("localStorage.removeItem('recon:overrides:v2'); localStorage.removeItem('recon:overrides:v1')")
    page.reload(wait_until="networkidle")
    page.wait_for_timeout(600)

    ref = page.locator("[data-ref-btn]").first
    ref_id = ref.get_attribute("data-ref-id")
    ref.click()
    page.wait_for_timeout(500)
    drawer = page.locator('[role="dialog"][aria-labelledby="drawer-title"]')

    btn = drawer.get_by_role("button", name="Mark resolved…")
    btn.click()
    page.wait_for_timeout(150)
    post = drawer.get_by_role("button", name="Post adjustment")
    post.click()
    page.wait_for_timeout(150)
    error_visible = drawer.locator('#drawer-root-cause-error[role="alert"]').count() > 0
    focused = page.evaluate("document.activeElement?.id")
    drawer.locator("#drawer-root-cause").select_option("Picking error")
    page.wait_for_timeout(100)
    error_hidden = drawer.locator('#drawer-root-cause-error').count() == 0
    post.click()
    page.wait_for_timeout(300)

    state = page.evaluate(
        """() => {
          const t = document.querySelector('[role=status]');
          return { toast: t ? t.textContent.trim() : null, overrides: localStorage.getItem('recon:overrides:v2') };
        }"""
    )
    timeline = drawer.inner_text()
    still_dialog = drawer.count() > 0
    drawer.get_by_role("button", name="Close").first.click()
    page.wait_for_timeout(300)

    print(json.dumps({
        "ref": ref_id,
        "postWithoutRootCauseBlocksAndAnnounces": error_visible,
        "focusMovesToRootCauseSelect": focused == "drawer-root-cause",
        "errorClearsOnSelect": error_hidden,
        "toast": state["toast"],
        "storedOverride": json.loads(state["overrides"]) if state["overrides"] else None,
        "resolvedTextPresent": "Resolved · root cause" in timeline and "Picking error" in timeline,
        "drawerStillOpen": still_dialog,
        "errors": errors,
    }, indent=2))

    # verify undo restores the row
    page.goto(BASE, wait_until="networkidle")
    page.wait_for_timeout(500)
    print("afterReload", json.dumps(page.evaluate("localStorage.getItem('recon:overrides:v2')")))
    b.close()
