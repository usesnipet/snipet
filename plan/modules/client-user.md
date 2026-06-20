# Client User Module

## DTOs
- CreateClientUserDTO: Create a new client user
  - Name: string
  - Anonymous: boolean
  - SessionID: string (optional)
  - ExternalID: string (optional)

- AuthenticateClientUserDTO: Authenticate a client user
  Should provide ClientUserID or SessionID
  - ClientUserID: string (UUID) (optional)
  - SessionID: string (optional)
  - ExternalID: string

---

# Models
- ClientUser: ClientUser model
  ID - uuid
  Name - varchar(255)
  Anonymous - boolean
  SessionID - varchar(255) nullable - INDEX: users_session_id_key
  ExternalID - varchar(255) nullable
  CreatedAt - timestamp
  UpdatedAt - timestamp

---

# ClientUser Service
- Extend crud service.

### Authenticate: Authenticate a client user
- Receive: AuthenticateClientUserDTO
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

# ClientUser Handler
- Extend crud handler.
- Register all crud handlers.

### Authenticate: Authenticate a client user
- Endpoint: POST /api/client-users/authenticate
- Body: AuthenticateClientUserDTO
- Response: 200 OK, 400 Bad Request, 401 Unauthorized, 500 Internal Server Error
- Logic:
  - Validate the body
  - Call the Authenticate service
  - Return void