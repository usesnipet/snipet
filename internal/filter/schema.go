package filter

import (
	"fmt"
	"reflect"
	"regexp"
	"sync"

	"gorm.io/gorm/schema"
)

var (
	columnNamePattern = regexp.MustCompile(`^[a-zA-Z_][a-zA-Z0-9_]*$`)
	schemaCache       sync.Map
)

func assertValidColumnName(name string) error {
	if !columnNamePattern.MatchString(name) {
		return fmt.Errorf("invalid field name %q", name)
	}
	return nil
}

func allowedColumns[T any]() (map[string]struct{}, error) {
	key := reflect.TypeFor[T]()
	if cached, ok := schemaCache.Load(key); ok {
		return cached.(map[string]struct{}), nil
	}

	s, err := schema.Parse(new(T), &sync.Map{}, schema.NamingStrategy{})
	if err != nil {
		return nil, fmt.Errorf("parse schema: %w", err)
	}

	allowed := make(map[string]struct{}, len(s.Fields))
	for _, field := range s.Fields {
		if field.DBName != "" {
			allowed[field.DBName] = struct{}{}
		}
	}

	schemaCache.Store(key, allowed)
	return allowed, nil
}

func (f *Options[T]) validateFieldNames() error {
	allowed, err := allowedColumns[T]()
	if err != nil {
		return err
	}

	for field := range f.Order.Fields {
		if err := assertValidColumnName(field); err != nil {
			return err
		}
		if _, ok := allowed[field]; !ok {
			return fmt.Errorf("unknown field %q", field)
		}
	}

	for field := range f.Where.Fields {
		if err := assertValidColumnName(field); err != nil {
			return err
		}
		if _, ok := allowed[field]; !ok {
			return fmt.Errorf("unknown field %q", field)
		}
	}

	return nil
}

func (f *Options[T]) Validate() error {
	return f.validateFieldNames()
}
