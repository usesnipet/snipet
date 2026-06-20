# Member
UserID - uuid (FK to User.ID)
OrganizationID - uuid (FK to Organization.ID)
Role - varchar(255) - admin, user - default: user
Status - varchar(255) - active, inactive, pending - default: pending
CreatedAt - timestamp
UpdatedAt - timestamp
UNIQUE INDEX: members_user_id_organization_id_key (user_id, organization_id)