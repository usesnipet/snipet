# Memory
ID - uuid
OrganizationID - uuid (FK to Organization.ID)
Name - varchar(255)
Type - varchar(255) - conversation, bot
IsDefault - boolean - default: false
Provider - varchar(255) - s3, local, postgres, etc
Configuration - jsonb - configuration to connect to the provider
CreatedAt - timestamp
UpdatedAt - timestamp
