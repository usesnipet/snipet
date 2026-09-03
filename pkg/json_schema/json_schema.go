// Package jsonschema provides small helpers to load JSON documents into
// jsonx.JSONMap and validate one JSON document against another treated as a
// JSON Schema, on top of github.com/xeipuuv/gojsonschema.
package jsonschema

import (
	"encoding/json"
	"fmt"

	"github.com/usesnipet/snipet/pkg/jsonx"
	"github.com/xeipuuv/gojsonschema"
)

// Load unmarshals a JSON document into a jsonx.JSONMap.
func Load(schemaJSON []byte) (jsonx.JSONMap, error) {
	var schema jsonx.JSONMap
	if err := json.Unmarshal(schemaJSON, &schema); err != nil {
		return nil, fmt.Errorf("parse schema: %w", err)
	}
	return schema, nil
}

// MustLoad is like Load but panics on error. It is meant for schemas known
// at compile time (e.g. embedded via //go:embed).
func MustLoad(schemaJSON []byte) jsonx.JSONMap {
	schema, err := Load(schemaJSON)
	if err != nil {
		panic(err)
	}
	return schema
}

// Validate checks that json satisfies the JSON Schema described by schema,
// returning an error describing the first violation found, if any.
func Validate(schema jsonx.JSONMap, data jsonx.JSONMap) error {
	referenceLoader := gojsonschema.NewGoLoader(schema)
	jsonLoader := gojsonschema.NewGoLoader(data)

	result, err := gojsonschema.Validate(referenceLoader, jsonLoader)

	if err != nil {
		return err
	}
	if !result.Valid() {
		firstErr := result.Errors()[0]
		return fmt.Errorf("%s: %s", firstErr.Field(), firstErr.Description())
	}

	return nil
}

// ParseAndValidate validates data against schema and, if valid, decodes it
// into a value of type T.
func ParseAndValidate[T any](schema jsonx.JSONMap, data jsonx.JSONMap) (*T, error) {
	if err := Validate(schema, data); err != nil {
		return nil, err
	}

	parsed, err := jsonx.ParseJSONMap[T](data)
	if err != nil {
		return nil, err
	}

	return &parsed, nil
}
