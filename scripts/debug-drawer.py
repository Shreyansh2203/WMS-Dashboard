"""Debug: what does the drawer look like right after opening?"""
import json

from playwright.sync_api import sync_playwright

BASE = "http://localhost:4173/?view=discrepancies"

with sync_playwright() as p:
    b = p.chromium.launch(headless=True, channel="chrome")
    page = b.new_page(viewport={"width": 1440, "height": 900})
    page.goto(BASE, wait_until="networkidle")
    page.wait_for_timeout(500)
    page.evaluate("localStorage.removeItem('recon:overrides:v2'); localStorage.removeItem('recon:resolutions:v1')")
    page.reload(wait_until="networkidle")
    page.wait_for_timeout(600)
    ref = page.locator("[data-ref-btn]").first
    print("ref id:", ref.get_attribute("data-ref-id"))
    ref.click()
    page.wait_for_timeout(600)
    drawer = page.locator('[role="dialog"][aria-labelledby="drawer-title"]')
    print("drawer count:", drawer.count())
    buttons = drawer.locator("button").all_inner_texts()
    print("buttons:", buttons)
    print("body has Mark resolved:", page.locator('button:has-text("Mark resolved")').count())
    b.close()
