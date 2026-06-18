# Api Key Module

## DTOs
- CreateApiKeyDTO: Create a new api key
  - Name: string
  - Key: string
  - ExpiresAt: timestamp
- UpdateApiKeyDTO: Update a api key
  - Name: string
  - ExpiresAt: timestamp
  - Enabled: boolean

---

## Models
- InternalApiKey: Api key model
  - ID: uuid
  - Name: string
  - Key: string
  - ExpiresAt: timestamp
  - Enabled: boolean
  - CreatedAt: timestamp
  - UpdatedAt: timestamp
- ApiKey: Api key model
  - ID: uuid
  - Name: string
  - ExpiresAt: timestamp
  - Enabled: boolean
  - CreatedAt: timestamp
  - UpdatedAt: timestamp

---

## Api Key Service
- Extend crud service.

### Create: Create a new api key
- Receive: CreateApiKeyDTO
- Return: InternalApiKey
- Logic:
  - Check if the expires at is in the future
  - Generate a new key
  - Create the api key
  - Return the internal api key

### RefreshKey: Refresh a key of a api key
- Receive: string (ID)
- Return: InternalApiKey
- Logic:
  - Generate a new key
  - Update the api key
  - Return the updated internal api key

---

## Api Key Handler
- Extend crud handler.
- Register all crud handlers.

### RefreshKey: Refresh a key of a api key
- Endpoint: POST /api/api-keys/:id/refresh
- Params: id - string (UUID)
- Response: 200 OK, 400 Bad Request, 401 Unauthorized, 403 Forbidden, 500 Internal Server Error
- Logic:
  - Validate the id is a valid UUID
  - Call the RefreshKey service
  - Return the internal api key
