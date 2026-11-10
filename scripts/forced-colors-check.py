"""Forced-colors (Windows High Contrast) emulation via CDP.

Chrome emulates CSS media feature forced-colors: active. We verify that:
(1) system keywords are applied (Canvas/CanvasText/Field/Highlight),
(2) meaningful text stays visible,
(3) the three chart data-table disclosures exist,
(4) focus outline is non-transparent.

Screenshots saved to %TEMP%/recon-responsive/forced-colors.png for eyeballing.
"""
import json
import os

from playwright.sync_api import sync_playwright

BASE = "http://localhost:4173/"
OUT = os.path.join(os.environ.get("TEMP", "."), "recon-responsive", "forced-colors.png")

KW = {"CanvasText", "GrayText", "Highlight", "LinkText", "Canvas", "Field", "FieldText", "ButtonFace", "ButtonText", "Window", "WindowText"}

with sync_playwright() as p:
    b = p.chromium.launch(headless=True, channel="chrome")
    page = b.new_page(viewport={"width": 1440, "height": 900})
    cdp = page.context.new_cdp_session(page)
    cdp.send("Emulation.setEmulatedMedia", {
        "media": "screen",
        "features": [{"name": "forced-colors", "value": "active"}],
    })
    page.goto(BASE, wait_until="networkidle")
    page.wait_for_timeout(500)
    out = page.evaluate("""() => {
      const kw = new Set(['CanvasText','GrayText','Highlight','LinkText','Canvas','Field','FieldText','ButtonFace','ButtonText','Window','WindowText']);
      const body = getComputedStyle(document.body);
      const html = getComputedStyle(document.documentElement);
      const panel = document.querySelector('.panel');
      const bodyColor = body.color.trim();
      const bgColor = html.backgroundColor.trim();
      const panelBorder = panel ? getComputedStyle(panel).borderColor.trim() : null;
      const panelBg = panel ? getComputedStyle(panel).backgroundColor.trim() : null;
      const isKw = (v) => kw.has(v) || /^(Canvas|CanvasText|Field|GrayText|Highlight)/.test(v);
      return {
        bodyColor,
        bgColor,
        panelBorder,
        panelBg,
        bodyColorKeyword: isKw(bodyColor),
        backgroundKeyword: isKw(bgColor),
        borderKeyword: panelBorder ? isKw(panelBorder) : null,
        stats: {
          background: html.backgroundColor,
          foreground: html.color,
          panel: panelBg,
          panelBorder,
        },
        transparencyText: [...document.querySelectorAll('p,span,h1,h2,div,td,th')]
          .filter(el => el.offsetParent !== null)
          .filter(el => getComputedStyle(el).color === 'rgba(0, 0, 0, 0)').length,
        detailsCount: document.querySelectorAll('details').length,
        chartDataTables: [...document.querySelectorAll('details summary')].map(s => s.textContent.trim()),
      };
    }""")
    page.keyboard.press("Tab")
    focus_outline = page.evaluate("""() => {
      const el = document.activeElement;
      const cs = el ? getComputedStyle(el) : null;
      return cs ? { outlineColor: cs.outlineColor, outlineStyle: cs.outlineStyle, outlineWidth: cs.outlineWidth } : null;
    }""")
    page.screenshot(path=OUT, full_page=True)
    b.close()

out["focusOutline"] = focus_outline
out["screenshot"] = OUT
print(json.dumps(out, indent=2))
