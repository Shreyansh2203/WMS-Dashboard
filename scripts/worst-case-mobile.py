"""Worst-case fixture (?worst=1) at 320px — long names, extreme values, zero variance."""
import json
import os

from playwright.sync_api import sync_playwright

from _launch import launch_chromium

BASE = os.environ.get("RECON_BASE_URL", "http://localhost:4173/").rstrip("/") + "/?worst=1"
OUT = os.path.join(os.environ.get("TEMP", "."), "recon-responsive", "worst-320.png")

with sync_playwright() as p:
    b = launch_chromium(p)
    page = b.new_page(viewport={"width": 320, "height": 720})
    page.goto(BASE, wait_until="networkidle")
    page.wait_for_timeout(600)
    pre = page.evaluate(
        """() => ({
          overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          rows: document.querySelectorAll('[data-ref-btn]').length,
          dashes: [...document.querySelectorAll('td.tnum')].filter(td => td.textContent.trim() === '—').length,
          longItem: [...document.querySelectorAll('tbody td div[title]')]
            .map(d => ({ title: d.getAttribute('title'), len: (d.getAttribute('title') || '').length }))
            .sort((a, b) => b.len - a.len)[0] ?? null,
          hscrollPage: document.documentElement.scrollWidth > window.innerWidth + 1,
        })"""
    )
    page.locator("[data-ref-btn]").first.click()
    page.wait_for_timeout(400)
    drawer = page.evaluate(
        """() => {
          const d = document.querySelector('[role="dialog"][aria-labelledby="drawer-title"]');
          const r = d.getBoundingClientRect();
          return {
            rect: { left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width) },
            overflowX: d.scrollWidth - d.clientWidth,
            owner: [...d.querySelectorAll('*')].some(el => (el.textContent || '').includes('Bartholomew')),
            text: d.innerText.slice(0, 240),
          };
        }"""
    )
    page.screenshot(path=OUT, full_page=False)
    b.close()

print(json.dumps({"pre": pre, "drawer": drawer, "screenshot": OUT}, indent=2))
