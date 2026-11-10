from playwright.sync_api import sync_playwright
import json

PROBE = r"""
() => {
  const vw = innerWidth;
  const out = [];
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.right > vw + 1 || r.left < -1) {
      if (r.right > vw + 90) continue;
      const cs = getComputedStyle(el);
      if (cs.position === 'fixed' && cs.visibility === 'hidden') continue;
      out.push({
        tag: el.tagName,
        cls: String(el.className).slice(0, 90),
        text: (el.textContent || '').trim().slice(0, 50),
        left: Math.round(r.left), right: Math.round(r.right), w: Math.round(r.width),
      });
    }
  }
  out.sort((a, b) => b.right - a.right);
  const header = document.querySelector('header');
  const kids = header ? [...header.children].map((el) => {
    const r = el.getBoundingClientRect();
    return { tag: el.tagName, cls: String(el.className).slice(0, 70), left: Math.round(r.left), right: Math.round(r.right), w: Math.round(r.width) };
  }) : [];
  const footer = document.querySelector('main .border-t.border-edge');
  return { vw, scrollW: document.documentElement.scrollWidth, out: out.slice(0, 25), headerKids: kids, headerW: header ? Math.round(header.getBoundingClientRect().width) : null };
}
"""

with sync_playwright() as p:
    b = p.chromium.launch(headless=True, channel="chrome")
    page = b.new_page(viewport={"width": 320, "height": 720})
    page.goto("http://localhost:4173/", wait_until="networkidle")
    page.wait_for_timeout(600)
    print(json.dumps(page.evaluate(PROBE), indent=2))
    b.close()
