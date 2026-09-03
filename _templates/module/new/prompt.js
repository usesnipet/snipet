// `hygen module new <Name> [--fields "a:string:required,b:int"]`
// Full-stack domain module:
//   backend  — internal/model, internal/repository, internal/module/<x>/{dto,service,handler}
//   frontend — web/src/models/<x>.ts, web/src/features/<x>/{schemas,service,hooks}.ts
module.exports = require('../../_lib/prompts').namedPrompt({
  message: 'Module name (e.g. Order, shipping-address):',
})
