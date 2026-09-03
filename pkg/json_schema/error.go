package jsonschema

import "errors"

// ErrInvalidJSON indicates a byte slice expected to contain a JSON document
// failed to unmarshal.
var ErrInvalidJSON = errors.New("invalid JSON")
