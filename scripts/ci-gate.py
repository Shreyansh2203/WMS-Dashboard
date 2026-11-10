"""CI gate — runs the browser probes against a served build and asserts thresholds.

Usage (preview server must be running on RECON_BASE_URL, default http://localhost:4173):

    python scripts/ci-gate.py

Exits non-zero when any check fails. Runs:
  - scripts/responsive-check.py   (320–1920 overflow, targets, reduced motion, RTL)
  - scripts/a11y-audit.py         (keyboard order, skip link, ARIA contracts)
  - scripts/mobile-interactions.py(overlay geometry at 320px, focus restore)
  - scripts/worst-case-mobile.py  (?worst=1 stress fixture)
  - scripts/e2e.py                (14 end-to-end assertions)
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent

failures: list[str] = []


def check(name: str, good: bool, detail: str = "") -> None:
    print(("  PASS " if good else "  FAIL ") + name + ("" if good else f" - {detail}"))
    if not good:
        failures.append(name)


def run_json(script: str):
    proc = subprocess.run([sys.executable, str(HERE / script)], capture_output=True, text=True, cwd=ROOT)
    try:
        return json.loads(proc.stdout), proc.returncode
    except json.JSONDecodeError:
        return None, proc.returncode


def main() -> int:
    print("ci-gate")

    # 1. responsive probe
    resp, rc = run_json("responsive-check.py")
    if resp is None:
        check("responsive probe produced JSON", False, f"rc={rc}")
    else:
        check("responsive probe exits 0", rc == 0, f"rc={rc}")
        bad = [v["name"] for v in resp["viewports"] if v["doc"]["overflowX"] != 0 or v["smallTargets"]]
        check("no page overflow / undersized targets (320-1920)", not bad, str(bad))
        check("console errors empty", resp["errors"] == [], str(resp["errors"][:3]))
        rm = resp.get("reducedMotion") or {}
        check("reduced-motion kills .rise", rm.get("riseAnimation") == "none", str(rm))
        disc = resp.get("discrepancies") or {}
        scroller = disc.get("scroller")
        check(
            "queue contained (no page overflow; internal scroll >=640px, cards below)",
            disc.get("pageOverflowX") == 0 and (scroller is None or scroller.get("scrolls") is True),
            json.dumps(disc)[:200],
        )
        check("RTL no overflow", (resp.get("rtl") or {}).get("doc", {}).get("overflowX") == 0, json.dumps(resp.get("rtl"))[:200])

    # 2. a11y / keyboard probe
    a11y, rc = run_json("a11y-audit.py")
    if a11y is None:
        check("a11y probe produced JSON", False, f"rc={rc}")
    else:
        check("a11y probe exits 0", rc == 0, f"rc={rc}")
        check("console errors empty", a11y["errors"] == [], str(a11y["errors"][:3]))
        mob = a11y.get("mobile") or {}
        check("mobile nav uses aria-current (no tablist)", mob.get("navFound") is True and mob.get("tablists") == 0, str(mob))
        check(
            "all sortable columns expose aria-sort",
            sum(1 for s in a11y.get("sortLabels", []) if s.get("sort")) == 9,
            json.dumps(a11y.get("sortLabels"))[:200],
        )
        skip = a11y.get("skipLink") or {}
        check("skip link moves focus into main", (skip.get("afterEnter") or {}).get("id") == "main-content", str(skip))
        combo = a11y.get("combobox") or {}
        check(
            "warehouse combobox keeps focus + aria-activedescendant",
            combo.get("closed", {}).get("focus", {}).get("id") == "site-switcher",
            str(combo)[:200],
        )

    # 3. overlay geometry at 320px
    mob_int, rc = run_json("mobile-interactions.py")
    if mob_int is None:
        check("mobile-interactions produced JSON", False, f"rc={rc}")
    else:
        check("mobile-interactions exits 0", rc == 0, f"rc={rc}")
        check("console errors empty", mob_int.get("errors") == [], str(mob_int.get("errors")[:3]))
        overlays = mob_int.get("overlays") or {}
        out_of_view = [
            name for name, r in overlays.items()
            if r.get("left", 0) < -1 or r.get("right", 9999) > 320 + 1
        ]
        check("all overlays inside the 320px viewport", not out_of_view, str(out_of_view))
        drawer = mob_int.get("drawer") or {}
        check("drawer full-bleed, no page overflow", drawer.get("pageOverflowX") == 0, str(drawer))
        fr = mob_int.get("focusReturn") or {}
        check("drawer Escape restores focus to the row", fr.get("expected") == fr.get("actual"), str(fr))

    # 4. worst-case fixture
    worst, rc = run_json("worst-case-mobile.py")
    if worst is None:
        check("worst-case probe produced JSON", False, f"rc={rc}")
    else:
        pre = worst.get("pre") or {}
        check(
            "worst-case fixture: 0 overflow, no page scroll",
            pre.get("overflowX") == 0 and pre.get("hscrollPage") is False,
            str(pre),
        )

    # 5. end-to-end assertions
    e2e = subprocess.run([sys.executable, str(HERE / "e2e.py")], capture_output=True, text=True, cwd=ROOT)
    check("e2e suite passes (14 assertions)", e2e.returncode == 0, e2e.stdout[-500:])

    print()
    if failures:
        print(f"ci-gate FAILED: {len(failures)} check(s): {', '.join(failures)}")
        return 1
    print("ci-gate PASSED")
    return 0


if __name__ == "__main__":
    sys.exit(main())
