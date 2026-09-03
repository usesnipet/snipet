// `hygen module method <Method> --module <module> [--kind command|query]`
// Appends a method stub to an existing internal/module/<module>/service.go
const { askName } = require('../../_lib/prompts')

module.exports = {
  prompt: async ({ prompter, args }) => {
    let mod = args.module
    if (!mod) {
      mod = (
        await prompter.prompt({ type: 'input', name: 'mod', message: 'Existing module (e.g. order):' })
      ).mod
    }
    if (!mod || !String(mod).trim()) throw new Error('--module is required')

    const method = await askName(prompter, args, 'Method name (e.g. Approve, Archive):')

    const kind =
      args.kind ||
      (
        await prompter.prompt({
          type: 'select',
          name: 'kind',
          message: 'Kind',
          choices: ['command', 'query'],
        })
      ).kind

    return { mod: String(mod).trim(), method, kind }
  },
}
