# Api Key
ID - uuid
Name - varchar(255)
Key - varchar(255) - INDEX: api_keys_key_key
ExpiresAt - timestamp - nullable
Enabled - boolean - default: true
CreatedAt - timestamp
UpdatedAt - timestamp

# Bot
ID - uuid
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

# Knowledge Base
ID - uuid
Name - varchar(255)
Description - text
Provider - varchar(255) - s3, local, postgres, etc
Configuration - jsonb - configuration to connect to the provider
CreatedAt - timestamp
UpdatedAt - timestamp

# Conversation
ID - uuid
MemoryID - uuid (FK to Memory.ID) - for conversation memory
BotID - uuid (FK to Bot.ID)
CreatedAt - timestamp
UpdatedAt - timestamp

# Conversation Message
ID - uuid
ConversationID - uuid (FK to Conversation.ID)
UserID - uuid (FK to User.ID)
Role - varchar(255) - user, bot
Parts - jsonb - array of objects with type and content
CreatedAt - timestamp
UpdatedAt - timestamp

# Memory
ID - uuid
Name - varchar(255)
Type - varchar(255) - conversation, bot
IsDefault - boolean - default: false
Provider - varchar(255) - s3, local, postgres, etc
Configuration - jsonb - configuration to connect to the provider
CreatedAt - timestamp
UpdatedAt - timestamp

# User
ID - uuid
Name - varchar(255)
Anonymous - boolean
SessionID - varchar(255) nullable - INDEX: users_session_id_key
ExternalID - varchar(255) nullable
CreatedAt - timestamp
UpdatedAt - timestamp

# User Conversation
UserID - uuid (FK to User.ID)
ConversationID - uuid (FK to Conversation.ID)
CreatedAt - timestamp
UpdatedAt - timestamp
INDEX: user_conversations_user_id_conversation_id_key (user_id, conversation_id)