import { t, useLocale } from '../i18n'
import { CleaningTeamLink } from './CleaningTeamLink'
import { WaitlistExperience } from './WaitlistExperience'

export function HeroContent() {
  useLocale()
  return (
    <section className="hero-content" aria-label={t('waitlist.region')}>
      <div className="hero-intro">
        <h1 className="headline">
          <span className="headline-main entrance" style={{ animationDelay: '80ms' }}>{t('home.hero.cleanHome')}</span>
          <span className="headline-accent entrance" style={{ animationDelay: '160ms' }}>{t('home.hero.peace')}</span>
        </h1>
        <p className="hero-description entrance" style={{ animationDelay: '240ms' }}>
          {t('seo.description')}
        </p>
      </div>

      <div className="conversion-content">
        <WaitlistExperience />
      </div>
      <CleaningTeamLink />
    </section>
  )
}
