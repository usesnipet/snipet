// `hygen module service <Name> --module <m>`
// A module can hold several services, one per cohesive set of operations.
// Creates internal/module/<m>/<name>.go with a <Name>Service struct.
const { askName } = require('../../_lib/prompts')
const { pascal, kebab } = require('../../_lib/casing')

module.exports = {
  prompt: async ({ prompter, args }) => {
    let mod = args.module
    if (!mod) {
      mod = (
        await prompter.prompt({
          type: 'input',
          name: 'mod',
          message: 'Which module? (e.g. order)',
        })
      ).mod
    }
    if (!mod || !String(mod).trim()) throw new Error('--module is required')
    mod = String(mod).trim()

    const rawName = await askName(prompter, args, 'Service name (e.g. Pricing, Fulfilment):')
    const S = pascal(rawName)
    const stem = S.endsWith('Service') ? S.slice(0, -'Service'.length) : S

    return {
      mod,
      file: kebab(stem), // pricing
      structName: stem + 'Service', // PricingService
      ctorName: 'New' + stem + 'Service', // NewPricingService
    }
  },
}
