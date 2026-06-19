# Client
ID - uuid
Name - varchar(255)
CreatedAt - timestamp
UpdatedAt - timestamp

# Client Bot
ClientID - uuid (FK to Client.ID)
BotID - uuid (FK to Bot.ID)
CreatedAt - timestamp
UpdatedAt - timestamp
INDEX: client_bots_client_id_bot_id_key (client_id, bot_id)