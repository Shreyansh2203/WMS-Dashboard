"""Lazy-load proof: the queue view must not fetch the recharts chunk; the overview must."""
import json

from playwright.sync_api import sync_playwright

from _launch import launch_chromium

with sync_playwright() as p:
    b = launch_chromium(p)

    q = b.new_page(viewport={"width": 1440, "height": 900})
    reqs = []
    q.on("request", lambda r: reqs.append(r.url))
    q.goto("http://localhost:4173/?view=discrepancies", wait_until="networkidle")
    q.wait_for_timeout(800)
    queue_js = [u for u in reqs if u.endswith(".js")]
    queue_lazy = [u for u in queue_js if "AccuracyTrend-" in u]

    o = b.new_page(viewport={"width": 1440, "height": 900})
    reqs2 = []
    o.on("request", lambda r: reqs2.append(r.url))
    o.goto("http://localhost:4173/", wait_until="networkidle")
    o.wait_for_timeout(1200)
    overview_js = [u for u in reqs2 if u.endswith(".js")]
    overview_lazy = [u for u in overview_js if "AccuracyTrend-" in u]
    trend_visible = o.locator(".recharts-surface").count() > 0

    print(json.dumps({
        "queue_view_js": queue_js,
        "queue_view_lazy_chunk": queue_lazy,
        "overview_lazy_chunk": overview_lazy,
        "trend_rendered": trend_visible,
    }, indent=2))

    lazy_ok = not queue_lazy and len(overview_lazy) > 0 and trend_visible
    print("lazy-load gate:", "PASS" if lazy_ok else "FAIL")
    b.close()
    raise SystemExit(0 if lazy_ok else 1)
