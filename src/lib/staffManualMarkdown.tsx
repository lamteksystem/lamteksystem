import type { ReactNode } from 'react'

function inlineMarkdown(text: string): ReactNode[] {
  const parts: ReactNode[] = []
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g
  let last = 0
  let m: RegExpExecArray | null
  let key = 0
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index))
    const token = m[0]
    if (token.startsWith('**')) {
      parts.push(<strong key={key++}>{token.slice(2, -2)}</strong>)
    } else if (token.startsWith('`')) {
      parts.push(<code key={key++}>{token.slice(1, -1)}</code>)
    } else {
      const linkMatch = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token)
      if (linkMatch) {
        const [, label, href] = linkMatch
        if (href.startsWith('#')) {
          parts.push(
            <a key={key++} href={href}>
              {label}
            </a>
          )
        } else {
          parts.push(
            <a key={key++} href={href} target="_blank" rel="noreferrer">
              {label}
            </a>
          )
        }
      }
    }
    last = m.index + token.length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}

/** Lightweight markdown for the staff manual (headings, lists, tables, code). */
export function renderStaffManualMarkdown(source: string): ReactNode[] {
  const lines = source.replace(/\r\n/g, '\n').split('\n')
  const out: ReactNode[] = []
  let i = 0
  let blockKey = 0

  while (i < lines.length) {
    const line = lines[i]

    if (line.startsWith('```')) {
      const codeLines: string[] = []
      i += 1
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i])
        i += 1
      }
      i += 1
      out.push(
        <pre key={blockKey++} className="staff-manual-pre">
          <code>{codeLines.join('\n')}</code>
        </pre>
      )
      continue
    }

    if (/^\|.+\|$/.test(line) && i + 1 < lines.length && /^\|[-| :]+\|$/.test(lines[i + 1])) {
      const headerCells = line
        .slice(1, -1)
        .split('|')
        .map((c) => c.trim())
      i += 2
      const bodyRows: string[][] = []
      while (i < lines.length && /^\|.+\|$/.test(lines[i])) {
        bodyRows.push(
          lines[i]
            .slice(1, -1)
            .split('|')
            .map((c) => c.trim())
        )
        i += 1
      }
      out.push(
        <div key={blockKey++} className="staff-manual-table-wrap">
          <table className="staff-manual-table">
            <thead>
              <tr>
                {headerCells.map((h, hi) => (
                  <th key={hi}>{inlineMarkdown(h)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bodyRows.map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => (
                    <td key={ci}>{inlineMarkdown(cell)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
      continue
    }

    if (/^#{1,3} /.test(line)) {
      const level = line.match(/^#+/)?.[0].length ?? 1
      const text = line.replace(/^#+\s*/, '')
      const id = text
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
      const Tag = level === 1 ? 'h1' : level === 2 ? 'h2' : 'h3'
      out.push(
        <Tag key={blockKey++} id={id} className={`staff-manual-h${level}`}>
          {inlineMarkdown(text)}
        </Tag>
      )
      i += 1
      continue
    }

    if (line === '---') {
      out.push(<hr key={blockKey++} className="staff-manual-hr" />)
      i += 1
      continue
    }

    if (/^[-*] /.test(line) || /^\d+\. /.test(line)) {
      const ordered = /^\d+\. /.test(line)
      const items: string[] = []
      while (i < lines.length && (/^[-*] /.test(lines[i]) || /^\d+\. /.test(lines[i]))) {
        items.push(lines[i].replace(/^[-*] |^\d+\. /, ''))
        i += 1
      }
      const ListTag = ordered ? 'ol' : 'ul'
      out.push(
        <ListTag key={blockKey++} className="staff-manual-list">
          {items.map((item, li) => (
            <li key={li}>{inlineMarkdown(item)}</li>
          ))}
        </ListTag>
      )
      continue
    }

    if (line.trim() === '') {
      i += 1
      continue
    }

    const paraLines: string[] = []
    while (i < lines.length && lines[i].trim() !== '' && !/^#{1,3} /.test(lines[i]) && !/^[-*] /.test(lines[i]) && !/^\d+\. /.test(lines[i]) && lines[i] !== '---' && !lines[i].startsWith('```') && !/^\|.+\|$/.test(lines[i])) {
      paraLines.push(lines[i])
      i += 1
    }
    out.push(
      <p key={blockKey++} className="staff-manual-p">
        {inlineMarkdown(paraLines.join(' '))}
      </p>
    )
  }

  return out
}
