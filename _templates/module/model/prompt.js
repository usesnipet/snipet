// `hygen module model <Name> [--fields ...]` -> internal/model/<x>.go + web/src/models/<x>.ts
module.exports = require('../../_lib/prompts').namedPrompt({ message: 'Model name:' })
