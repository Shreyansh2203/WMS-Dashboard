"""WCAG 1.4.4 / 1.4.10 / 1.4.12 inspect-tier probe: zoom 200/400% and text spacing.

Zoom is approximated with CSS zoom (true browser zoom isn't exposed via CDP).
Text spacing uses the WCAG 1.4.12 reference override.
"""
import json
import os

from playwright.sync_api import sync_playwright

from _launch import launch_chromium

SPACING = """
* { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; }
p { margin-bottom: 2em !important; }
"""

with sync_playwright() as p:
    b = launch_chromium(p)
    page = b.new_page(viewport={"width": 1440, "height": 900})
    page.goto("http://localhost:4173/", wait_until="networkidle")
    page.wait_for_timeout(600)

    out = {}

    # 200% and 400% zoom via CSS zoom (viewport stays 1440 CSS px; layout reflows)
    for zoom in (2, 4):
        page.evaluate(f"document.body.style.zoom = {zoom}")
        page.wait_for_timeout(250)
        out[f"zoom_{zoom}"] = page.evaluate("""() => ({
          overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          clientWidth: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth,
        })""")
        page.evaluate("document.body.style.zoom = ''")
        page.wait_for_timeout(150)

    # text spacing override
    page.evaluate(f"""() => {{
      const s = document.createElement('style');
      s.id = 'wcag-spacing';
      s.textContent = {json.dumps(SPACING)};
      document.head.appendChild(s);
    }}""")
    page.wait_for_timeout(250)
    out["text_spacing"] = page.evaluate("""() => {
      const doc = document.documentElement;
      const clipped = [];
      for (const el of document.querySelectorAll('main *')) {
        const cs = getComputedStyle(el);
        if (!/(hidden|clip)/.test(cs.overflowX) && !/(hidden|clip)/.test(cs.overflowY)) continue;
        if (el.scrollWidth > el.clientWidth + 2 || el.scrollHeight > el.clientHeight + 2) {
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue;
          clipped.push({ tag: el.tagName, cls: String(el.className).slice(0, 60), text: (el.textContent || '').trim().slice(0, 40), sw: el.scrollWidth, cw: el.clientWidth, sh: el.scrollHeight, ch: el.clientHeight });
        }
      }
      return {
        overflowX: doc.scrollWidth - doc.clientWidth,
        clippedCount: clipped.length,
        clipped: clipped.slice(0, 8),
      };
    }""")
    page.evaluate("document.getElementById('wcag-spacing')?.remove()")

    b.close()

print(json.dumps(out, indent=2))
