import { useState } from 'react'

/**
 * Small, safe Markdown renderer for assistant replies, reports and plan text.
 * Produces React elements only (no innerHTML). Supports headings, paragraphs,
 * bold/italic/code, links (http/https/mailto), lists (one nesting level),
 * blockquotes, rules, fenced code and pipe tables (long tables collapse).
 */
export default function Markdown({ text = '', className = '' }) {
  return <div className={`md ${className}`}>{parseBlocks(String(text || ''))}</div>
}

function parseBlocks(src) {
  const lines = src.replace(/\r\n?/g, '\n').split('\n')
  const out = []
  let i = 0
  let key = 0

  while (i < lines.length) {
    const line = lines[i]

    if (!line.trim()) {
      i++
      continue
    }

    // Fenced code
    const fence = line.match(/^\s*```(\w*)/)
    if (fence) {
      const buf = []
      i++
      while (i < lines.length && !/^\s*```/.test(lines[i])) buf.push(lines[i++])
      i++
      out.push(
        <pre key={key++}>
          <code>{buf.join('\n')}</code>
        </pre>
      )
      continue
    }

    // Heading
    const h = line.match(/^\s*(#{1,6})\s+(.*)$/)
    if (h) {
      const level = Math.min(h[1].length + 1, 4) // h1 in content renders as h2
      const Tag = `h${level}`
      out.push(<Tag key={key++}>{inline(h[2])}</Tag>)
      i++
      continue
    }

    // Rule
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      out.push(<hr key={key++} />)
      i++
      continue
    }

    // Table
    if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {
      const rows = []
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) rows.push(lines[i++])
      const cells = (r) => r.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim())
      const head = cells(rows[0])
      const body = rows.slice(2).map(cells)
      out.push(<MdTable key={key++} head={head} body={body} />)
      continue
    }

    // Blockquote
    if (/^\s*>/.test(line)) {
      const buf = []
      while (i < lines.length && /^\s*>/.test(lines[i])) buf.push(lines[i++].replace(/^\s*>\s?/, ''))
      out.push(<blockquote key={key++}>{parseBlocks(buf.join('\n'))}</blockquote>)
      continue
    }

    // Lists
    if (/^\s*([-*+]|\d+[.)])\s+/.test(line)) {
      const { node, next } = parseList(lines, i, key++)
      out.push(node)
      i = next
      continue
    }

    // Paragraph
    const buf = []
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^\s*(#{1,6}\s|```|>|([-*+]|\d+[.)])\s+|\|.*\|\s*$)/.test(lines[i]) &&
      !/^\s*([-*_])(\s*\1){2,}\s*$/.test(lines[i])
    )
      buf.push(lines[i++])
    if (buf.length) {
      out.push(
        <p key={key++}>
          {buf.map((b, bi) => (
            <span key={bi}>
              {inline(b)}
              {bi < buf.length - 1 && <br />}
            </span>
          ))}
        </p>
      )
    } else {
      i++
    }
  }
  return out
}

function parseList(lines, start, key) {
  const indentOf = (l) => l.match(/^\s*/)[0].length
  const baseIndent = indentOf(lines[start])
  const ordered = /^\s*\d+[.)]\s+/.test(lines[start])
  const items = []
  let i = start
  while (i < lines.length) {
    const l = lines[i]
    if (!l.trim()) {
      // blank line ends the list unless the next line continues it
      if (i + 1 < lines.length && /^\s*([-*+]|\d+[.)])\s+/.test(lines[i + 1]) && indentOf(lines[i + 1]) >= baseIndent) {
        i++
        continue
      }
      break
    }
    const m = l.match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/)
    if (m && m[1].length === baseIndent) {
      items.push({ text: m[3], children: [] })
      i++
    } else if (m && m[1].length > baseIndent && items.length) {
      const sub = parseList(lines, i, `${key}-${i}`)
      items[items.length - 1].children.push(sub.node)
      i = sub.next
    } else if (!m && indentOf(l) > baseIndent && items.length) {
      items[items.length - 1].text += ` ${l.trim()}`
      i++
    } else break
  }
  const Tag = ordered ? 'ol' : 'ul'
  return {
    node: (
      <Tag key={key}>
        {items.map((it, idx) => (
          <li key={idx}>
            {inline(it.text)}
            {it.children}
          </li>
        ))}
      </Tag>
    ),
    next: i,
  }
}

function MdTable({ head, body }) {
  const [expanded, setExpanded] = useState(false)
  const LIMIT = 6
  const rows = expanded ? body : body.slice(0, LIMIT)
  return (
    <div>
      <div className="overflow-x-auto rounded-panel border border-line relative">
        <table>
          <thead>
            <tr>
              {head.map((c, i) => (
                <th key={i}>{inline(c)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, ri) => (
              <tr key={ri}>
                {head.map((_, ci) => (
                  <td key={ci}>{inline(r[ci] || '')}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {body.length > LIMIT && (
        <button type="button" onClick={() => setExpanded((e) => !e)} className="mt-1.5 text-xs font-semibold text-accent-ink hover:underline">
          {expanded ? 'Show fewer rows' : `Show all ${body.length} rows`}
        </button>
      )}
    </div>
  )
}

const INLINE = /(`[^`]+`)|(\*\*[^*]+\*\*|__[^_]+__)|(\*[^*\s][^*]*\*|_[^_\s][^_]*_)|(\[[^\]]+\]\([^)\s]+\))/g

function inline(text) {
  const parts = []
  let last = 0
  let m
  let k = 0
  const re = new RegExp(INLINE.source, 'g') // fresh per call: inline() recurses
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index))
    const tok = m[0]
    if (m[1]) parts.push(<code key={k++}>{tok.slice(1, -1)}</code>)
    else if (m[2]) parts.push(<strong key={k++}>{inline(tok.slice(2, -2))}</strong>)
    else if (m[3]) parts.push(<em key={k++}>{inline(tok.slice(1, -1))}</em>)
    else if (m[4]) {
      const lm = tok.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/)
      const href = lm?.[2] || ''
      if (/^(https?:|mailto:)/i.test(href)) {
        parts.push(
          <a key={k++} href={href} target="_blank" rel="noopener noreferrer">
            {lm[1]}
          </a>
        )
      } else parts.push(lm?.[1] || tok)
    }
    last = m.index + tok.length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}
