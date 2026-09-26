-- reverse: create index "idx_refresh_tokens_user_id" to table: "refresh_tokens"
DROP INDEX "idx_refresh_tokens_user_id";
-- reverse: create index "idx_refresh_tokens_hash" to table: "refresh_tokens"
DROP INDEX "idx_refresh_tokens_hash";
-- reverse: create "refresh_tokens" table
DROP TABLE "refresh_tokens";
-- reverse: create index "idx_agent_messages_tool_id" to table: "agent_messages"
DROP INDEX "idx_agent_messages_tool_id";
-- reverse: create index "idx_agent_messages_session_id" to table: "agent_messages"
DROP INDEX "idx_agent_messages_session_id";
-- reverse: create index "idx_agent_messages_run_id" to table: "agent_messages"
DROP INDEX "idx_agent_messages_run_id";
-- reverse: create "agent_messages" table
DROP TABLE "agent_messages";
-- reverse: create index "idx_tools_mcp_server_id" to table: "tools"
DROP INDEX "idx_tools_mcp_server_id";
-- reverse: create "tools" table
DROP TABLE "tools";
-- reverse: create index "idx_agent_runs_status" to table: "agent_runs"
DROP INDEX "idx_agent_runs_status";
-- reverse: create index "idx_agent_runs_session_running" to table: "agent_runs"
DROP INDEX "idx_agent_runs_session_running";
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
-- reverse: create index "idx_users_username" to table: "users"
DROP INDEX "idx_users_username";
-- reverse: create "users" table
DROP TABLE "users";
-- reverse: create "agent_mcp_servers" table
DROP TABLE "agent_mcp_servers";
-- reverse: create "mcp_servers" table
DROP TABLE "mcp_servers";
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
-- reverse: create "llm_connections" table
DROP TABLE "llm_connections";
-- reverse: create "api_keys" table
DROP TABLE "api_keys";
