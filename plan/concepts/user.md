# User

It is the user who interacts with the bot; they can be anonymous or authenticated.

## Anonymous User

It is the user who interacts with the bot without being authenticated. Used on pages that do not require authentication.
Example: Public documentation page, support, etc.

For anonymous users, a random session ID is created to identify the user. This ID is stored in the user's session cookie and has a configurable expiration (1 day, 1 week, 1 month, etc).

## Authenticated User

It is the user who interacts with the bot while authenticated. Used on pages that require authentication.
Example: Dashboard, customer area, private documents, etc.

For authenticated users, integration with the authentication system of the system to be integrated is required. The user ID is the user ID in the authentication system. (This needs careful planning, as the integration approach with the authentication system is not yet defined.)
