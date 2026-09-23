-- drop tools left behind by mcp servers deleted before the foreign key existed
DELETE FROM "tools" WHERE "mcp_server_id" IS NOT NULL AND "mcp_server_id" NOT IN (SELECT "id" FROM "mcp_servers");
-- modify "tools" table
ALTER TABLE "tools" ADD CONSTRAINT "fk_tools_mcp_server" FOREIGN KEY ("mcp_server_id") REFERENCES "mcp_servers" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;
