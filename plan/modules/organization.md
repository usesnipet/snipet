# Organization Module

## DTOs
- CreateOrganizationDTO: Create a new organization
  - Name: string
  - Slug: string

- UpdateOrganizationDTO: Update an organization
  - Name: string

---

# Models
- Organization: Organization model
  ID - uuid
  Name - varchar(255)
  Slug - varchar(255) - UNIQUE INDEX: organizations_slug_key
  CreatedAt - timestamp
  UpdatedAt - timestamp

---

# Organization Service
- Extend crud service.

### Create: Create a new organization
- Receive: CreateOrganizationDTO
- Return: void
- Logic:
  - Check if the slug is valid and unique
  - Create the organization
  - Return void

---

# Organization Handler
- Extend crud handler.
- Register all crud handlers.
