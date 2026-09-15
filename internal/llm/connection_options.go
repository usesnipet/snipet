package llm

import "github.com/usesnipet/snipet/pkg/jsonx"

// Connection options are the per-connection inputs a provider needs before it
// can run: the credential and any always-required provider config (an
// endpoint, region, org id, ...). They travel as one nested map with two
// sections, each validated against its own schema:
//
//	{
//	  "auth":   { ... },   // validated against Info.Auth[].Data
//	  "config": { ... }    // validated against Info.Schemas.Config
//	}
const (
	connectionAuthKey   = "auth"
	connectionConfigKey = "config"
)

// AuthSection returns the "auth" sub-map of a connection options map, or nil.
func AuthSection(connectionOptions jsonx.JSONMap) jsonx.JSONMap {
	return connectionSection(connectionOptions, connectionAuthKey)
}

// ConfigSection returns the "config" sub-map of a connection options map, or nil.
func ConfigSection(connectionOptions jsonx.JSONMap) jsonx.JSONMap {
	return connectionSection(connectionOptions, connectionConfigKey)
}

func connectionSection(m jsonx.JSONMap, key string) jsonx.JSONMap {
	if m == nil {
		return nil
	}
	switch v := m[key].(type) {
	case jsonx.JSONMap:
		return v
	case map[string]any:
		return jsonx.JSONMap(v)
	default:
		return nil
	}
}

// orEmpty returns m, or an empty map when m is nil, so a "type: object" schema
// with only optional properties still validates.
func orEmpty(m jsonx.JSONMap) jsonx.JSONMap {
	if m == nil {
		return jsonx.JSONMap{}
	}
	return m
}
