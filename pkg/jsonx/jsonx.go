package jsonx

import (
	"database/sql/driver"
	"encoding/json"
	"errors"
	"fmt"
)

func ParseJSONMap[T any](m JSONMap) (T, error) {
	var v T

	data, err := json.Marshal(m)
	if err != nil {
		return v, err
	}

	err = json.Unmarshal(data, &v)
	if err != nil {
		return v, err
	}

	return v, nil
}

func ToJSONMap[T any](v T) (JSONMap, error) {
	jsonBytes, err := json.Marshal(v)
	if err != nil {
		return nil, err
	}
	var jsonMap JSONMap
	err = json.Unmarshal(jsonBytes, &jsonMap)
	if err != nil {
		return nil, err
	}
	return jsonMap, nil
}

type JSONMap map[string]any

func (j JSONMap) Value() (driver.Value, error) {
	if j == nil {
		return []byte("{}"), nil
	}
	return json.Marshal(j)
}

func (j *JSONMap) Scan(value any) error {
	if value == nil {
		*j = nil
		return nil
	}

	b, ok := value.([]byte)
	if !ok {
		return fmt.Errorf("expected []byte got %T", value)
	}

	return json.Unmarshal(b, j)
}

func ToJSONArray[T any](v []T) (JSONArray, error) {
	jsonBytes, err := json.Marshal(v)
	if err != nil {
		return nil, err
	}
	var jsonArray JSONArray
	err = json.Unmarshal(jsonBytes, &jsonArray)
	return jsonArray, nil
}

type JSONArray []any

func (a JSONArray) Value() (driver.Value, error) {
	return json.Marshal(a)
}

func (a *JSONArray) Scan(value any) error {
	bytes, ok := value.([]byte)
	if !ok {
		return errors.New("type assertion to []byte failed")
	}
	return json.Unmarshal(bytes, a)
}
