"""Network-isolated Playwright verification; no production destination is allowed.

Prerequisite: Python Playwright 1.56.0 + its Chromium (existing host cache works).
All source generation, compilation and server files live in a temporary copy.
No real SDK, form submission, email/Sheets service or Google account is contacted.
"""
import argparse
import contextlib
import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import tempfile
import time
import urllib.request
from urllib.parse import urlparse, parse_qs


ROOT = Path(__file__).resolve().parents[1]
DENIED = {"ad_storage": "denied", "ad_user_data": "denied", "ad_personalization": "denied"}
POLICY = "2026-10-26"
OBSERVE_QUEUE = """
(() => {
  let layer;
  Object.defineProperty(window, 'dataLayer', {
    configurable: true, get: () => layer,
    set: value => {
      layer = value;
      const push = value.push;
      value.push = function(...entries) {
        entries.forEach(entry => { void window.__captureCommand(Array.from(entry)); });
        return push.apply(this, entries);
      };
    }
  });
})();
"""
ZENMAID_FIXTURE = """
(() => {
  const container = document.querySelector('.zenmaid-container');
  if (!container || container.querySelector('form')) return;
  const form = document.createElement('form');
  form.innerHTML = '<label>Synthetic booking field<input name="mock_booking"></label><button type="button">Mock booking only</button>';
  form.addEventListener('submit', event => event.preventDefault());
  container.append(form);
})();
"""
TURNSTILE_FIXTURE = """
window.turnstile = {
  render(element, options) {
    window.__syntheticTurnstileCallback = options.callback;
    queueMicrotask(() => options.callback('synthetic-verification-token'));
    return 'synthetic-widget';
  },
  reset() { window.__syntheticTurnstileCallback?.('synthetic-verification-token'); },
  remove() {}
};
"""


def run(command, cwd, env, log):
    with log.open('w') as stream:
        subprocess.run(command, cwd=cwd, env=env, stdout=stream, stderr=subprocess.STDOUT, check=True)


def free_port():
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        return sock.getsockname()[1]


@contextlib.contextmanager
def server(work, env, output, preview):
    port = free_port()
    origin = f'http://127.0.0.1:{port}'
    command = [str(work / 'node_modules/.bin/vite')]
    command += ['preview'] if preview else ['--mode', 'development']
    command += ['--host', '127.0.0.1', '--port', str(port), '--strictPort']
    with (output / ('preview-server.log' if preview else 'dev-server.log')).open('w') as log:
        process = subprocess.Popen(command, cwd=work, env=env, stdout=log, stderr=subprocess.STDOUT)
        try:
            deadline = time.monotonic() + 25
            while True:
                if process.poll() is not None:
                    raise RuntimeError('Local server stopped; inspect server log')
                try:
                    with urllib.request.urlopen(origin, timeout=1) as response:
                        if response.status == 200:
                            break
                except OSError:
                    if time.monotonic() >= deadline:
                        raise RuntimeError('Local server did not become ready')
                    time.sleep(0.1)
            yield origin
        finally:
            process.terminate()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()


class IsolatedSession:
    def __init__(self, browser, origin, *, width=1280, gpc=False, response='new'):
        self.origin = origin
        self.commands = []
        self.requests = []
        self.violations = []
        self.stubs = []
        self.response = response
        self.pending_route = None
        self.context = browser.new_context(viewport={'width': width, 'height': 900}, service_workers='block')
        self.context.set_default_timeout(8000)
        self.context.expose_binding('__captureCommand', lambda source, command: self.commands.append(command))
        self.context.add_init_script(OBSERVE_QUEUE)
        self.context.add_init_script(f"Object.defineProperty(navigator, 'globalPrivacyControl', {{value: {json.dumps(gpc)}, configurable: true}})")
        self.context.route('**/*', self.route)
        self.page = self.context.new_page()

    def route(self, route):
        request = route.request
        url = urlparse(request.url)
        if request.url.startswith(self.origin + '/'):
            if request.method == 'GET' and url.path == '/__measurement-control':
                route.fulfill(content_type='text/html', body='<!doctype html><title>Synthetic consent control</title>')
                return
            if url.path.startswith('/api/'):
                if request.method != 'POST' or url.path != '/api/waitlist':
                    self.violations.append(request.url)
                    route.abort()
                    return
                self.requests.append(request.post_data_json)
                if self.response == 'pending':
                    self.pending_route = route
                elif self.response == 'error':
                    route.fulfill(status=503, json={'ok': False, 'error': {'code': 'SERVICE_UNAVAILABLE'}})
                elif self.response == 'duplicate':
                    route.fulfill(json={'ok': True, 'data': {'acknowledged': True}})
                else:
                    route.fulfill(status=201, json={'ok': True, 'data': {
                        'id': '00000000-0000-4000-8000-000000000099',
                        'created_at': '2026-11-05T12:00:00Z', 'zip_token': 'synthetic-zip-capability'}})
                return
            if request.method == 'GET':
                route.continue_()
                return
        if url.netloc == 'www.googletagmanager.com' and url.path == '/gtag/js' and parse_qs(url.query).get('id') == ['G-PHASE0B']:
            self.stubs.append('google-loader')
            route.fulfill(content_type='application/javascript', body='/* No Google SDK: application queue assertions only. */')
        elif request.url == 'https://app.zenmaid.com/scripts/booking-form.js':
            self.stubs.append('zenmaid-render-only')
            route.fulfill(content_type='application/javascript', body=ZENMAID_FIXTURE)
        elif request.url == 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit':
            self.stubs.append('synthetic-turnstile')
            route.fulfill(content_type='application/javascript', body=TURNSTILE_FIXTURE)
        else:
            self.violations.append(request.url)
            route.abort()

    def goto(self, path):
        self.page.goto(self.origin + path)
        self.page.wait_for_load_state('networkidle')
        # Reconnaissance records the rendered surface before selector actions.
        self.page.locator('main').wait_for()

    def names(self):
        return [command[1] for command in self.commands if command[0] == 'event']

    def wait_events(self, expected):
        deadline = time.monotonic() + 8
        while self.names() != expected:
            if time.monotonic() >= deadline:
                raise AssertionError(f'Expected {expected}, observed {self.names()}')
            self.page.wait_for_timeout(25)

    def accept(self):
        self.page.get_by_role('button', name='Allow tracking', exact=True).click()
        self.page.wait_for_function("Boolean(document.querySelector('#mirembe-ga4'))")
        self.page.wait_for_load_state('networkidle')

    def no_external_leaks(self):
        assert not self.violations, f'Unexpected request blocked: {self.violations}'
        assert not any(name.startswith('ads_conversion_') or name in ['generate_lead', 'booking_confirmed'] for name in self.names())
        for command in self.commands:
            if command[0] == 'consent':
                assert all(command[2].get(key) == value for key, value in DENIED.items())

    def close(self):
        self.no_external_leaks()
        self.context.close()


def booking_checks(browser, origin, output, width):
    session = IsolatedSession(browser, origin, width=width)
    try:
        page = session.page
        session.goto('/booking?utm_source=google&utm_medium=cpc&utm_campaign=holiday_2026&gclid=opaque&email=private@example.test')
        page.get_by_label('Synthetic booking field').scroll_into_view_if_needed()
        assert session.commands == []
        assert page.locator('#mirembe-ga4').count() == 0
        session.accept()
        session.wait_events(['page_view', 'booking_form_view'])
        configuration = [command for command in session.commands if command[0] == 'config']
        assert len(configuration) == 1 and configuration[0][1] == 'G-PHASE0B'
        assert configuration[0][2]['send_page_view'] is False
        # Manual return is explicitly a proxy and requires no real booking POST.
        session.goto('/booking/thankyou')
        session.wait_events(['page_view', 'booking_form_view', 'page_view', 'booking_complete'])
        assert session.requests == []
        page.reload(wait_until='networkidle')
        session.wait_events(['page_view', 'booking_form_view', 'page_view', 'booking_complete', 'page_view'])
        page.get_by_role('button', name='Change language, current language: English', exact=True).click()
        page.get_by_role('menuitemradio', name='Español', exact=True).click()
        session.wait_events(['page_view', 'booking_form_view', 'page_view', 'booking_complete', 'page_view', 'language_change', 'page_view'])
        assert page.locator('html').get_attribute('lang') == 'es'
        page.screenshot(path=str(output / f'booking-proxy-{width}.png'), full_page=False)
        serialized = json.dumps([command for command in session.commands if command[0] == 'event'])
        assert not any(secret in serialized for secret in ['private@example.test', 'opaque', 'gclid', 'gbraid', 'wbraid'])
        return {'case': f'booking-proxy-refresh-locale-{width}', 'events': session.names(), 'stubs': session.stubs}
    finally:
        session.close()


def direct_and_withdrawal_checks(browser, origin):
    session = IsolatedSession(browser, origin)
    try:
        session.goto('/booking/thankyou')
        assert session.commands == []
        session.accept()
        session.wait_events(['page_view'])
        session.page.get_by_role('button', name='Tracking preferences', exact=True).click()
        session.page.get_by_role('button', name='Decline', exact=True).click()
        before = list(session.names())
        session.page.get_by_role('button', name='Change language, current language: English', exact=True).click()
        session.page.get_by_role('menuitemradio', name='Español', exact=True).click()
        assert session.names() == before
        session.goto('/booking')
        assert session.names() == before
        return {'case': 'direct-return-and-withdrawal', 'events': session.names()}
    finally:
        session.close()


def gpc_check(browser, origin):
    session = IsolatedSession(browser, origin, gpc=True)
    try:
        session.goto('/booking')
        session.page.get_by_label('Synthetic booking field').scroll_into_view_if_needed()
        session.page.get_by_role('button', name='Tracking preferences', exact=True).click()
        assert session.page.get_by_role('button', name='Allow tracking', exact=True).count() == 0
        assert session.commands == []
        assert 'google-loader' not in session.stubs
        return {'case': 'gpc-denies-analytics', 'events': []}
    finally:
        session.close()


def waitlist_check(browser, origin, *, response='new', consent=True, preview=False):
    session = IsolatedSession(browser, origin, response=response)
    try:
        page = session.page
        session.goto('/booking?utm_source=google&utm_medium=cpc&utm_campaign=holiday_2026&gclid=opaque')
        if consent:
            session.accept()
        else:
            page.get_by_role('button', name='Decline', exact=True).click()
        page.get_by_role('button', name='Join the Waitlist', exact=True).first.click()
        dialog = page.locator('dialog.waitlist-dialog')
        dialog.get_by_label('Email address', exact=True).fill('synthetic@example.test')
        dialog.get_by_role('button', name='Join the Waitlist', exact=True).click()
        if response == 'error':
            page.get_by_role('alert').first.wait_for()
        else:
            page.get_by_role('heading', name='You’re on the list!', exact=True).last.wait_for()
        assert len(session.requests) == 1
        body = session.requests[0]
        assert body['email'] == 'synthetic@example.test' and body['turnstileToken'] == 'synthetic-verification-token'
        assert ('attribution' in body) == (preview and consent)
        if 'attribution' in body:
            assert body['attribution'] == {'version': 1, 'consent': {'analytics': True, 'globalPrivacyControl': False, 'policyVersion': POLICY},
                'firstTouch': {'utm_source': 'google', 'utm_medium': 'cpc', 'utm_campaign': 'holiday_2026'},
                'lastTouch': {'utm_source': 'google', 'utm_medium': 'cpc', 'utm_campaign': 'holiday_2026'}}
        names = session.names()
        assert names.count('waitlist_signup_success') == (1 if consent and response == 'new' else 0)
        assert names.count('waitlist_signup_error') == (1 if consent and response == 'error' else 0)
        assert names.count('waitlist_form_submit') == (1 if consent else 0)
        assert names.count('waitlist_cta_click') == (1 if consent else 0)
        assert names.count('waitlist_form_start') == (1 if consent else 0)
        serialized = json.dumps([command for command in session.commands if command[0] == 'event'])
        assert not any(secret in serialized for secret in ['synthetic@example.test', '00000000-0000-4000-8000-000000000099', 'opaque', 'gclid', 'policyVersion'])
        return {'case': f'waitlist-{response}-consent-{consent}-preview-{preview}', 'events': names, 'metadata_submitted_to_mock_only': 'attribution' in body}
    finally:
        session.close()


def cta_check(browser, origin):
    session = IsolatedSession(browser, origin)
    try:
        session.goto('/')
        session.accept()
        later = session.page.get_by_role('button', name='Maybe Later', exact=True)
        if later.is_visible():
            later.click()
        session.page.get_by_role('link', name='Request a Cleaning', exact=True).first.click()
        session.page.wait_for_load_state('networkidle')
        session.wait_events(['page_view', 'booking_cta_click', 'page_view', 'booking_form_view'])
        return {'case': 'booking-cta-distinct-from-visible-form', 'events': session.names()}
    finally:
        session.close()


def pending_withdrawal_check(browser, origin):
    session = IsolatedSession(browser, origin, response='pending')
    try:
        page = session.page
        session.goto('/booking')
        session.accept()
        page.get_by_role('button', name='Join the Waitlist', exact=True).first.click()
        dialog = page.locator('dialog.waitlist-dialog')
        dialog.get_by_label('Email address', exact=True).fill('synthetic@example.test')
        dialog.get_by_role('button', name='Join the Waitlist', exact=True).click()
        page.wait_for_function("document.querySelector('form button[type=submit]')?.disabled === true")
        assert session.pending_route is not None
        # A separate same-origin fixture exercises real cross-tab storage events
        # while the native form dialog is submitting. It contains no app or SDK.
        control = session.context.new_page()
        control.goto(origin + '/__measurement-control')
        control.evaluate("localStorage.setItem('mirembe:marketing-consent:v2:G-PHASE0B:', 'declined')")
        page.wait_for_function("window['ga-disable-G-PHASE0B'] === true")
        before = list(session.names())
        session.pending_route.fulfill(status=201, json={'ok': True, 'data': {
            'id': '00000000-0000-4000-8000-000000000099',
            'created_at': '2026-11-05T12:00:00Z', 'zip_token': 'synthetic-zip-capability'}})
        dialog.get_by_role('heading', name='You’re on the list!', exact=True).last.wait_for()
        assert session.names() == before
        assert 'waitlist_signup_success' not in session.names()
        assert page.evaluate("sessionStorage.getItem('mirembe:booking-journey:v1')") is None
        return {'case': 'cross-tab-withdrawal-during-pending-signup', 'events': session.names(), 'saved_ui_without_optional_success': True}
    finally:
        session.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT / 'artifacts/measurement-phase0b')
    parser.add_argument('--skip-unit-tests', action='store_true', help='Repeat browser checks after an already passing isolated unit-test run')
    args = parser.parse_args()
    from playwright.sync_api import sync_playwright
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    env = {key: os.environ[key] for key in ['PATH', 'HOME', 'TMPDIR', 'LANG'] if key in os.environ}
    env.update({'VERCEL_ENV': 'production', 'VITE_GA4_MEASUREMENT_ID': 'G-PHASE0B', 'VITE_META_PIXEL_ID': '',
        'VITE_PRIVACY_POLICY_URL': 'https://privacy.test/policy', 'VITE_ENABLE_MARKETING_IN_DEVELOPMENT': 'true',
        'VITE_ENABLE_WAITLIST_ATTRIBUTION_PREVIEW': 'true', 'VITE_TURNSTILE_SITE_KEY': 'synthetic-site-key'})
    with tempfile.TemporaryDirectory(prefix='mirembe-phase0b-') as temporary:
        work = Path(temporary) / 'site'
        shutil.copytree(ROOT, work, ignore=shutil.ignore_patterns('.git', 'node_modules', 'dist', '.env*', '.vercel', '.agents', '.codex', '.aws', 'artifacts', 'docs', '*.tsbuildinfo', '__pycache__'))
        (work / 'node_modules').symlink_to(ROOT / 'node_modules', target_is_directory=True)
        run(['npm', 'run', 'build'], work, env, output / 'production-build.log')
        run(['npm', 'run', 'test:seo'], work, env, output / 'production-seo.log')
        if not args.skip_unit_tests:
            run(['npm', 'test', '--', '--reporter=dot'], work, env, output / 'production-tests.log')
        results = []
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True)
            try:
                with server(work, env, output, preview=True) as origin:
                    results += [booking_checks(browser, origin, output, width) for width in [1280, 390]]
                    results += [direct_and_withdrawal_checks(browser, origin), gpc_check(browser, origin), cta_check(browser, origin), pending_withdrawal_check(browser, origin)]
                    results += [waitlist_check(browser, origin, response=kind) for kind in ['new', 'duplicate', 'error']]
                    results.append(waitlist_check(browser, origin, consent=False))
                with server(work, env, output, preview=False) as origin:
                    results.append(waitlist_check(browser, origin, preview=True))
                    results.append(waitlist_check(browser, origin, preview=True, consent=False))
            finally:
                browser.close()
        (output / 'browser-results.json').write_text(json.dumps({'passed': len(results), 'production_services_contacted': False,
            'scope': 'application queue, synthetic SDK/API fixtures; not Google-account rule execution or live ingestion', 'results': results}, indent=2))
        print(json.dumps({'passed': len(results), 'artifacts': str(output), 'production_services_contacted': False}))


if __name__ == '__main__':
    main()
