"""Shared Playwright launcher for the verification scripts.

Uses the installed Google Chrome when available (local dev), falling back to
Playwright's bundled Chromium (CI runners).
"""


def launch_chromium(playwright):
    try:
        return playwright.chromium.launch(headless=True, channel="chrome")
    except Exception:
        return playwright.chromium.launch(headless=True)
