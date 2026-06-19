# Client User
ID - uuid
Name - varchar(255)
Anonymous - boolean
SessionID - varchar(255) nullable - INDEX: users_session_id_key
ExternalID - varchar(255) nullable
CreatedAt - timestamp
UpdatedAt - timestamp

# Client User Conversation
ClientUserID - uuid (FK to ClientUser.ID)
ConversationID - uuid (FK to Conversation.ID)
CreatedAt - timestamp
UpdatedAt - timestamp
INDEX: client_user_conversations_client_user_id_conversation_id_key (client_user_id, conversation_id)