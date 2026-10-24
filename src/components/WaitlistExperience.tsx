import { useEffect, useState } from 'react'
import type { WaitlistRecord } from '../types/waitlist'
import { WaitlistForm } from './WaitlistForm'
import { WaitlistSuccess } from './WaitlistSuccess'

type Phase = 'form' | 'exiting' | 'success'

interface WaitlistExperienceProps {
  onCreated?: (record: WaitlistRecord) => void
  onFeedback?: (message: string, kind: 'error' | 'verification') => void
  onSubmittingChange?: (submitting: boolean) => void
}

export function WaitlistExperience({ onCreated, onFeedback, onSubmittingChange }: WaitlistExperienceProps = {}) {
  const [record, setRecord] = useState<WaitlistRecord | null>(null)
  const [phase, setPhase] = useState<Phase>('form')

  useEffect(() => {
    if (phase !== 'exiting') return
    // Complete the handoff even when animationend is unavailable or interrupted.
    const fallback = window.setTimeout(() => setPhase('success'), 280)
    return () => window.clearTimeout(fallback)
  }, [phase])

  function handleCreated(createdRecord: WaitlistRecord) {
    setRecord(createdRecord)
    onSubmittingChange?.(false)
    onCreated?.(createdRecord)
    setPhase(window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'success' : 'exiting')
  }

  if (phase === 'success' && record) {
    return <WaitlistSuccess record={record} onRecordUpdated={setRecord} />
  }

  return (
    <WaitlistForm
      onCreated={handleCreated}
      onFeedback={onFeedback}
      onSubmittingChange={onSubmittingChange}
      exiting={phase === 'exiting'}
      onExitComplete={() => setPhase('success')}
    />
  )
}
