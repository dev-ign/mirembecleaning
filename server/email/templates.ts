import { createElement as h, type ReactNode } from 'react'
import { render } from '@react-email/render'
import { business } from '../../src/config/business.js'

const ink = '#333333'
const purple = '#68448f'
const muted = '#68636d'
const paragraph = { fontSize: 15, lineHeight: '24px', margin: '0 0 18px' }
const heading = { color: ink, fontFamily: 'Georgia, serif', fontWeight: 'normal' as const, fontSize: 27, lineHeight: '34px', margin: '0 0 26px' }

function EmailLayout(title: string, ...children: ReactNode[]) {
  return h('html', { lang: 'en' },
    h('head', null,
      h('meta', { charSet: 'UTF-8' }),
      h('meta', { name: 'viewport', content: 'width=device-width, initial-scale=1' }),
      h('title', null, title)),
    h('body', { style: { margin: 0, padding: '24px 12px', backgroundColor: '#faf9f7', color: ink, fontFamily: 'Arial, Helvetica, sans-serif' } },
      h('table', { role: 'presentation', cellPadding: '0', cellSpacing: '0', width: '100%', style: { maxWidth: 520, margin: '0 auto', backgroundColor: '#ffffff' } },
        h('tbody', null, h('tr', null, h('td', { style: { padding: '34px 30px 38px' } },
          h('div', { style: { borderBottom: '1px solid #e9e4ec', paddingBottom: 22, marginBottom: 30 } },
            h('p', { style: { margin: 0, color: purple, fontFamily: 'Georgia, serif', fontSize: 31, lineHeight: '36px' } }, 'Mirembe'),
            h('p', { style: { margin: '2px 0 0', color: muted, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase' } }, 'Cleaning Company')),
          ...children,
          h('div', { style: { borderTop: '1px solid #e9e4ec', paddingTop: 22, marginTop: 32 } },
            h('p', { style: { color: muted, fontSize: 13, lineHeight: '20px', margin: 0 } },
              'Questions? Email us at ',
              h('a', { href: `mailto:${business.publicEmail}`, style: { color: purple } }, business.publicEmail)))))))))
}

function P(...children: ReactNode[]) {
  return h('p', { style: paragraph }, ...children)
}

function Benefit(label: string, description: string) {
  return h('tr', null, h('td', { style: { borderTop: '1px solid #ded8e4', padding: '18px 0' } },
    h('p', { style: { color: purple, fontSize: 12, fontWeight: 'bold', letterSpacing: 1.5, margin: '0 0 7px' } }, label),
    h('p', { style: { ...paragraph, margin: 0 } }, description)))
}

function WaitlistConfirmation() {
  return EmailLayout("You're on the list! | Mirembe Cleaning",
    h('h1', { style: heading }, "You're officially on the list!"),
    P('Hi there,'),
    P("Thank you for joining Mirembe Cleaning. We're excited to welcome you!"),
    P("As an early supporter, you've secured:"),
    h('table', { role: 'presentation', cellPadding: '0', cellSpacing: '0', width: '100%', style: { margin: '22px 0 24px' } },
      h('tbody', null,
        Benefit('PRIORITY BOOKING', 'Be among the first to book when booking opens.'),
        Benefit('$50 OFF', 'Your first recurring clean.'))),
    P("We'll send you your discount code and booking details as we get closer to launch."),
    P("We can't wait to care for your space!"),
    h('p', { style: { ...paragraph, marginTop: 26 } }, 'With care,', h('br'), 'The Mirembe Cleaning Team'))
}

function HiringConfirmation({ firstName }: { firstName?: string }) {
  return EmailLayout('Application Received | Mirembe Cleaning',
    h('h1', { style: heading }, 'Thank you for your interest in joining Mirembe Cleaning!'),
    P(firstName ? `Hi ${firstName},` : 'Hi there,'),
    P("We've successfully received your application and appreciate you taking the time to connect with us."),
    P("Our team will review your information and reach out if there's a potential fit."),
    P('We look forward to growing something special together!'),
    h('p', { style: { ...paragraph, marginTop: 26 } }, 'Warm regards,', h('br'), 'The Mirembe Cleaning Team'))
}

function Detail(label: string, value: string) {
  return h('tr', null,
    h('td', { style: { color: muted, padding: '7px 14px 7px 0', verticalAlign: 'top', fontSize: 14 } }, label),
    h('td', { style: { color: ink, padding: '7px 0', fontSize: 14, wordBreak: 'break-word' } }, value))
}

function WaitlistNotification({ email, date }: { email: string; date: string }) {
  return EmailLayout('New Waitlist Registration | Mirembe Cleaning',
    h('h1', { style: heading }, 'New waitlist registration received.'),
    h('table', { role: 'presentation', cellPadding: '0', cellSpacing: '0' },
      h('tbody', null,
        Detail('Email', email), Detail('Registration Date', date), Detail('Status', 'Successfully saved'))),
    h('p', { style: { ...paragraph, marginTop: 28 } }, 'Mirembe Cleaning — Automated Notification'))
}

function HiringNotification({ name, email, phone, location, date }: { name?: string; email: string; phone?: string; location?: string; date: string }) {
  return EmailLayout('New Cleaning Team Application | Mirembe Cleaning',
    h('h1', { style: heading }, 'A new application has been received.'),
    h('table', { role: 'presentation', cellPadding: '0', cellSpacing: '0' },
      h('tbody', null,
        name ? Detail('Applicant', name) : null,
        Detail('Email', email),
        phone ? Detail('Phone', phone) : null,
        location ? Detail('Location', location) : null,
        Detail('Application Date', date))),
    h('p', { style: { ...paragraph, marginTop: 28 } }, 'Mirembe Cleaning — Automated Notification'))
}

export async function renderTemplate(kind: 'waitlist_confirmation' | 'waitlist_notification' | 'hiring_confirmation' | 'hiring_notification', data: {
  email: string; created_at?: string; first_name?: string | null; last_name?: string | null;
  phone?: string | null; city?: string | null; state?: string | null
}): Promise<{ html: string; text: string }> {
  const date = data.created_at ? new Date(data.created_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/New_York' }) : 'Unknown'
  const element = kind === 'waitlist_confirmation' ? h(WaitlistConfirmation)
    : kind === 'waitlist_notification' ? h(WaitlistNotification, { email: data.email, date })
      : kind === 'hiring_confirmation' ? h(HiringConfirmation, { firstName: data.first_name ?? undefined })
        : h(HiringNotification, {
          name: [data.first_name, data.last_name].filter(Boolean).join(' ') || undefined,
          email: data.email, phone: data.phone ?? undefined,
          location: [data.city, data.state].filter(Boolean).join(', ') || undefined, date,
        })
  return { html: await render(element), text: await render(element, { plainText: true }) }
}
