"""Keyboard + ARIA contract audit for the Recon dashboard.

Read-only browser checks that complement Lighthouse: focus order, disclosure
focus return, select-only combobox behaviour, heading outline, landmarks and
the mobile view switcher semantics.
"""
from __future__ import annotations

import json
import re

from playwright.sync_api import sync_playwright

BASE = "http://localhost:4173/"

ACTIVE = r"""
() => {
  const el = document.activeElement;
  if (!el || el === document.body) return { tag: 'BODY' };
  const name = el.getAttribute('aria-label')
    || (el.getAttribute('aria-labelledby') ? document.getElementById(el.getAttribute('aria-labelledby'))?.textContent : null)
    || (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 60);
  return {
    tag: el.tagName,
    role: el.getAttribute('role'),
    id: el.id || null,
    name,
    current: el.getAttribute('aria-current'),
  };
}
"""


def main() -> int:
    out: dict = {"tabOrderDesktop": [], "skipLink": None, "combobox": None, "bell": None, "stream": None, "mobile": None, "landmarks": None, "headings": None, "sortLabels": None, "errors": []}
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True, channel="chrome")
        page = b.new_page(viewport={"width": 1440, "height": 900})
        errors: list[str] = []
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(BASE, wait_until="networkidle")
        page.wait_for_timeout(600)

        # 1. First Tab must land on the skip link, Enter must move focus into main
        page.keyboard.press("Tab")
        out["skipLink"] = {"firstTab": page.evaluate(ACTIVE)}
        page.keyboard.press("Enter")
        page.wait_for_timeout(150)
        out["skipLink"]["afterEnter"] = page.evaluate(ACTIVE)
        out["skipLink"]["hash"] = page.evaluate("location.hash")
        page.keyboard.press("Tab")
        out["skipLink"]["nextTab"] = page.evaluate(ACTIVE)

        # 2. Focus order from a clean load (first 24 stops)
        page.goto(BASE, wait_until="networkidle")
        page.wait_for_timeout(500)
        order = []
        for _ in range(24):
            page.keyboard.press("Tab")
            order.append(page.evaluate(ACTIVE))
        out["tabOrderDesktop"] = order

        # 3. Select-only combobox: Enter opens, arrows switch, Enter closes + returns focus
        page.goto(BASE, wait_until="networkidle")
        page.wait_for_timeout(500)
        trigger = page.locator("#site-switcher")
        trigger.focus()
        before = trigger.get_attribute("aria-activedescendant")
        page.keyboard.press("Enter")
        page.wait_for_timeout(120)
        opened = {
            "expanded": trigger.get_attribute("aria-expanded"),
            "activedescendant": trigger.get_attribute("aria-activedescendant"),
            "listbox": page.locator("#site-listbox").count(),
            "optionTabIndexes": page.eval_on_selector_all("#site-listbox [role=option]", "els => els.map(e => e.tabIndex)"),
        }
        page.keyboard.press("ArrowDown")
        page.wait_for_timeout(120)
        switched = {
            "expanded": trigger.get_attribute("aria-expanded"),
            "activedescendant": trigger.get_attribute("aria-activedescendant"),
            "value": trigger.inner_text().replace("\n", " ").strip(),
        }
        page.keyboard.press("Enter")
        page.wait_for_timeout(120)
        closed = {
            "expanded": trigger.get_attribute("aria-expanded"),
            "focus": page.evaluate(ACTIVE),
        }
        page.keyboard.press("Enter")
        page.wait_for_timeout(100)
        page.keyboard.press("Escape")
        page.wait_for_timeout(120)
        out["combobox"] = {"before": before, "opened": opened, "switched": switched, "closed": closed, "afterEscape": page.evaluate(ACTIVE)}

        # 4. Bell dialog: focus moves in, Escape returns to trigger
        page.goto(BASE, wait_until="networkidle")
        page.wait_for_timeout(500)
        bell = page.locator('button[aria-controls="attention-panel"]')
        bell.focus()
        page.keyboard.press("Enter")
        page.wait_for_timeout(200)
        out["bell"] = {
            "expanded": bell.get_attribute("aria-expanded"),
            "focused": page.evaluate(ACTIVE),
            "dialog": page.locator("#attention-panel").count(),
        }
        page.keyboard.press("Escape")
        page.wait_for_timeout(150)
        out["bell"]["afterEscape"] = page.evaluate(ACTIVE)

        # 5. Stream health dialog: focus moves in, Escape returns to trigger
        stream = page.locator('button[aria-controls="stream-health-panel"]')
        stream.focus()
        page.keyboard.press("Enter")
        page.wait_for_timeout(200)
        out["stream"] = {
            "expanded": stream.get_attribute("aria-expanded"),
            "focused": page.evaluate(ACTIVE),
            "dialog": page.locator("#stream-health-panel").count(),
        }
        page.keyboard.press("Escape")
        page.wait_for_timeout(150)
        out["stream"]["afterEscape"] = page.evaluate(ACTIVE)

        # 6. Heading outline + landmarks + sort labels
        out["headings"] = page.evaluate(
            "() => [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].filter(h => h.offsetParent).map(h => `${h.tagName} ${h.textContent.trim()}`)"
        )
        out["landmarks"] = page.evaluate(
            """() => [...document.querySelectorAll('header,nav,main,aside,footer,form[role=search]')]
              .filter(el => el.offsetParent !== null)
              .map(el => `${el.tagName}${el.getAttribute('aria-label') ? `[${el.getAttribute('aria-label')}]` : ''}`)"""
        )
        out["sortLabels"] = page.eval_on_selector_all(
            "thead button",
            "els => els.map(e => ({ text: e.textContent.trim(), label: e.getAttribute('aria-label'), sort: e.closest('th').getAttribute('aria-sort') }))",
        )

        # 7. Mobile view switcher semantics at 375
        page.set_viewport_size({"width": 375, "height": 812})
        page.goto(BASE, wait_until="networkidle")
        page.wait_for_timeout(500)
        out["mobile"] = page.evaluate(
            """() => {
              const nav = document.querySelector('nav[aria-label="Views"]');
              return {
                navFound: !!nav,
                tablists: document.querySelectorAll('[role=tablist]').length,
                tabs: document.querySelectorAll('[role=tab]').length,
                buttons: nav ? [...nav.querySelectorAll('button')].map(b => ({
                  text: b.textContent.trim(), current: b.getAttribute('aria-current'), role: b.getAttribute('role'),
                })) : [],
                landmarks: [...document.querySelectorAll('header,nav,main')].filter(el => el.offsetParent !== null).map(el => `${el.tagName}${el.getAttribute('aria-label') ? `[${el.getAttribute('aria-label')}]` : ''}`),
              };
            }"""
        )
        out["mobile"]["getByRoleNav"] = page.get_by_role("navigation", name="Views").count()
        out["mobile"]["getByRoleTab"] = page.get_by_role("tab").count()

        out["errors"] = errors
        b.close()
    print(json.dumps(out, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
