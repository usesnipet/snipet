-- create index "idx_agent_runs_session_running" to table: "agent_runs"
CREATE UNIQUE INDEX "idx_agent_runs_session_running" ON "agent_runs" ("session_id") WHERE ((status)::text = 'running'::text);
