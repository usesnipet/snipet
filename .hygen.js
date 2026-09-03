// Hygen config — auto-loaded from the repo root.
// Registers the shared helpers (casing, pluralization, type maps) so every
// template can call them as `h.<name>` instead of require()-ing into _lib.
//
// Generators live in _templates/ (see _templates/README.md,
// _templates/module/README.md, _templates/web/README.md). Always run hygen
// from the repo root — helpers read ./go.mod for the module path.

const path = require('path')

const casing = require('./_templates/_lib/casing')
const { GO, ZOD, FIELD_TYPES } = require('./_templates/_lib/fields')

module.exports = {
  templates: path.join(__dirname, '_templates'),
  helpers: {
    ...casing, // pascal, camel, kebab, snake, constant, plural, pluralPascal, tableName, goModule, ...

    fieldTypes: FIELD_TYPES,
    goType: (t) => (GO[t] || GO.string).go,
    pgType: (t) => (GO[t] || GO.string).col,
    zodExpr: (t) => ZOD[t] || ZOD.string,
  },
}
