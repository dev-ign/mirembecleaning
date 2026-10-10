import heroImage from './assets/images/mirembe-hero.png'
import { BrandLogo } from './components/BrandLogo'
import { FounderNote } from './components/FounderNote'
import { HeroContent } from './components/HeroContent'

export default function App() {
  return (
    <div className="page-shell">
      <img className="room-photo" src={heroImage} alt="" aria-hidden="true" fetchPriority="high" />
      <div className="photo-gradient" aria-hidden="true" />
      <header className="site-header">
        <BrandLogo />
      </header>
      <main className="content-grid">
        <HeroContent />
        <FounderNote />
      </main>
    </div>
  )
}
