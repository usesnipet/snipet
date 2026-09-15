package jsonschema

import "github.com/usesnipet/snipet/pkg/jsonx"

// ApplyDefaults returns a copy of data with every object property missing
// from data filled in from its schema's "default" keyword, applied
// recursively through nested "properties" (objects) and "items" (arrays).
// data may be nil. ApplyDefaults never mutates schema or data; it does not
// validate — pair it with Validate, or use Normalize to do both.
//
// Only plain nesting via "properties" and "items" is understood; $ref,
// allOf/oneOf/anyOf, and patternProperties are not resolved.
func ApplyDefaults(schema, data jsonx.JSONMap) jsonx.JSONMap {
	out := applyDefaults(schema, data)
	if obj := asObject(out); obj != nil {
		return obj
	}
	return jsonx.JSONMap{}
}

// Normalize applies schema defaults to data (see ApplyDefaults), validates
// the result against schema, and returns it.
func Normalize(schema, data jsonx.JSONMap) (jsonx.JSONMap, error) {
	normalized := ApplyDefaults(schema, data)
	if err := Validate(schema, normalized); err != nil {
		return nil, err
	}
	return normalized, nil
}

// NormalizeAndParse applies schema defaults to data, validates the result,
// and decodes it into a value of type T.
func NormalizeAndParse[T any](schema, data jsonx.JSONMap) (*T, error) {
	normalized, err := Normalize(schema, data)
	if err != nil {
		return nil, err
	}
	parsed, err := jsonx.ParseJSONMap[T](normalized)
	if err != nil {
		return nil, err
	}
	return &parsed, nil
}

// applyDefaults walks one schema/data pair. data is untyped because a nested
// value may be an object, array, or scalar depending on where recursion
// lands.
func applyDefaults(schema jsonx.JSONMap, data any) any {
	if schema == nil {
		return data
	}

	if props := asObject(schema["properties"]); props != nil {
		obj := asObject(data)
		result := make(jsonx.JSONMap, len(obj)+len(props))
		for k, v := range obj {
			result[k] = v
		}
		for key, rawPropSchema := range props {
			propSchema := asObject(rawPropSchema)
			if v, present := result[key]; present {
				result[key] = applyDefaults(propSchema, v)
				continue
			}
			if propSchema == nil {
				continue
			}
			if def, ok := propSchema["default"]; ok {
				result[key] = applyDefaults(propSchema, def)
			}
		}
		return result
	}

	if items := asObject(schema["items"]); items != nil {
		if arr := asArray(data); arr != nil {
			out := make(jsonx.JSONArray, len(arr))
			for i, v := range arr {
				out[i] = applyDefaults(items, v)
			}
			return out
		}
	}

	return data
}

// asObject views v as a jsonx.JSONMap. A schema or data value loaded via
// encoding/json comes back as map[string]any at every nesting level below
// the top one (json.Unmarshal doesn't know about the named JSONMap type past
// the first level), so both shapes are accepted.
func asObject(v any) jsonx.JSONMap {
	switch t := v.(type) {
	case jsonx.JSONMap:
		return t
	case map[string]any:
		return jsonx.JSONMap(t)
	default:
		return nil
	}
}

// asArray views v as a []any, accepting both jsonx.JSONArray and the bare
// []any encoding/json produces for nested array values.
func asArray(v any) []any {
	switch t := v.(type) {
	case jsonx.JSONArray:
		return []any(t)
	case []any:
		return t
	default:
		return nil
	}
}
