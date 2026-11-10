"""Responsive / RTL / reduced-motion probe for the Recon dashboard.

Runs headless Chrome against the local preview server and reports measured
layout facts (not screenshots-as-opinions). Screenshots are saved for the
key widths so the visual result can be inspected afterwards.
"""
from __future__ import annotations

import json
import os
import pathlib
import re
import sys

from playwright.sync_api import sync_playwright

from _launch import launch_chromium

BASE = "http://localhost:4173/"
OUT = pathlib.Path(os.environ.get("TEMP", ".")) / "recon-responsive"
OUT.mkdir(parents=True, exist_ok=True)

VIEWPORTS = [
    (320, 720, "320"),
    (375, 812, "375"),
    (640, 800, "640-200pct-zoom-proxy"),
    (768, 1024, "768"),
    (1024, 768, "1024"),
    (1280, 800, "1280"),
    (1440, 900, "1440"),
    (1920, 1080, "1920"),
]

MEASURE = r"""
() => {
  const doc = document.documentElement;
  const visible = (el) => {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
  };
  const rect = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
  };

  const sidebar = document.querySelector('aside');
  const mobileTabs = document.querySelector('nav[aria-label="Views"]');
  const search = document.querySelector('header input');
  const h1 = document.querySelector('h1');
  const main = document.querySelector('main');

  const smallTargets = [...document.querySelectorAll('button, a[href], input, [role="button"]')]
    .filter(visible)
    .map((el) => {
      const r = el.getBoundingClientRect();
      const label = (el.getAttribute('aria-label') || el.textContent || el.getAttribute('placeholder') || el.tagName).trim().slice(0, 42);
      return { label, w: Math.round(r.width), h: Math.round(r.height) };
    })
    .filter((t) => t.w < 24 || t.h < 24);

  const kpis = [...document.querySelectorAll('.kpi-card')].map((el) => rect(el));
  const kpiRows = new Set(kpis.map((r) => r && r.y)).size;

  const charts = [...document.querySelectorAll('.recharts-responsive-container')].map((el) => rect(el));

  const clipped = [...document.querySelectorAll('main *')]
    .filter((el) => {
      const cs = getComputedStyle(el);
      if (!/(hidden|clip)/.test(cs.overflowX)) return false;
      if (el.scrollWidth <= el.clientWidth + 2) return false;
      if (el.getAttribute('title') || el.getAttribute('aria-label')) return false;
      return visible(el);
    })
    .slice(0, 8)
    .map((el) => ({ tag: el.tagName, cls: String(el.className).slice(0, 70), text: (el.textContent || '').trim().slice(0, 60), sw: el.scrollWidth, cw: el.clientWidth }));

  return {
    viewport: { w: innerWidth, h: innerHeight },
    doc: { scrollW: doc.scrollWidth, clientW: doc.clientWidth, overflowX: doc.scrollWidth - doc.clientWidth },
    bodyOverflowX: getComputedStyle(document.body).overflowX,
    sidebar: { visible: visible(sidebar), rect: rect(sidebar) },
    mobileTabs: { visible: visible(mobileTabs), rect: rect(mobileTabs) },
    search: rect(search),
    h1: { text: h1 ? h1.textContent.trim() : null, rect: rect(h1) },
    main: rect(main),
    kpiCount: kpis.length,
    kpiRows,
    charts,
    smallTargets,
    clipped,
  };
}
"""

TABLE_MEASURE = r"""
() => {
  const doc = document.documentElement;
  const scroller = document.querySelector('main .overflow-auto');
  const firstTh = document.querySelector('thead th');
  const firstTd = document.querySelector('tbody td');
  const cs = firstTh ? getComputedStyle(firstTh) : null;
  const tdCs = firstTd ? getComputedStyle(firstTd) : null;
  const r = scroller ? scroller.getBoundingClientRect() : null;
  return {
    pageOverflowX: doc.scrollWidth - doc.clientWidth,
    scroller: scroller ? {
      rect: { x: Math.round(r.x), w: Math.round(r.width) },
      scrollW: scroller.scrollWidth,
      clientW: scroller.clientWidth,
      scrolls: scroller.scrollWidth > scroller.clientWidth + 1,
      overflowX: getComputedStyle(scroller).overflowX,
      overscroll: getComputedStyle(scroller).overscrollBehaviorX,
    } : null,
    firstTh: cs ? { position: cs.position, left: cs.left, top: cs.top, zIndex: cs.zIndex } : null,
    firstTd: tdCs ? { position: tdCs.position, left: tdCs.left, background: tdCs.backgroundColor } : null,
  };
}
"""


def main() -> int:
    report = {"base": BASE, "viewports": [], "discrepancies": None, "rtl": None, "reducedMotion": None, "errors": []}
    with sync_playwright() as p:
        browser = launch_chromium(p)
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()
        console_errors: list[str] = []
        page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: console_errors.append(str(e)))

        for w, h, name in VIEWPORTS:
            page.set_viewport_size({"width": w, "height": h})
            page.goto(BASE, wait_until="networkidle")
            page.wait_for_timeout(650)  # let the one-shot entrance settle
            data = page.evaluate(MEASURE)
            data["name"] = name
            if w in (320, 375, 768, 1024, 1440, 1920):
                shot = OUT / f"overview-{name}.png"
                page.screenshot(path=str(shot), full_page=True)
                data["screenshot"] = str(shot)
            report["viewports"].append(data)

        # Discrepancy queue at the narrowest width
        page.set_viewport_size({"width": 375, "height": 812})
        page.goto(BASE, wait_until="networkidle")
        page.get_by_role("button", name=re.compile(r"^Discrepancies")).click()
        page.wait_for_timeout(450)
        report["discrepancies"] = page.evaluate(TABLE_MEASURE)
        shot = OUT / "discrepancies-375.png"
        page.screenshot(path=str(shot), full_page=True)
        report["discrepancies"]["screenshot"] = str(shot)

        # RTL probe at desktop width
        page.set_viewport_size({"width": 1440, "height": 900})
        page.goto(BASE, wait_until="networkidle")
        page.evaluate("document.documentElement.dir = 'rtl'")
        page.wait_for_timeout(300)
        report["rtl"] = page.evaluate(MEASURE)
        shot = OUT / "rtl-1440.png"
        page.screenshot(path=str(shot), full_page=True)
        report["rtl"]["screenshot"] = str(shot)

        # Reduced motion: entrance animation must be off
        rm = browser.new_context(viewport={"width": 1440, "height": 900}, reduced_motion="reduce")
        rm_page = rm.new_page()
        rm_page.goto(BASE, wait_until="networkidle")
        rm_page.wait_for_timeout(150)
        report["reducedMotion"] = rm_page.evaluate(
            """() => {
              const el = document.querySelector('.rise');
              return {
                matches: matchMedia('(prefers-reduced-motion: reduce)').matches,
                riseAnimation: el ? getComputedStyle(el).animationName : null,
                riseDuration: el ? getComputedStyle(el).animationDuration : null,
              };
            }"""
        )
        rm.close()

        report["errors"] = console_errors
        browser.close()

    print(json.dumps(report, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
