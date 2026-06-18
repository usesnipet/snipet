# Memory Module

## DTOs
- CreateMemoryDTO: Create a new memory
  - Name: string
  - Type: string
  - IsDefault: boolean
  - Provider: string
  - Configuration: jsonb

- UpdateMemoryDTO: Update a memory
  - Name: string (optional)

- SetDefaultMemoryDTO: Set a memory as default
  - MemoryID: string (UUID)

---

## Models
- Memory: Memory model
  ID - uuid
  Name - varchar(255)
  Type - varchar(255) - conversation, bot
  IsDefault - boolean - default: false
  Provider - varchar(255) - s3, local, postgres, etc
  Configuration - jsonb - configuration to connect to the provider
  CreatedAt - timestamp
  UpdatedAt - timestamp

---

# Memory Service
- Extend crud service.

### Create: Create a new memory
- Receive: CreateMemoryDTO
- Return: void
- Logic:
  - Check if the memory is default and there is already a default memory
  - Set the other memories as not default
  - Create the memory

### SetDefaultMemory: Set a memory as default
- Receive: SetDefaultMemoryDTO
- Return: void
- Logic:
  - Check if the memory ID is valid and exists
  - Set the memory as default
  - Update the old default memory as not default
  - Return void