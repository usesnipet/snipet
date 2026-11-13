import { LLMRunner } from "#src/core/llm/llm.runner.js";
import { PluginDriverRegistry, PluginManifestRegistry } from "#src/core/plugin/plugin.registry.js";
import { AgentRunner } from "#src/core/run/agent.runner.js";
import { ContextResolver } from "#src/core/run/resolvers/context.resolver.js";
import { HistoryResolver } from "#src/core/run/resolvers/history.resolver.js";
import { PluginResolver } from "#src/core/run/resolvers/plugin.resolver.js";
import { TargetResolver } from "#src/core/run/resolvers/target.resolver.js";
import { RunEvents } from "#src/core/run/run.events.js";
import { LLMConnectionStore } from "#src/core/store/llm-connection.store.js";
import { MessageStore } from "#src/core/store/message.store.js";
import { PluginConnectionStore } from "#src/core/store/plugin-connection.store.js";
import { RunStore } from "#src/core/store/run.store.js";
import { LLMModule } from "#src/drivers/llm/llm.module.js";
import { PluginModule } from "#src/drivers/plugin/plugin.module.js";
import { AgentRun } from "#src/modules/agent-run/agent-run.entity.js";
import { AgentMessage } from "#src/modules/agent-session/agent-message.entity.js";
import { LlmConnection } from "#src/modules/llm-connection/llm-connection.entity.js";
import { PluginConnection } from "#src/modules/plugin-connection/plugin-connection.entity.js";
import { Logger, Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { DatabaseLLMConnectionStore } from "./stores/llm-connection.store.js";
import { DatabaseMessageStore } from "./stores/message.store.js";
import { DatabasePluginConnectionStore } from "./stores/plugin-connection.store.js";
import { DatabaseRunStore } from "./stores/run.store.js";

/**
 * Builds the core for the application: its stores on the database, its
 * resolvers and the agent runner. Core classes have no Nest decorators, so
 * factories build them. Only what the modules use is exported.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([AgentRun, AgentMessage, PluginConnection, LlmConnection]),
    LLMModule,
    PluginModule,
  ],
  providers: [
    RunEvents,
    { provide: MessageStore, useClass: DatabaseMessageStore },
    { provide: RunStore, useClass: DatabaseRunStore },
    { provide: PluginConnectionStore, useClass: DatabasePluginConnectionStore },
    { provide: LLMConnectionStore, useClass: DatabaseLLMConnectionStore },
    {
      provide: HistoryResolver,
      useFactory: (messages: MessageStore) => new HistoryResolver(messages),
      inject: [MessageStore],
    },
    {
      provide: PluginResolver,
      useFactory: (
        connections: PluginConnectionStore,
        manifests: PluginManifestRegistry,
        drivers: PluginDriverRegistry,
      ) => new PluginResolver(connections, manifests, drivers, new Logger(PluginResolver.name)),
      inject: [PluginConnectionStore, PluginManifestRegistry, PluginDriverRegistry],
    },
    { provide: ContextResolver, useFactory: () => new ContextResolver() },
    {
      provide: TargetResolver,
      useFactory: (connections: LLMConnectionStore) => new TargetResolver(connections),
      inject: [LLMConnectionStore],
    },
    {
      provide: AgentRunner,
      useFactory: (
        runEvents: RunEvents,
        history: HistoryResolver,
        plugins: PluginResolver,
        context: ContextResolver,
        targets: TargetResolver,
        messages: MessageStore,
        runs: RunStore,
        llmRunner: LLMRunner,
      ) =>
        new AgentRunner(
          runEvents,
          history,
          plugins,
          context,
          targets,
          messages,
          runs,
          llmRunner,
          new Logger(AgentRunner.name),
        ),
      inject: [
        RunEvents,
        HistoryResolver,
        PluginResolver,
        ContextResolver,
        TargetResolver,
        MessageStore,
        RunStore,
        LLMRunner,
      ],
    },
  ],
  exports: [AgentRunner, RunEvents],
})
export class CoreModule {}
