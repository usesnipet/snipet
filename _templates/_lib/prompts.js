// Reusable prompt fragments so each generator's prompt.js stays tiny.

const { FIELD_TYPES, goField, zodField, parseSpec } = require('./fields')

// Name from `--name`/first positional, or ask for it.
async function askName(prompter, args, message) {
  const given = args.name || args[0]
  if (given && String(given).trim()) return String(given).trim()
  const { name } = await prompter.prompt({ type: 'input', name: 'name', message })
  if (!name || !name.trim()) throw new Error('name is required')
  return name.trim()
}

// Interactive "add a field" loop — always asks the full set (backend needs the
// unique/index/nullable flags; the frontend templates just ignore them).
async function promptFieldSpecs(prompter) {
  const specs = []
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { name } = await prompter.prompt({
      type: 'input',
      name: 'name',
      message: `Field #${specs.length + 1} name (blank to finish):`,
    })
    if (!name || !name.trim()) break

    const { type } = await prompter.prompt({
      type: 'select',
      name: 'type',
      message: `  type of "${name}"`,
      choices: FIELD_TYPES,
    })
    const flags = []
    const { required } = await prompter.prompt({
      type: 'confirm',
      name: 'required',
      message: '  required?',
      initial: true,
    })
    if (required) flags.push('required')

    const { unique } = await prompter.prompt({
      type: 'confirm',
      name: 'unique',
      message: '  unique?',
      initial: false,
    })
    if (unique) flags.push('unique')
    if (!unique) {
      const { index } = await prompter.prompt({
        type: 'confirm',
        name: 'index',
        message: '  indexed?',
        initial: false,
      })
      if (index) flags.push('index')
    }
    if (!required) {
      const { nullable } = await prompter.prompt({
        type: 'confirm',
        name: 'nullable',
        message: '  nullable column?',
        initial: false,
      })
      if (nullable) flags.push('nullable')
    }

    specs.push({ name: name.trim(), type, flags })
  }
  return specs
}

// Field specs from `--fields "a:string:required,b:int"` (`""` = none) or the loop.
async function resolveSpecs(prompter, args) {
  if (args.fields !== undefined) return parseSpec(args.fields)
  return promptFieldSpecs(prompter)
}

// Ready-made prompt module for a name-and-optional-fields generator. Returns
// BOTH renderings of the fields so a full-stack action can feed Go templates
// (`goFields`) and Zod templates (`zodFields`) from one answer set.
//
//   module.exports = require('../../_lib/prompts').namedPrompt({ message: 'Module name:' })
//   module.exports = require('../../_lib/prompts').namedPrompt({ message: 'For which model?', fields: false })
function namedPrompt({ message, fields = true }) {
  return {
    prompt: async ({ prompter, args }) => {
      const name = await askName(prompter, args, message)
      const specs = fields ? await resolveSpecs(prompter, args) : []
      return {
        name,
        goFields: specs.map(goField),
        zodFields: specs.map(zodField),
      }
    },
  }
}

module.exports = { askName, promptFieldSpecs, resolveSpecs, namedPrompt }
