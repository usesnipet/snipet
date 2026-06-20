# Bot
ID - uuid
OrganizationID - uuid (FK to Organization.ID)
Name - varchar(255)
Configuration - jsonb - configuration to connect to the models
Description - text
CreatedAt - timestamp
UpdatedAt - timestamp

# Bot Memory (For bot memory only)
BotID - uuid (FK to Bot.ID)
MemoryID - uuid (FK to Memory.ID)
Active - boolean
CreatedAt - timestamp
UpdatedAt - timestamp
INDEX: bot_memories_bot_id_memory_id_key (bot_id, memory_id)

# Bot Knowledge Base
BotID - uuid (FK to Bot.ID)
KnowledgeBaseID - uuid (FK to KnowledgeBase.ID)
Active - boolean
CreatedAt - timestamp
UpdatedAt - timestamp
INDEX: bot_knowledge_bases_bot_id_knowledge_base_id_key (bot_id, knowledge_base_id)