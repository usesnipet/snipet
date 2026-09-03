// `hygen module dto <Name> --module <m> [--fields ...]`
// Appends a named DTO to internal/module/<m>/dto.go and a matching Zod schema
// to web/src/features/<m>/schemas.ts. Both target files must already exist
// (run `hygen module new <m>` first).
const { askName, resolveSpecs } = require('../../_lib/prompts')
const { pascal, camel, kebab } = require('../../_lib/casing')
const { goField, zodField } = require('../../_lib/fields')

module.exports = {
  prompt: async ({ prompter, args }) => {
    let mod = args.module
    if (!mod) {
      mod = (
        await prompter.prompt({
          type: 'input',
          name: 'mod',
          message: 'Existing module / feature (e.g. snipet):',
        })
      ).mod
    }
    if (!mod || !String(mod).trim()) throw new Error('--module is required')
    mod = String(mod).trim()

    const rawName = await askName(prompter, args, 'DTO name (e.g. Approve, BulkImport):')
    const specs = await resolveSpecs(prompter, args)
    const gof = specs.map(goField)

    const P = pascal(rawName)
    const M = pascal(mod)
    const stem = P.endsWith(M) ? P : P + M // Approve + Order -> ApproveOrder
    const dtoStruct = stem.endsWith('DTO') ? stem : stem + 'DTO'

    const dtoPath = 'internal/module/' + kebab(mod) + '/dto.go'

    return {
      mod,
      dtoStruct, // ApproveOrderDTO
      schemaName: camel(stem) + 'Schema', // approveOrderSchema
      typeName: stem, // ApproveOrder
      goFields: gof,
      zodFields: specs.map(zodField),
      // '' -> Hygen skips the template; set only when the import is actually needed
      timeImportTo: gof.some((f) => f.isTime) ? dtoPath : '',
      jsonxImportTo: gof.some((f) => f.jsonMap) ? dtoPath : '',
    }
  },
}
