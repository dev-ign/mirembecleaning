import successIcon from '../assets/icons/waitlist-success.svg'

// The Figma SVG combines the green circle and white check in one filled path.
// This overlay covers only its check cutout, then reveals that exact shape along
// a short stroke. The original asset remains the final visible icon.
const checkShape = 'M35.1372 18.2136L24.6483 32.7565C24.5017 32.9612 24.3085 33.1279 24.0846 33.2429C23.8607 33.3579 23.6126 33.4179 23.3609 33.4179C23.1092 33.4179 22.8611 33.3579 22.6372 33.2429C22.4133 33.1279 22.22 32.9612 22.0734 32.7565L15.8628 24.1503C15.6735 23.8863 15.8628 23.5178 16.1865 23.5178H18.5224C19.0304 23.5178 19.5135 23.7618 19.8123 24.1802L23.3584 29.1009L31.1877 18.2435C31.4865 17.8301 31.9646 17.5811 32.4776 17.5811H34.8135C35.1372 17.5811 35.3265 17.9496 35.1372 18.2136Z'

export function AnimatedSuccessIcon() {
  return (
    <span className="success-icon" aria-hidden="true">
      <img src={successIcon} width="51" height="51" alt="" />
      <svg className="success-check-overlay" viewBox="0 0 51 51" focusable="false">
        <defs>
          <mask id="success-check-reveal" maskUnits="userSpaceOnUse" x="0" y="0" width="51" height="51">
            <path className="success-check-trace" d="M17.8 25.2 23.35 31.3 33.1 19.2" pathLength="100" fill="none" stroke="white" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
          </mask>
        </defs>
        <path d={checkShape} fill="#05A022" />
        <path d={checkShape} fill="white" mask="url(#success-check-reveal)" />
      </svg>
    </span>
  )
}
