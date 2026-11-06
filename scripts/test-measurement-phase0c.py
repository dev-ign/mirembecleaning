"""Focused Phase 0C browser matrix: synthetic services, no build/SEO/unit suite."""
import argparse
import json
import os
from pathlib import Path
import runpy
import shutil
import tempfile
import time


ROOT = Path(__file__).resolve().parents[1]
HARNESS = runpy.run_path(str(ROOT / 'scripts/test-measurement-browser.py'))
load_playwright = runpy.run_path(str(ROOT / 'scripts/manual-waitlist-browser.py'))['load_playwright']


class IsolatedBrowser:
    def __init__(self, browser):
        self.browser = browser

    def new_context(self, **options):
        context = self.browser.new_context(**options)
        context.route_web_socket('**/*', lambda socket: None)
        return context


def session(browser, origin, **options):
    return HARNESS['IsolatedSession'](browser, origin, **options)


def pageviews(value):
    return [command[2]['page_path'] for command in value.commands if command[:2] == ['event', 'page_view']]


def expect_views(value, paths):
    deadline = time.monotonic() + 8
    while pageviews(value) != paths:
        if time.monotonic() >= deadline:
            raise AssertionError(f'Expected application views {paths}; got {pageviews(value)}')
        value.page.wait_for_timeout(25)


def language(value, label):
    value.page.locator('.language-trigger').click()
    value.page.get_by_role('menuitemradio', name=label, exact=True).click()


def navigation_check(browser, origin):
    value = session(browser, origin)
    try:
        value.goto('/privacy?email=private@example.test')
        assert value.commands == []
        value.accept()
        paths = ['/privacy']
        expect_views(value, paths)
        value.page.get_by_role('link', name='Request a Cleaning', exact=True).first.click()
        value.page.wait_for_load_state('networkidle')
        paths += ['/booking']
        expect_views(value, paths)
        configurations = lambda: [c for c in value.commands if c[0] == 'config']
        before = len(configurations())
        language(value, 'Español')
        paths += ['/es/booking']
        expect_views(value, paths)
        value.page.go_back()
        paths += ['/booking']
        expect_views(value, paths)
        value.page.go_forward()
        paths += ['/es/booking']
        expect_views(value, paths)
        assert len(configurations()) == before
        value.goto('/privacy')
        paths += ['/privacy']
        expect_views(value, paths)
        value.page.go_back(wait_until='networkidle')
        paths += ['/es/booking']
        expect_views(value, paths)
        value.page.go_forward(wait_until='networkidle')
        paths += ['/privacy']
        expect_views(value, paths)
        value.page.reload(wait_until='networkidle')
        paths += ['/privacy']
        expect_views(value, paths)
        assert all(c[2]['send_page_view'] is False for c in configurations())
        payloads = [command for command in value.commands if command[0] in ['config', 'event']]
        assert 'private@example.test' not in json.dumps(payloads)
        return {'case': 'initial-internal-locale-history-document-history-refresh', 'application_page_paths': paths,
            'same_document_reinitializations': 0, 'google_automatic_events_executed': False,
            'bfcache_restore_verified': False}
    finally:
        value.close()


def booking_check(browser, origin):
    value = session(browser, origin)
    try:
        value.goto('/booking')
        value.accept()
        value.page.get_by_label('Synthetic booking field').scroll_into_view_if_needed()
        value.page.wait_for_function("sessionStorage.getItem('mirembe:booking-journey:v1') !== null")
        # A manual return is deliberately not a submitted or confirmed booking.
        value.goto('/booking/thankyou')
        assert value.names().count('booking_complete') == 1
        value.page.reload(wait_until='networkidle')
        assert value.names().count('booking_complete') == 1
        language(value, 'Español')
        expect_views(value, ['/booking', '/booking/thankyou', '/booking/thankyou', '/es/booking/thankyou'])
        value.page.go_back()
        expect_views(value, ['/booking', '/booking/thankyou', '/booking/thankyou', '/es/booking/thankyou', '/booking/thankyou'])
        assert value.names().count('booking_complete') == 1
        matches = sum(path.lower().startswith('/booking/thankyou') for path in pageviews(value))
        assert matches == 3
        return {'case': 'manual-return-proxy-refresh-locale-back', 'proxy_events': 1,
            'application_page_paths': pageviews(value), 'offline_account_rule_matches': matches,
            'actual_google_rule_executed': False, 'real_bookings': 0}
    finally:
        value.close()


def direct_and_withdrawal_check(browser, origin):
    value = session(browser, origin)
    try:
        value.goto('/booking/thankyou')
        value.accept()
        value.page.reload(wait_until='networkidle')
        expect_views(value, ['/booking/thankyou', '/booking/thankyou'])
        assert 'booking_complete' not in value.names()
        value.page.get_by_role('button', name='Tracking preferences', exact=True).click()
        value.page.get_by_role('button', name='Decline', exact=True).click()
        before = list(value.names())
        language(value, 'Español')
        value.goto('/booking')
        assert value.names() == before
        return {'case': 'direct-thankyou-refresh-withdrawal', 'proxy_events': 0,
            'offline_account_rule_matches': 2, 'actual_google_rule_executed': False,
            'post_withdrawal_events': 0}
    finally:
        value.close()


def gpc_waitlist_check(browser, origin):
    value = session(browser, origin, gpc=True)
    try:
        value.goto('/booking')
        assert value.page.get_by_role('button', name='Allow tracking', exact=True).count() == 0
        value.page.get_by_role('button', name='Join the Waitlist', exact=True).first.click()
        dialog = value.page.locator('dialog.waitlist-dialog')
        dialog.get_by_label('Email address', exact=True).fill('synthetic@example.test')
        dialog.get_by_role('button', name='Join the Waitlist', exact=True).click()
        dialog.get_by_role('heading', name='You’re on the list!', exact=True).last.wait_for()
        assert len(value.requests) == 1 and value.commands == []
        return {'case': 'gpc-synthetic-new-waitlist', 'saved_ui': True, 'optional_events': 0}
    finally:
        value.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT / 'artifacts/measurement-phase0c')
    args = parser.parse_args()
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    _, sync_playwright = load_playwright()
    env = {key: os.environ[key] for key in ['PATH', 'HOME', 'TMPDIR', 'LANG'] if key in os.environ}
    env.update({'VITE_GA4_MEASUREMENT_ID': 'G-PHASE0B', 'VITE_META_PIXEL_ID': '',
        'VITE_PRIVACY_POLICY_URL': 'https://privacy.test/policy', 'VITE_ENABLE_MARKETING_IN_DEVELOPMENT': 'true',
        'VITE_TURNSTILE_SITE_KEY': 'synthetic-site-key', 'VITE_ENABLE_WAITLIST_ATTRIBUTION_PREVIEW': 'false'})
    with tempfile.TemporaryDirectory(prefix='mirembe-phase0c-') as temporary:
        work = Path(temporary) / 'site'
        shutil.copytree(ROOT, work, ignore=shutil.ignore_patterns('.git', 'node_modules', 'dist', '.env*', '.vercel',
            '.agents', '.codex', '.aws', 'artifacts', 'docs', '*.tsbuildinfo', '__pycache__'))
        (work / 'node_modules').symlink_to(ROOT / 'node_modules', target_is_directory=True)
        with sync_playwright() as playwright:
            real_browser = playwright.chromium.launch(headless=True)
            browser = IsolatedBrowser(real_browser)
            try:
                with HARNESS['server'](work, env, output, preview=False) as origin:
                    results = [navigation_check(browser, origin), booking_check(browser, origin),
                        direct_and_withdrawal_check(browser, origin)]
                    results += [HARNESS['waitlist_check'](browser, origin, response=kind) for kind in ['new', 'duplicate', 'error']]
                    results.append(HARNESS['waitlist_check'](browser, origin, consent=False))
                    results.append(gpc_waitlist_check(browser, origin))
                    results.append(HARNESS['pending_withdrawal_check'](browser, origin))
            finally:
                real_browser.close()
    evidence = {'passed': len(results), 'production_services_contacted': False,
        'scope': 'Application queue and synthetic fixtures only; no Google SDK/rule execution or collection evidence.',
        'results': results}
    (output / 'browser-results.json').write_text(json.dumps(evidence, indent=2) + '\n')
    print(json.dumps({'passed': len(results), 'artifacts': str(output), 'production_services_contacted': False}))


if __name__ == '__main__':
    main()
