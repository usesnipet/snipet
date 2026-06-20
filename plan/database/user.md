# User
ID - uuid
Name - varchar(255)
Email - varchar(255) - UNIQUE INDEX: users_email_key
Password - varchar(255)
Role - varchar(255) - user, admin - default: user
CreatedAt - timestamp
UpdatedAt - timestamp
