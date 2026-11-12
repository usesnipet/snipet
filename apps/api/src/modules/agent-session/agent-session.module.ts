import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { AgentMessage } from "./agent-message.entity.js";
import { AgentSessionController } from "./agent-session.controller.js";
import { AgentSession } from "./agent-session.entity.js";
import { AgentSessionService } from "./agent-session.service.js";

@Module({
  imports: [TypeOrmModule.forFeature([AgentSession, AgentMessage])],
  controllers: [AgentSessionController],
  providers: [AgentSessionService],
  exports: [AgentSessionService],
})
export class AgentSessionModule {}
