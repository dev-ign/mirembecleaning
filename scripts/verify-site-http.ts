import assert from 'node:assert/strict'
import { sitePages, routeRedirects } from '../src/i18n/routes.js'
import { locales } from '../src/i18n/config.js'

const origin = process.argv[2] ?? 'http://127.0.0.1:5190'
const results = []
for (const page of sitePages) {
  const response = await fetch(origin + page.path, { redirect: 'manual' })
  assert.equal(response.status, 200, page.path)
  assert.match(response.headers.get('content-type') ?? '', /text\/html/, page.path)
  const html = await response.text()
  assert.ok(html.includes(`<html lang="${locales[page.locale].htmlLang}"`), page.path)
  results.push({ path: page.path, status: response.status, contentType: response.headers.get('content-type') })
}
for (const route of routeRedirects) {
  const response = await fetch(origin + route.source + '?utm_source=holiday', { redirect: 'manual' })
  assert.equal(response.status, 308, route.source)
  assert.equal(response.headers.get('location'), route.destination + '?utm_source=holiday', route.source)
}
const legacyAliases = ['/booking/thank-you', '/booking/thank-you/', '/booking/thank-you/legacy-suffix']
for (const path of legacyAliases) {
  const response = await fetch(origin + path + '?utm_source=holiday', { redirect: 'manual' })
  assert.equal(response.status, 308, path)
  assert.equal(response.headers.get('location'), '/booking/thankyou?utm_source=holiday', path)
}
for (const path of ['/fr/', '/es/missing', '/es/es/', '/pt/api/waitlist', '/missing.css', '/api/waitlist']) {
  const response = await fetch(origin + path, { redirect: 'manual' })
  assert.equal(response.status, 404, path)
  results.push({ path, status: response.status, contentType: response.headers.get('content-type') })
}
console.log(JSON.stringify({ pages: results, redirects: routeRedirects.length + legacyAliases.length }, null, 2))
