"""End-to-end: deep link, bulk assign/resolve, resolution log, mobile cards."""
import json

from playwright.sync_api import sync_playwright

BASE = "http://localhost:4173/"

with sync_playwright() as p:
    b = p.chromium.launch(headless=True, channel="chrome")

    # 1. Deep link with ?site selects ATL-01; ?view opens queue
    page = b.new_page(viewport={"width": 1440, "height": 900})
    page.goto(BASE + "?view=discrepancies&site=atl-01", wait_until="networkidle")
    page.wait_for_timeout(600)
    page.evaluate("localStorage.removeItem('recon:overrides:v2'); localStorage.removeItem('recon:resolutions:v1')")
    page.goto(BASE + "?view=discrepancies&site=atl-01", wait_until="networkidle")
    page.wait_for_timeout(600)
    heading = page.locator("h1").inner_text()

    # 2. Select two rows -> bulk bar appears -> assign to L. Fernandez
    refs = page.locator("[data-ref-id]").all_inner_texts()
    first_two = page.locator("input[aria-label^='Select RC-']").all()
    first_two[0].check()
    first_two[1].check()
    page.wait_for_timeout(150)
    bar_visible = page.locator('[role="region"][aria-label="Bulk actions"]').is_visible()
    bar_text = page.locator('[role="region"][aria-label="Bulk actions"]').inner_text()

    page.locator("#bulk-assign").select_option("L. Fernandez")
    page.wait_for_timeout(300)
    assign_overrides = page.evaluate("localStorage.getItem('recon:overrides:v2')")

    # 3. Select two rows -> Resolve with root cause
    page.locator("input[aria-label^='Select RC-']").nth(0).check()
    page.locator("input[aria-label^='Select RC-']").nth(1).check()
    page.wait_for_timeout(150)
    page.get_by_role("button", name="Resolve…").click()
    page.wait_for_timeout(150)
    page.locator("#bulk-root-cause").select_option("Picking error")
    page.get_by_role("button", name="Post adjustment (2)").click()
    page.wait_for_timeout(300)
    toast_text = page.locator('[role="status"]').inner_text()

    # 4. Resolution log is visible and shows the revert option
    page.wait_for_timeout(600)
    log_visible = page.locator("h2:has-text('Resolution log')").count() > 0
    log_text = page.locator("#resolution-log-title").evaluate_handle("el => el.parentElement.parentElement.innerText").as_element()
    revert_btn_count = page.locator('button:has-text("Revert")').count()

    # 5. Click Revert on the first entry, verify override got reverted
    page.locator('button:has-text("Revert")').first.click()
    page.wait_for_timeout(400)
    reverted_override = page.evaluate("localStorage.getItem('recon:overrides:v2')")

    result = {
        "viewParamHeading": heading,
        "bulkBarVisible": bar_visible,
        "bulkBarText": bar_text.replace("\n", " | "),
        "overridesAfterAssignCount": len(json.loads(assign_overrides or "{}")),
        "toastAfterBulkResolve": toast_text,
        "resolutionLogVisible": log_visible,
        "revertButtons": revert_btn_count,
    }
    print(json.dumps(result, indent=2))

    # 6. Mobile card fallback at 375px
    page2 = b.new_page(viewport={"width": 375, "height": 812})
    page2.goto(BASE + "?view=discrepancies", wait_until="networkidle")
    page2.wait_for_timeout(600)
    cards = page2.locator("ul li button[aria-label^='Open discrepancy RC-']").all_inner_texts()
    card_overflow = page2.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
    mobile = {"cardsVisible": len(cards), "firstCard": cards[0] if cards else None, "pageOverflow": card_overflow}
    print(json.dumps(mobile, indent=2))

    b.close()
