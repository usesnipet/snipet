// Field-spec parsing shared by the backend (Go) and frontend (Zod) generators.
//
// A field spec string is `name:type[:flag[:flag...]]`, comma-separated:
//   "title:string:required,qty:int:index,spec:jsonb:required"
//
// type  = string|text|int|int64|float|bool|time|uuid|jsonb
// flags = required unique index nullable   (unique/index/nullable are Go-only)

const { pascal, snake } = require('./casing')

// type -> Go field type + Postgres column type
const GO = {
  string: { go: 'string', col: 'varchar(255)', str: true },
  text: { go: 'string', col: 'text', str: true },
  int: { go: 'int', col: 'integer' },
  int64: { go: 'int64', col: 'bigint' },
  float: { go: 'float64', col: 'numeric' },
  bool: { go: 'bool', col: 'boolean' },
  time: { go: 'time.Time', col: 'timestamptz' },
  uuid: { go: 'string', col: 'uuid' },
  jsonb: { go: 'jsonx.JSONMap', col: 'jsonb', jsonMap: true },
}

// type -> Zod expression (zod v4). Keys stay snake_case to match the Go json tags.
const ZOD = {
  string: 'z.string()',
  text: 'z.string()',
  int: 'z.number().int()',
  int64: 'z.number().int()',
  float: 'z.number()',
  bool: 'z.boolean()',
  time: 'z.coerce.date()',
  uuid: 'z.uuid()',
  jsonb: 'z.record(z.string(), z.unknown())',
}

const FIELD_TYPES = Object.keys(GO)

// Normalise one spec entry / one set of prompt answers.
const asFlags = (flags) => ({
  required: flags.includes('required'),
  unique: flags.includes('unique'),
  index: flags.includes('index'),
  nullable: flags.includes('nullable'),
})

// { name, type, flags:[] } -> the object a Go template renders.
function goField(raw) {
  const t = GO[raw.type] || GO.string
  const opt = Array.isArray(raw.flags) ? asFlags(raw.flags) : raw
  const gorm = ['type:' + t.col]
  if (!opt.nullable) gorm.push('not null')
  if (opt.unique) gorm.push('uniqueIndex')
  else if (opt.index) gorm.push('index')
  const maxRule = t.str ? ',max=255' : ''
  return {
    goName: pascal(raw.name),
    json: snake(raw.name),
    goType: t.go,
    isTime: t.go === 'time.Time',
    jsonMap: !!t.jsonMap,
    updateType: t.jsonMap ? t.go : '*' + t.go,
    gormTag: gorm.join(';'),
    createValidate: (opt.required ? 'required' : 'omitempty') + maxRule,
    updateValidate: 'omitempty' + maxRule,
    required: !!opt.required,
  }
}

// { name, type, flags:[] } -> the object a Zod template renders.
function zodField(raw) {
  const base = ZOD[raw.type] || ZOD.string
  const opt = Array.isArray(raw.flags) ? asFlags(raw.flags) : raw
  return {
    key: snake(raw.name),
    zod: opt.required ? base : `${base}.optional()`,
    required: !!opt.required,
  }
}

// "a:string:required,b:int" -> [{ name, type, flags:[] }]
function parseSpec(spec) {
  return String(spec)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((entry) => {
      const [name, type, ...flags] = entry.split(':')
      return { name, type: type || 'string', flags }
    })
}

const goFieldsFromSpec = (spec) => parseSpec(spec).map(goField)
const zodFieldsFromSpec = (spec) => parseSpec(spec).map(zodField)

module.exports = {
  GO,
  ZOD,
  FIELD_TYPES,
  goField,
  zodField,
  parseSpec,
  goFieldsFromSpec,
  zodFieldsFromSpec,
}
