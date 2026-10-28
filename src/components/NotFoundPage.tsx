import { useLocalizedHref } from '../i18n/useLocalizedHref'
import { t, useLocale } from '../i18n'
import { SiteDocumentLayout } from './SiteDocumentLayout'
export function NotFoundPage() {
  const localHref = useLocalizedHref()
  useLocale()
  return <SiteDocumentLayout><div className="landing-container booking-thank-you">
    <h1>{t('notFound.title')}</h1><p>{t('notFound.description')}</p>
    <a className="landing-button" href={localHref("/")}>{t('booking.home')}</a>
  </div></SiteDocumentLayout>
}
