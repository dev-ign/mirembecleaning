import source from './privacy.txt?raw'

export type PrivacyBlock =
  | { type: 'paragraph' | 'subheading'; text: string }
  | { type: 'list'; items: string[] }

// privacy.txt is the exact approved attachment. Only blank lines and the bullet
// marker/indentation are normalized; wording, punctuation and order stay intact.
const lines = source.trim().split(/\r?\n/).map(line => line.trim()).filter(Boolean)
const headings = lines.flatMap((line, index) => /^\d+\. /.test(line) ? [index] : [])
const subheadings = new Set([
  'Information you give us',
  'Information created when we provide services',
  'Information collected automatically on our website',
  'Information from other sources',
])

export const privacyDocument = {
  title: lines[0],
  effectiveDate: lines[1],
  sections: headings.map((start, index) => {
    const blocks: PrivacyBlock[] = []
    for (const line of lines.slice(start + 1, headings[index + 1] ?? lines.length)) {
      if (line.startsWith('•')) {
        const text = line.replace(/^•\s*/, '')
        const previous = blocks.at(-1)
        if (previous?.type === 'list') previous.items.push(text)
        else blocks.push({ type: 'list', items: [text] })
      } else {
        blocks.push({ type: subheadings.has(line) ? 'subheading' : 'paragraph', text: line })
      }
    }
    return { number: index + 1, heading: lines[start], blocks }
  }),
}
