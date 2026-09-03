// `hygen module repository <Name>` -> internal/repository/<x>.go (backend only, generic CRUD)
module.exports = require('../../_lib/prompts').namedPrompt({
  message: 'Repository for which model?',
  fields: false,
})
