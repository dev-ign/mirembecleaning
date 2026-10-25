type ZipAvailabilityProps = {
  openWaitlist: () => void
  joined: boolean
}

export function ZipAvailability({ openWaitlist, joined }: ZipAvailabilityProps) {
  return <div className="landing-availability-card" id="availability">
    <div>
      <h3>Not sure if we serve your area?</h3>
      <p>Enter your ZIP code to check availability. If we’re not there yet, join the waitlist and we’ll let you know when we are.</p>
    </div>
    <div className="landing-zip-controls">
      <label htmlFor="availability-zip">ZIP code</label>
      <div>
        <input id="availability-zip" type="text" inputMode="numeric" autoComplete="postal-code" maxLength={5} placeholder="e.g. 02134" aria-describedby="availability-note" />
        <button className="landing-button" type="button" disabled>Check availability</button>
      </div>
      <p id="availability-note">ZIP checking is coming soon.{' '}
        <button type="button" onClick={openWaitlist} disabled={joined}>{joined ? 'You’re on the waitlist' : 'Join the waitlist for area updates'}</button>
      </p>
    </div>
  </div>
}
