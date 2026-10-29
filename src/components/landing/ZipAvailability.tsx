import { t, useLocale } from '../../i18n'
type ZipAvailabilityProps = {
  openWaitlist: () => void
  joined: boolean
}

export function ZipAvailability({ openWaitlist, joined }: ZipAvailabilityProps) {
  useLocale()
  return <div className="landing-availability-card" id="availability">
    <div>
      <h3>{t('zipAvailability.title')}</h3>
      <p>{t('zipAvailability.description')}</p>
    </div>
    <div className="landing-zip-controls">
      <label htmlFor="availability-zip">{t('zipAvailability.label')}</label>
      <div>
        <input id="availability-zip" type="text" inputMode="numeric" autoComplete="postal-code" maxLength={5} placeholder={t('zipAvailability.placeholder')} aria-describedby="availability-note" />
        <button className="landing-button" type="button" disabled>{t('zipAvailability.check')}</button>
      </div>
      <p id="availability-note">{t('zipAvailability.comingSoon')}{' '}
        <button type="button" onClick={openWaitlist} disabled={joined}>{joined ? t('waitlist.joined') : t('zipAvailability.join')}</button>
      </p>
    </div>
  </div>
}
