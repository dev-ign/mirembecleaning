import { SiteDocumentLayout } from '../SiteDocumentLayout'
import { business } from '../../config/business'
import { termsConfig } from '../../config/legal'
import { marketing } from '../../config/marketing'
import { termsDocument } from '../../content/terms'
import { trackEvent } from '../../lib/optionalEvents'

function LegalText({ text }: { text: string }) {
  return <>{text.split(/(Privacy Policy|[\w.+-]+@[\w.-]+\.\w+|\d{3}-\d{3}-\d{4})/).map((part, index) => {
    if (part === 'Privacy Policy' && marketing.privacyPolicyUrl) return <a key={index} href={marketing.privacyPolicyUrl}>{part}</a>
    if (part === business.publicEmail) return <a key={index} href={'mailto:' + business.publicEmail}>{part}</a>
    if (part.replaceAll('-', '') === business.publicPhone.replace(/^\+1/, '')) return <a key={index} href={business.phoneHref} onClick={() => trackEvent('phone_click')}>{part}</a>
    return part
  })}</>
}

export function TermsPage() {
  return <SiteDocumentLayout pageClass="legal-page" mainId="legal-main">
    <article className="landing-container legal-content" aria-labelledby="terms-heading">
      <header className="legal-header">
        <h1 id="terms-heading">{termsDocument.title}</h1>
        <p><time dateTime={termsConfig.updatedAt}>{termsDocument.updated}</time></p>
      </header>
      {termsDocument.introduction.map(text => <p key={text}>{text}</p>)}
      {termsDocument.sections.map(section => <section key={section.number} id={`terms-section-${section.number}`} aria-labelledby={`terms-section-heading-${section.number}`}>
        <h2 id={`terms-section-heading-${section.number}`}>{section.heading}</h2>
        {section.blocks.map((block, index) => block.type === 'list'
          ? <ul key={index}>{block.items.map(item => <li key={item}><LegalText text={item} /></li>)}</ul>
          : <p key={index}><LegalText text={block.text} /></p>)}
      </section>)}
      <footer className="legal-closing">{termsDocument.closing.map(text => <p key={text}><LegalText text={text} /></p>)}</footer>
    </article>
  </SiteDocumentLayout>
}
