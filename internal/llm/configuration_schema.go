package llm

import (
	jsonschema "github.com/usesnipet/snipet/pkg/json_schema"
	"github.com/usesnipet/snipet/pkg/jsonx"
)

// LoadSchema converts a JSON schema document into a jsonx.JSONMap.
func LoadSchema(schemaJSON []byte) (jsonx.JSONMap, error) {
	return jsonschema.Load(schemaJSON)
}

// MustLoadSchema is like ConfigurationSchema but panics on error.
func MustLoadSchema(schemaJSON []byte) jsonx.JSONMap {
	schema, err := LoadSchema(schemaJSON)
	if err != nil {
		panic(err)
	}
	return schema
}
