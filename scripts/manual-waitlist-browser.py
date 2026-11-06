"""Open a manual waitlist session against Vite, using the Phase 0B mocks only."""
import argparse
import contextlib
import importlib.util
from pathlib import Path
import runpy
import signal
import sys
from threading import Event
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parents[1]
ORIGIN = 'http://localhost:5173'
SCENARIOS = {
    'new@example.test': 'new',
    'duplicate@example.test': 'duplicate',
    'failed@example.test': 'error',
}
# Loading definitions does not invoke the harness's build/SEO/test entry point.
IsolatedSession = runpy.run_path(str(ROOT / 'scripts/test-measurement-browser.py'))['IsolatedSession']


class ManualWaitlistSession(IsolatedSession):
    def __init__(self, browser):
        super().__init__(browser, ORIGIN, response='error')
        # No connect_to_server call: sockets (including HMR) stay mocked locally.
        # A no-op also avoids a sync-API close call inside the socket callback.
        self.context.route_web_socket('**/*', lambda socket: None)

    def route(self, route):
        request = route.request
        local = request.url.startswith(self.origin + '/')
        path = urlparse(request.url).path
        if local and request.method == 'POST' and path == '/api/waitlist':
            try:
                body = request.post_data_json
                email = body.get('email', '') if isinstance(body, dict) else ''
                self.response = SCENARIOS.get(email, 'error') if isinstance(email, str) else 'error'
            except ValueError:
                route.abort()
                return
        if local and request.method == 'GET' and not path.startswith('/api/'):
            # Never let a local redirect bypass routing and reach another host.
            response = route.fetch(max_redirects=0)
            if 300 <= response.status < 400:
                route.abort()
            else:
                route.fulfill(response=response)
            return
        # Reuse synthetic response bodies, Turnstile/SDK fixtures and denials.
        super().route(route)


def load_playwright():
    # Reuse the active Python environment or the existing Phase 0B cache.
    # Never install packages or browsers as a side effect of launching.
    if importlib.util.find_spec('playwright') is None:
        cached = Path('/tmp/mirembe-phase0b-playwright')
        if cached.is_dir():
            sys.path.insert(0, str(cached))
    try:
        from playwright.sync_api import Error, sync_playwright
    except ModuleNotFoundError:
        raise SystemExit('Python Playwright is unavailable. See README: Manual waitlist testing for optional tooling setup.') from None
    return Error, sync_playwright


def run_session(Error, sync_playwright, finished):
    with sync_playwright() as playwright:
        browser = None
        session = None
        try:
            # Python requests shutdown; Chromium must not handle Ctrl+C itself.
            browser = playwright.chromium.launch(headless=False, handle_sigint=False)
            session = ManualWaitlistSession(browser)
            session.goto('/booking')
            session.page.get_by_role('button', name='Decline', exact=True).click()
            print('\nManual waitlist testing — synthetic responses only; tracking declined.', flush=True)
            print('Click Join the Waitlist. Use new@example.test, duplicate@example.test, or failed@example.test.', flush=True)
            print('Reload the page between cases. Leave the optional ZIP step blank.', flush=True)
            print('FINISH: press Ctrl+C in this terminal, or close the test window. There is no time limit.\n', flush=True)
            # Pump events without an idle timeout. A signal only sets the flag,
            # avoiding KeyboardInterrupt in a routing callback or during cleanup.
            while not finished.is_set() and browser.is_connected() and not session.page.is_closed():
                session.page.wait_for_timeout(200)
        except Error:
            if browser is None or (browser.is_connected() and (session is None or not session.page.is_closed())):
                print('Could not run the test browser. Check Vite at localhost:5173 and the Playwright Chromium installation. No live API fallback is used.', file=sys.stderr)
                return 1
        finally:
            # Exploration can include intentionally blocked requests, so close
            # directly rather than invoking the harness's test assertions.
            if session is not None:
                with contextlib.suppress(Error):
                    session.context.close()
            if browser is not None:
                with contextlib.suppress(Error):
                    browser.close()
            print('Manual test session closed; browser resources cleaned up.', flush=True)
    return 0


def main():
    argparse.ArgumentParser(description=__doc__).parse_args()
    Error, sync_playwright = load_playwright()
    finished = Event()
    previous = signal.signal(signal.SIGINT, lambda signum, frame: finished.set())
    try:
        return run_session(Error, sync_playwright, finished)
    finally:
        signal.signal(signal.SIGINT, previous)


if __name__ == '__main__':
    raise SystemExit(main())
