# Bot Module

## DTOs
- CreateBotDTO: Create a new bot
  - Name: string
  - MemoryID: string (UUID) - for bot context memory (optional)
  - Memory: CreateMemoryDTO - for create the bot memory if id not provided (optional)
  - Configuration: jsonb - configuration to connect to the models
  - Description: string
- UpdateBotDTO: Update a bot
  - Name: string (optional)
  - Configuration: jsonb - configuration to connect to the models (optional)
  - Description: string (optional)

---

## Models
- Bot: Bot model
  - ID: uuid
  - Name: string
  - Configuration: jsonb - configuration to connect to the models
  - Description: string
  - ConfigurationStatus: string - decrypted, encrypted, masked
  - ConfigurationSchema: jsonb - schema of the configuration
  - CreatedAt: timestamp
  - UpdatedAt: timestamp
  - Methods
    - DecryptConfiguration: Decrypt the configuration
    - EncryptConfiguration: Encrypt the configuration
    - MaskConfiguration: Mask the configuration
    - GetDecryptedConfiguration: Get the decrypted configuration
    - GetEncryptedConfiguration: Get the encrypted configuration
    - GetMaskedConfiguration: Get the masked configuration

---

# Bot Service
- Extend crud service.

### Create: Create a new bot
- Receive: CreateBotDTO
- Return: Bot
- Logic:
  - Validate the configuration
  - Encrypt the configuration
  - Check if the memory is provided, if not, use the default memory
  - Create the bot
  - Mask the configuration
  - Return the bot

### Update: Update a bot
- Receive: UpdateBotDTO
- Return: Bot
- Logic:
  - Check if the bot exists
  - Check if the configuration has changed
    - If true
      - Validate the configuration
      - Encrypt the configuration
  - Update the bot
  - Mask the configuration
  - Return the bot

### FindByID: Find a bot by ID
- Receive: string (ID)
- Return: Bot
- Logic:
  - Find the bot by ID
  - Mask the configuration
  - Return the bot

### FindBy: Find bots by filters
- Receive: filter.Options[Bot]
- Return: []Bot
- Logic:
  - Find the bots by filters
  - Mask the configurations
  - Return the bots

### DeleteByID: Delete a bot by ID
- Receive: string (ID)
- Return: void
- Logic:
  - Delete the bot by ID
  - Return the void

---

## Bot Handler
- Extend crud handler.
- Register all crud handlers.