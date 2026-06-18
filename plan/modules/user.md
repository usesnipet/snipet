# User Module

## DTOs
- CreateUserDTO: Create a new user
  - Name: string
  - Anonymous: boolean
  - SessionID: string (optional)
  - ExternalID: string (optional)

- AuthenticateUserDTO: Authenticate a user
  Should provide UserID or SessionID
  - UserID: string (UUID) (optional)
  - SessionID: string (optional)
  - ExternalID: string
---

# Models
- User: User model
  ID - uuid
  Name - varchar(255)
  Anonymous - boolean
  SessionID - varchar(255) nullable - INDEX: users_session_id_key
  ExternalID - varchar(255) nullable
  CreatedAt - timestamp
  UpdatedAt - timestamp

---

# User Service
- Extend crud service.

### Authenticate: Authenticate a user
- Receive: AuthenticateUserDTO
- Return: void
- Logic:
  - Check if the user ID is valid and exists
  - Check if the session ID is valid and exists
  - Check if the user is authenticated
  - Remove the session ID from the user
  - Set the external ID to the user
  - Set the anonymous to false
  - Update the user

---

# User Handler
- Extend crud handler.
- Register all crud handlers.

### Authenticate: Authenticate a user
- Endpoint: POST /api/users/authenticate
- Body: AuthenticateUserDTO
- Response: 200 OK, 400 Bad Request, 401 Unauthorized, 500 Internal Server Error
- Logic:
  - Validate the body
  - Call the Authenticate service
  - Return void