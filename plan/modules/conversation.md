# Conversation Module

## DTOs
- CreateConversationDTO: Create a new conversation
  - BotID: string (UUID)
  - UserIDs: []string (UUID) - list of user IDs (min: 1)
  - InitialMessage: string (optional) - if not provided, the conversation will be created without a message
  - MemoryID: string (UUID) (optional) - for conversation memory (optional)
  - Memory: CreateMemoryDTO - for create the conversation memory if id not provided (optional)
- AddUserToConversationDTO: Add a user to a conversation
  - ConversationID: string (UUID)
  - UserIDs: []string (UUID) - list of user IDs (min: 1)
- RemoveUserFromConversationDTO: Remove a user from a conversation
  - ConversationID: string (UUID)
  - UserIDs: []string (UUID) - list of user IDs (min: 1)
- SendMessageDTO: Send a message to a conversation
  - ConversationID: string (UUID)
  - UserID: string (UUID)
  - Parts: []PartDTO - array of parts
- PartDTO: Part of a message
  - Type: string - text, image, video, audio, etc
  - Content: string - content of the part

---

## Models
- Conversation: Conversation model
  - ID: uuid
  - MemoryID: uuid (FK to Memory.ID) - for conversation memory
  - BotID: uuid (FK to Bot.ID)
  - CreatedAt: timestamp
  - UpdatedAt: timestamp
- ConversationMessage: ConversationMessage model
  - ID: uuid
  - ConversationID: uuid (FK to Conversation.ID)
  - UserID: uuid (FK to User.ID)
  - Role: varchar(255) - user, bot
  - Parts: jsonb - array of objects with type and content
  - CreatedAt: timestamp
  - UpdatedAt: timestamp

---

## Conversation Message Service

### SendMessage: Send a message to a conversation
- Receive: SendMessageDTO
- Return: void
- Logic:
  - Check if the conversation ID is valid and exists
  - Check if the user ID is valid and exists
  - Create the conversation message
  - Return void

## Conversation Service
- Extend crud service.

### Create: Create a new conversation
- Receive: CreateConversationDTO
- Return: Conversation
- Logic:
  - Check if all user IDs are valid and exists
  - Check if the memory is provided, if not, use the default memory
  - Create the conversation
  - Create the user conversations
  - Return the conversation

### AddUserToConversation: Add a user to a conversation
- Receive: AddUserToConversationDTO
- Return: void
- Logic:
  - Check if the conversation ID is valid and exists
  - Check if all user IDs are valid and exists
  - Create the user conversations
  - Return void

### RemoveUserFromConversation: Remove a user from a conversation
- Receive: RemoveUserFromConversationDTO
- Return: void
- Logic:
  - Check if the conversation ID is valid and exists
  - Check if all user IDs are valid and exists
  - Remove the user conversations
  - Return void

### FindByID: Find a conversation by ID
- Default FindByID service

### FindByBotID: Find conversations by bot ID
- Receive: string (BotID)
- Return: []Conversation
- Logic:
  - Find the conversations by bot ID
  - Return the conversations

---

## Conversation Handler
- Extend crud handler.
- Register all crud handlers except UpdateByID.

### FindByBotID: Find conversations by bot ID
- Endpoint: GET /api/conversations/bot/:id
- Params: id - string (UUID)
- Response: 200 OK, 400 Bad Request, 401 Unauthorized, 403 Forbidden, 500 Internal Server Error
- Logic:
  - Validate the id is a valid UUID
  - Call the FindByBotID service
  - Return the conversations