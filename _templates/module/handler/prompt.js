// `hygen module handler <Name>` -> internal/module/<x>/handler.go + web/src/features/<x>/hooks.ts
module.exports = require('../../_lib/prompts').namedPrompt({
  message: 'Handler / hooks for which module?',
  fields: false,
})
