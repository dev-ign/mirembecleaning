import source from './terms.txt?raw'

// The approved source is kept verbatim in terms.txt. These ranges only give its
// existing lists semantic HTML; they never rewrite or concatenate legal copy.
const lists: Record<number, { start: number; count: number }> = {
  1: { start: 1, count: 4 },
  2: { start: 1, count: 4 },
  3: { start: 1, count: 8 },
  5: { start: 0, count: 6 },
  8: { start: 0, count: 5 },
  9: { start: 0, count: 4 },
  10: { start: 4, count: 6 },
  11: { start: 4, count: 4 },
  12: { start: 1, count: 8 },
  18: { start: 1, count: 4 },
  19: { start: 2, count: 5 },
  20: { start: 1, count: 3 },
  21: { start: 1, count: 4 },
}

export type LegalBlock = { type: 'paragraph'; text: string } | { type: 'list'; items: string[] }
const lines = source.trim().split(/\r?\n/).filter(line => line.length > 0)
const headings = lines.flatMap((line, index) => /^\d+\. /.test(line) ? [index] : [])

export const termsDocument = {
  title: lines[0],
  updated: lines[1],
  introduction: lines.slice(2, headings[0]),
  sections: headings.map((index, sectionIndex) => {
    const number = sectionIndex + 1
    const content = lines.slice(index + 1, headings[sectionIndex + 1] ?? lines.length - 2)
    const list = lists[number]
    const blocks: LegalBlock[] = []
    for (let position = 0; position < content.length; position++) {
      if (list && position === list.start) {
        blocks.push({ type: 'list', items: content.slice(position, position + list.count) })
        position += list.count - 1
      } else blocks.push({ type: 'paragraph', text: content[position] })
    }
    return { number, heading: lines[index], blocks }
  }),
  closing: lines.slice(-2),
}
