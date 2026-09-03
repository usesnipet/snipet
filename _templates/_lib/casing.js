// Shared naming helpers for every generator in this repo.
// Exposed to templates as `h.*` via /.hygen.js; required directly by prompt.js files.
// No external deps — `change-case` only exists inside hygen's own install.

const fs = require('fs')

const wordsOf = (s) =>
  String(s)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w.toLowerCase())

const cap = (w) => w.charAt(0).toUpperCase() + w.slice(1)

const pascal = (s) => wordsOf(s).map(cap).join('')
const camel = (s) => {
  const p = pascal(s)
  return p.charAt(0).toLowerCase() + p.slice(1)
}
const kebab = (s) => wordsOf(s).join('-')
const snake = (s) => wordsOf(s).join('_')
const constant = (s) => wordsOf(s).join('_').toUpperCase()
const pkgName = (s) => wordsOf(s).join('')

// single-word pluralization (enough for entity names)
const plural = (w) => {
  if (/[^aeiou]y$/.test(w)) return w.replace(/y$/, 'ies')
  if (/(s|x|z|ch|sh)$/.test(w)) return w + 'es'
  return w + 's'
}
const withPluralLast = (s) => {
  const ws = wordsOf(s)
  ws[ws.length - 1] = plural(ws[ws.length - 1])
  return ws
}
const pluralPascal = (s) => withPluralLast(s).map(cap).join('')
const pluralKebab = (s) => withPluralLast(s).join('-')
const tableName = (s) => withPluralLast(s).join('_')

// Go module path from ./go.mod — memoized; generators must run from the repo root.
let _goModule
const goModule = () => {
  if (_goModule) return _goModule
  const m = (fs.readFileSync('go.mod', 'utf8').match(/^module\s+(\S+)/m) || [])[1]
  if (!m) throw new Error('could not read module path from ./go.mod — run hygen from the repo root')
  _goModule = m
  return m
}

module.exports = {
  wordsOf,
  cap,
  pascal,
  camel,
  kebab,
  snake,
  constant,
  pkgName,
  plural,
  pluralPascal,
  pluralKebab,
  tableName,
  goModule,
}
