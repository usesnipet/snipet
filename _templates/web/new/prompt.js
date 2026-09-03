// `hygen web new <Name> [--fields ...]` — frontend only (no backend).
// Use `hygen module new` for both ends at once.
module.exports = require('../../_lib/prompts').namedPrompt({
  message: 'Feature name (e.g. Order, shipping-address):',
})
