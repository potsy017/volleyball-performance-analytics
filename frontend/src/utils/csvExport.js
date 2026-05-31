/**
 * Download an array of objects as a CSV file.
 * columns: string[] to pick/order keys, or { key, label }[] to rename headers.
 */
export function downloadCsv(rows, filename = 'export.csv', columns = null) {
  if (!rows?.length) return

  let cols
  if (!columns) {
    cols = Object.keys(rows[0]).map(k => ({ key: k, label: k }))
  } else if (typeof columns[0] === 'string') {
    cols = columns.map(k => ({ key: k, label: k }))
  } else {
    cols = columns
  }

  const escape = (val) => {
    if (val == null) return ''
    const s = String(val)
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"` : s
  }

  const lines = [
    cols.map(c => escape(c.label)).join(','),
    ...rows.map(r => cols.map(c => escape(r[c.key])).join(',')),
  ]

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
