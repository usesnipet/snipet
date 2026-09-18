// Package jsonschema provides small helpers to load JSON documents into
// jsonx.JSONMap and validate one JSON document against another treated as a
// JSON Schema, on top of github.com/kaptinlin/jsonschema.
//
// Validate and ParseAndValidate normalize before they validate: any field
// data is missing that the schema declares a "default" for is filled in
// first (recursively, through nested "properties" and "items"), so a caller
// only has to specify what differs from the default.
package jsonschema

import (
	"encoding/json"
	"fmt"
	"sort"

	kjs "github.com/kaptinlin/jsonschema"

	"github.com/usesnipet/snipet/pkg/jsonx"
)

// Load unmarshals a JSON document into a jsonx.JSONMap.
func Load(schemaJSON []byte) (jsonx.JSONMap, error) {
	var schema jsonx.JSONMap
	if err := json.Unmarshal(schemaJSON, &schema); err != nil {
		return nil, fmt.Errorf("%w: %v", ErrInvalidJSON, err)
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

// compile builds a *kjs.Schema from schema described as a jsonx.JSONMap. A
// nil schema compiles to nil, meaning "no constraints" to Validate.
func compile(schema jsonx.JSONMap) (*kjs.Schema, error) {
	if schema == nil {
		return nil, nil
	}
	raw, err := json.Marshal(schema)
	if err != nil {
		return nil, fmt.Errorf("encode schema: %w", err)
	}
	compiled, err := kjs.NewCompiler().Compile(raw)
	if err != nil {
		return nil, fmt.Errorf("compile schema: %w", err)
	}
	return compiled, nil
}

// Validate normalizes data against schema — filling in any field missing
// from data with the schema's declared default, see the package doc —
// validates the result, and returns it. A nil schema is a no-op: data is
// returned unchanged and always valid. data may be nil.
func Validate(schema, data jsonx.JSONMap) (jsonx.JSONMap, error) {
	compiled, err := compile(schema)
	if err != nil {
		return nil, err
	}
	if compiled == nil {
		return data, nil
	}

	normalized := map[string]any{}
	if err := compiled.Unmarshal(&normalized, map[string]any(data)); err != nil {
		return nil, fmt.Errorf("apply schema defaults: %w", err)
	}

	if result := compiled.ValidateMap(normalized); !result.IsValid() {
		return nil, validationError(result)
	}
	return jsonx.JSONMap(normalized), nil
}

// validationError picks the first failing field, by name, out of an invalid
// EvaluationResult, so callers get one stable, readable message instead of
// an unordered map of every violation.
func validationError(result *kjs.EvaluationResult) error {
	details := result.DetailedErrors()
	if len(details) == 0 {
		return fmt.Errorf("invalid: schema validation failed")
	}

	fields := make([]string, 0, len(details))
	for field := range details {
		fields = append(fields, field)
	}
	sort.Strings(fields)

	first := fields[0]
	return fmt.Errorf("%s: %s", first, details[first])
}

// ParseAndValidate normalizes and validates data against schema — see
// Validate — and, if valid, decodes the result into a value of type T.
func ParseAndValidate[T any](schema, data jsonx.JSONMap) (*T, error) {
	normalized, err := Validate(schema, data)
	if err != nil {
		return nil, err
	}

	parsed, err := jsonx.ParseJSONMap[T](normalized)
	if err != nil {
		return nil, err
	}

	return &parsed, nil
}
