# Architecture

# Plugin
Is the json manifest of a plugin. (See [plugin.md](plugin.md))
- `key` is the unique identifier of the plugin.
- `name` is the name of the plugin.
- `description` is the description of the plugin.
- `icon` is the icon of the plugin.
- `auth` is the authentication flow of the plugin.
  - `type` is the type of the authentication flow.(`none` or `oauth2`)
- `connection` is the connection fields of the plugin. (JSON-schema like fields that the user fills when creating the connection. Fields with `secret: true` are encrypted)
- `actions`(optional) is the actions of the plugin.
  - `driver` is the driver of the action.
  - `options` is the options of the action.
- `storage`(optional) is the storage of the plugin.
  - `driver` is the driver of the storage.
  - `options` is the options of the storage.
- `triggers`(optional) is the triggers of the plugin.
  - `driver` is the driver of the trigger.
  - `options` is the options of the trigger.
- `healthCheck`(optional) is the health check of the plugin.
  - `driver` is the driver of the health check.
  - `options` is the options of the health check.

# PluginRegistry
Is a singleton that stores all the plugins. It is used to get plugins.
## Methods
- `onModuleInit()`: Loads the plugins from the `PLUGINS_DIR` (environment variable) and registers them in the registry.
- `get(key: string)`: Gets a plugin by its key.
- `getAll()`: Gets all plugins.

# Action
Is a class that represents an action.
## Properties
- `pluginKey`: The key of the plugin that the action belongs to.
- `name`: The name/key of the action (e.g. `send-email`, `create-task`, etc.).
- `description`: The description of the action. (e.g. `Send an email to the user`)
- `inputSchema`: The input schema of the action. (JSON-schema like)

# ActionResult
Is a class that represents the result of an action.
## Properties
- `content`: The content of the action result.
- `isError`: Whether the action result is an error.

# ActionDriver
Is a abstract class that defines the interface for a action driver.
## Properties
- `key`: The key/name of the driver (e.g. `mcp`, `openapi` etc.).
## Methods
- `validateOptions(connectionId: string, options: unknown): Promise<void>`: Validates the options of the driver.
- `listActions(connectionId: string, options: unknown): Promise<Action[]>`: Lists all the actions of the driver.
  - `options` is the options of the driver, from the plugin's `actions` field. This options here are already parsed and validated.
- `callAction(connectionId: string, name: string, parameters: unknown, options: unknown): Promise<ActionResult>`: Calls an action.
  - `name` is the name of the action.
  - `parameters` is the parameters of the action.
  - `options` is the options of the driver, from the plugin's `actions` field. This options here are already parsed and validated.

# StorageDriver (Coming soon)
# TriggerDriver (Coming soon)

# HealthCheckDriver
Is a abstract class that defines the interface for a health check driver.
## Properties
- `key`: The key/name of the driver (e.g. `http-ping`, `tcp-ping` etc.).
## Methods
- `validateOptions(options: unknown): Promise<void>`: Validates the options of the driver.
- `checkHealth(options: unknown): Promise<HealthCheckResult>`: Checks the health of the driver.
  - `options` is the options of the driver, from the plugin's `healthCheck` field. This options here are already parsed and validated.
  - return a `HealthCheckResult` object.
    - `isHealthy`: Whether the health check is successful.
    - `error`: The error message if the health check is not successful.

# DriverRegistry
Is a singleton that stores all the drivers. It is used to get drivers.
## Methods
- `onModuleInit()`: Loads the drivers from the project and registers them in the registry.
- `getActionDriver(key: string): ActionDriver`: Gets an action driver by its key.
- `getStorageDriver(key: string): StorageDriver`: Gets a storage driver by its key.
- `getTriggerDriver(key: string): TriggerDriver`: Gets a trigger driver by its key.
- `getHealthCheckDriver(key: string): HealthCheckDriver`: Gets a health check driver by its key.
- `hasActionDriver(key: string): boolean`: checks if an action driver is registered by its key.
- `hasStorageDriver(key: string): boolean`: checks if a storage driver is registered by its key.
- `hasTriggerDriver(key: string): boolean`: checks if a trigger driver is registered by its key.
- `hasHealthCheckDriver(key: string): boolean`: checks if a health check driver is registered by its key.

# PluginService
Is a service that manages the plugin connections, registry and drivers.
## Properties
- `pluginRegistry`: PluginRegistry
- `driverRegistry`: DriverRegistry
- `templateService`: TemplateService
## Methods
- `filter(query: FilterQuery<PluginConnection>): Promise<Paginated<PluginConnection>>`: Filters the plugins connections.
- `findById(id: string): Promise<PluginConnection>`: Finds a plugin connection by its id.
- `create(pluginConnection: CreatePluginConnection): Promise<PluginConnection>`: Creates a plugin connection.
  - call `validatePluginConnection` to validate the plugin connection.
    - If error on getting the plugin manifest, throw an error.
    - If error on validating the plugin connection, throw an error.
    - If error on testing the plugin connection, set the `lastSyncedError` and `lastSyncedAt` to the current time.
    - If successful, set the `lastSyncedAt` to the current time.
  - create the plugin connection.
- `update(pluginConnection: UpdatePluginConnection): Promise<PluginConnection>`: Updates a plugin connection.
  - if changes pluginKey or config
    - call `validatePluginConnection` to validate the plugin connection.
      - If error on getting the plugin manifest, throw an error.
      - If error on validating the plugin connection, throw an error.
      - If error on testing the plugin connection, set the `lastSyncedError` and `lastSyncedAt` to the current time.
      - If successful, set the `lastSyncedAt` to the current time.
  - update the plugin connection.
- `delete(pluginConnection: PluginConnection): Promise<void>`: Deletes a plugin connection.
- `listManifests(): Promise<Plugin[]>`: Lists all the plugins on the registry.
- `getPluginManifest(key: string): Promise<Plugin>`: Gets a plugin manifest by its key.
- `validatePluginConnection(pluginConnection: PluginConnection): Promise<void>`: Validates the plugin connection against the plugin manifest.
  - get the plugin manifest from the plugin registry by the pluginKey.
  - if not found, throw an error.
  - validate the plugin connection against the plugin manifest.
  - replace the template variables in the plugin manifest with the plugin connection's config.
  - validate the options of the drivers against the plugin manifest.
  - test the plugin connection by calling health check (if defined). If not successful, throw an error. If successful, return.

# TemplateService
Is a service that replaces the template variables in the template string.
## Methods
- `replace(template: string, variables: Record<string, string>): string`: Replaces the template variables in the template string.
  - `template` is the template string.
  - `variables` is the variables to replace in the template string.
  - return the template string with the variables replaced.