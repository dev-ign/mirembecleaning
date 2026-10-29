import { t, useLocale } from '../../i18n'
import { SiteDocumentLayout } from '../SiteDocumentLayout'
import { privacyConfig } from '../../config/legal'
import { privacyDocument } from '../../content/privacy'

function PrivacyText({ text }: { text: string }) {
  return <>{text.split(/(hello@mirembecleaning\.com|617-917-4137)/).map((part, index) => {
    if (part === 'hello@mirembecleaning.com') return <a key={index} href={`mailto:${part}`}>{part}</a>
    if (part === '617-917-4137') return <a key={index} href="tel:+16179174137">{part}</a>
    return part
  })}</>
}

export function PrivacyPage() {
  const locale = useLocale()
  return <SiteDocumentLayout pageClass="legal-page privacy-page" mainId="privacy-main">
    {locale !== 'en' && <p className="landing-container legal-language-notice">{t('legal.englishNotice')}</p>}
    <article lang="en" className="landing-container legal-content" aria-labelledby="privacy-heading">
      <header className="legal-header">
        <h1 id="privacy-heading">{privacyDocument.title}</h1>
        <p><time dateTime={privacyConfig.effectiveAt}>{privacyDocument.effectiveDate}</time></p>
      </header>
      {privacyDocument.sections.map(section => <section key={section.number} id={`privacy-section-${section.number}`} aria-labelledby={`privacy-section-heading-${section.number}`}>
        <h2 id={`privacy-section-heading-${section.number}`}>{section.heading}</h2>
        {section.blocks.map((block, index) => {
          if (block.type === 'list') return <ul key={index}>{block.items.map(text => <li key={text}><PrivacyText text={text} /></li>)}</ul>
          if (block.type === 'subheading') return <h3 key={index}>{block.text}</h3>
          return <p key={index}><PrivacyText text={block.text} /></p>
        })}
      </section>)}
    </article>
  </SiteDocumentLayout>
}
