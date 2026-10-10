import { CleaningTeamLink } from './CleaningTeamLink'
import { WaitlistExperience } from './WaitlistExperience'

export function HeroContent() {
  return (
    <section className="hero-content" aria-label="Join the Mirembe waitlist">
      <div className="hero-intro">
        <h1 className="headline">
          <span className="headline-main entrance" style={{ animationDelay: '80ms' }}>A Cleaner Home.</span>
          <span className="headline-accent entrance" style={{ animationDelay: '160ms' }}>More Peace.</span>
        </h1>
        <p className="hero-description entrance" style={{ animationDelay: '240ms' }}>
          Thoughtful home and rental cleaning coming to Connecticut and Massachusetts in January 2027.
        </p>
      </div>

      <div className="conversion-content">
        <WaitlistExperience />
      </div>
      <CleaningTeamLink />
    </section>
  )
}
