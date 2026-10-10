import symbol from '../assets/icons/mirembe-symbol.svg'

export function BrandLogo() {
  return (
    <div className="brand-logo entrance" style={{ animationDelay: '0ms' }}>
      <img className="brand-symbol" src={symbol} width="112" height="112" alt="" aria-hidden="true" />
      <div className="brand-wordmark">
        <span className="brand-name">Mirembe</span>
        <span className="brand-subtitle">Cleaning Company</span>
      </div>
    </div>
  )
}
