-- reverse: create index "idx_agent_messages_tool_id" to table: "agent_messages"
DROP INDEX "idx_agent_messages_tool_id";
-- reverse: create index "idx_agent_messages_session_id" to table: "agent_messages"
DROP INDEX "idx_agent_messages_session_id";
-- reverse: create index "idx_agent_messages_run_id" to table: "agent_messages"
DROP INDEX "idx_agent_messages_run_id";
-- reverse: create "agent_messages" table
DROP TABLE "agent_messages";
-- reverse: create index "idx_agent_runs_status" to table: "agent_runs"
DROP INDEX "idx_agent_runs_status";
-- reverse: create index "idx_agent_runs_session_id" to table: "agent_runs"
DROP INDEX "idx_agent_runs_session_id";
-- reverse: create "agent_runs" table
DROP TABLE "agent_runs";
-- reverse: create index "idx_agent_sessions_user_id" to table: "agent_sessions"
DROP INDEX "idx_agent_sessions_user_id";
-- reverse: create index "idx_agent_sessions_agent_subject" to table: "agent_sessions"
DROP INDEX "idx_agent_sessions_agent_subject";
-- reverse: create "agent_sessions" table
DROP TABLE "agent_sessions";
-- reverse: create "agent_mcp_servers" table
DROP TABLE "agent_mcp_servers";
-- reverse: create index "idx_agent_llms_llm_connection_id" to table: "agent_llms"
DROP INDEX "idx_agent_llms_llm_connection_id";
-- reverse: create index "idx_agent_llms_agent_order" to table: "agent_llms"
DROP INDEX "idx_agent_llms_agent_order";
-- reverse: create "agent_llms" table
DROP TABLE "agent_llms";
-- reverse: create index "idx_agents_name" to table: "agents"
DROP INDEX "idx_agents_name";
-- reverse: create "agents" table
DROP TABLE "agents";
