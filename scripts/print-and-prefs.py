"""Print + reduced-motion + data-table disclosure checks."""
import json

from playwright.sync_api import sync_playwright

BASE = "http://localhost:4173/"

with sync_playwright() as p:
    b = p.chromium.launch(headless=True, channel="chrome")

    # 1. Print emulation: chrome hidden, table visible, signature after main
    pg = b.new_page(viewport={"width": 1440, "height": 900})
    pg.goto(BASE, wait_until="networkidle")
    pg.wait_for_timeout(400)
    pg.emulate_media(media="print")
    pg.wait_for_timeout(150)
    print_info = pg.evaluate("""() => {
      const q = (s) => { const el = document.querySelector(s); return el ? { display: getComputedStyle(el).display, visible: el.offsetParent !== null } : null; };
      return {
        sidebar: q('aside'),
        topbar: q('header'),
        banner: q('header') ? 'n/a' : 'n/a',
        dialogs: [...document.querySelectorAll('[role=dialog], [role=presentation]')].length,
        selects: [...document.querySelectorAll('select')].map(e => getComputedStyle(e).display),
        table: q('table'),
        mainOverflow: getComputedStyle(document.querySelector('main')).overflow,
      };
    }""")
    print("PRINT:", json.dumps(print_info, indent=2))

    # 2. Data table disclosure opens and holds the full per-day series
    pg2 = b.new_page(viewport={"width": 1440, "height": 900})
    pg2.goto(BASE, wait_until="networkidle")
    pg2.wait_for_timeout(500)
    print("details present:", pg2.locator('details summary').count())
    pg2.locator('details summary').click()
    pg2.wait_for_timeout(200)
    rows = pg2.locator('details tbody tr').all_inner_texts()
    print("table rows:", len(rows), "| first:", rows[0] if rows else None)

    # 3. Reduced motion: .rise must not animate
    ctx = b.new_context(viewport={"width": 1440, "height": 900}, reduced_motion="reduce")
    rm = ctx.new_page()
    rm.goto(BASE, wait_until="networkidle")
    rm.wait_for_timeout(150)
    print("RM:", json.dumps(rm.evaluate("""() => {
      const el = document.querySelector('.rise');
      const matches = matchMedia('(prefers-reduced-motion: reduce)').matches;
      return { matches, riseAnimation: el ? getComputedStyle(el).animationName : null, riseDuration: el ? getComputedStyle(el).animationDuration : null };
    }""")))
    ctx.close()

    # 4. Worst case at 320
    pg3 = b.new_page(viewport={"width": 320, "height": 720})
    pg3.goto(BASE + "?worst=1", wait_until="networkidle")
    pg3.wait_for_timeout(500)
    print("WORST:", json.dumps(pg3.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")))

    b.close()
