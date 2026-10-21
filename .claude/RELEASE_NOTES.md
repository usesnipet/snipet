# 📝 Release Notes - Snipet Project

Histórico completo de releases com descrição detalhada de features implementadas, bugfixes e melhorias.

---

## 🎉 v0.2.2 - Architecture Simplification
**Released:** October 19, 2026

### ✨ What's New
- **Documentation Boost**: Comprehensive README files added to all apps and packages
- **Architecture Refactoring**: Removed knowledge module to streamline codebase and simplify architecture
- **Better Code Organization**: Clear separation of concerns across modules

### 🔧 Improvements
- Improved project structure clarity
- Enhanced documentation for new contributors
- Reduced codebase complexity

### Issues Resolved
- ✅ #28 - Docs: Add readme to apps and packages
- ✅ #29 - Feat: remove knowledge from project to simplify and separate features

---

## 🐛 v0.2.1 - Pipeline Optimization
**Released:** October 19, 2026

### 🔧 What's Fixed
- **Smarter Release Pipeline**: npm packages that are already published are now skipped during release process
- **Faster Deployments**: Reduced release time and prevented unnecessary package re-publishing

### Issues Resolved
- ✅ #27 - Release: skip npm packages already published

---

## 🚀 v0.2.0 - Debug & Observability System
**Released:** October 16, 2026

### ✨ Major Features
- **Complete Debug System** 🐛: Comprehensive debugging capabilities for agent execution
  - Real-time monitoring of agent runs
  - Debug mode reporting at session start
  - Data storage for analysis and debugging
  
- **Settings Management** ⚙️: New settings module for persistent key-value configurations
  
- **Widget System** 🎨: 
  - Anonymous login support for embedded widget
  - Web framework integration library for easy deployment
  
- **Developer Experience**: Enhanced debugging capabilities for developers and users

### 🔧 Technical Improvements
- Persistent settings storage
- Debug mode indicators in generated output
- Framework-agnostic widget library

### Issues Resolved (7 total)
- ✅ #14 - Add Debug for agents
- ✅ #16 - Report debug mode at generation start
- ✅ #18 - Add settings module for key value configurations
- ✅ #19 - Add Debug mode on settings
- ✅ #20 - Add debugger for agent runs and store data
- ✅ #21 - Add anonymous login support for widget
- ✅ #24 - Add library for use widget in web frameworks

---

## 🎯 v0.1.0 - Core Foundation
**Released:** October 15, 2026

### ✨ Major Features
- **Plugin System Foundation** 🔌: 
  - JSON-based plugin architecture
  - Easy-to-use templates for plugin creation
  
- **Multiple LLM Providers** 🤖:
  - Support for multiple AI providers
  - Unified interface for different LLM APIs
  - Improved extensibility for future providers

### 🔧 Technical Details
- Consistent plugin-like structure applied to LLM providers
- Simplified provider integration process
- Template-driven plugin creation

### Issues Resolved (3 total)
- ✅ #6 - Add more json plugins template
- ✅ #11 - Add more llm providers
- ✅ #12 - Improve llm provider structure to be similar to plugins

---

## 🚀 v0.3.0 - In Development
**Target Release:** TBD

### ⏳ Upcoming Features
- **Cost Monitoring System** 💰: Track and monitor LLM API usage and costs
- **MCP Integration** 🔗: Support for Model Context Protocol (MCP)
  - MCP server prompts support
  - MCP instructions in agent context
  
- **Advanced Command System** ⚡:
  - Internal builtin commands
  - Claude Skills integration
  - Snipet owner command pattern
  - AI agent support
  
- **Security Improvements** 🔒: CORS origin validation
  
- **Public Documentation** 📚: 
  - Project landing page
  - Comprehensive documentation
  - Public site app

### In Progress
- 🔄 #22 - Feat: Add a cost monitoring
- 🔄 #30 - Fix: check allowed origins on run with app token *(🔴 URGENT)*
- 🔄 #33 - Feat: add mcp instructions to agent context
- 🔄 #39 - Docs: Add site app with landing page and docs
- ⏳ #35 - Feat: add support for claude skills and other ai agents
- ⏳ #36 - Feat: add support for mcp server prompts
- ⏳ #37 - Feat: add support for internal builtin commands
- ⏳ #38 - Feat: add snipet owner command pattern

---

## 📊 Development Timeline

```
Oct 13  ├─ v0.1.0 Started
Oct 15  ├─ v0.1.0 Released ✅
        │
Oct 15  ├─ v0.2.0 Started
Oct 16  ├─ v0.2.0 Released ✅
        │
Oct 19  ├─ v0.2.1 Released ✅
        ├─ v0.2.2 Released ✅
        │
Oct 20  ├─ v0.3.0 Started 🚀
        │  (Estimated completion: TBD)
        │
Future  └─ v0.4.0+ Planned
```

---

## 📈 Contribution Statistics

| Metric | Value |
|--------|-------|
| **Total Issues Created** | 32 |
| **Issues Closed** | 15 |
| **Issues Open** | 17 |
| **Major Features** | 22 |
| **Bugfixes** | 5 |
| **Documentation Updates** | 5 |
| **Commits** | 40+ |

---

## 🔗 Related Documentation

- [Full Milestone Overview](../MILESTONES.md)
- [Milestone Status Tracker](./.claude/MILESTONE_STATUS.md)
- [Milestone Update Instructions](./.github/MILESTONE_DESCRIPTIONS.md)
- [GitHub Issues](https://github.com/usesnipet/snipet/issues)
- [GitHub Milestones](https://github.com/usesnipet/snipet/milestones)

---

## 🙏 Contributing

We welcome contributions! Check out the open issues for ways to get involved:
- [Help Wanted Issues](https://github.com/usesnipet/snipet/issues?q=is%3Aopen+is%3Aissue+label%3A%22help%20wanted%22)
- [Good First Issues](https://github.com/usesnipet/snipet/issues?q=is%3Aopen+is%3Aissue+label%3A%22good%20first%20issue%22)

---

*Generated on: October 21, 2026*  
*Last Updated: October 21, 2026*
