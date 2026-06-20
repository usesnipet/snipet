# Conversation
ID - uuid
OrganizationID - uuid (FK to Organization.ID)
MemoryID - uuid (FK to Memory.ID) - for conversation memory
BotID - uuid (FK to Bot.ID)
CreatedAt - timestamp
UpdatedAt - timestamp

# Conversation Message
ID - uuid
ConversationID - uuid (FK to Conversation.ID)
ClientUserID - uuid (FK to ClientUser.ID)
Role - varchar(255) - user, bot
Parts - jsonb - array of objects with type and content
CreatedAt - timestamp
UpdatedAt - timestamp
