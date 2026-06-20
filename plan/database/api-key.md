# Api Key
ID - uuid
OrganizationID - uuid (FK to Organization.ID)
Name - varchar(255)
Description - text - nullable
Permissions - integer - Bitmask - default: 0
Key - varchar(255) - INDEX: api_keys_key_key
ExpiresAt - timestamp - nullable
Enabled - boolean - default: true
CreatedAt - timestamp
UpdatedAt - timestamp
