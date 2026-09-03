package filter

import (
	"fmt"
	"reflect"
	"regexp"
	"strings"
	"sync"

	"gorm.io/gorm/schema"
)

var (
	columnNamePattern      = regexp.MustCompile(`^[a-zA-Z_][a-zA-Z0-9_]*$`)
	associationNamePattern = regexp.MustCompile(`^[A-Za-z_][A-Za-z0-9_]*$`)
	schemaCache            sync.Map
	associationCache       sync.Map
	parsedSchemaCache      sync.Map
)

func assertValidColumnName(name string) error {
	if !columnNamePattern.MatchString(name) {
		return fmt.Errorf("invalid field name %q", name)
	}
	return nil
}

func assertValidAssociationSegment(name string) error {
	if !associationNamePattern.MatchString(name) {
		return fmt.Errorf("invalid include path segment %q", name)
	}
	return nil
}

func allowedColumns[T any]() (map[string]struct{}, error) {
	key := reflect.TypeFor[T]()
	if cached, ok := schemaCache.Load(key); ok {
		return cached.(map[string]struct{}), nil
	}

	s, err := parseSchema(key)
	if err != nil {
		return nil, err
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

func parseSchema(modelType reflect.Type) (*schema.Schema, error) {
	if cached, ok := parsedSchemaCache.Load(modelType); ok {
		return cached.(*schema.Schema), nil
	}

	value := reflect.New(modelType).Interface()
	s, err := schema.Parse(value, &sync.Map{}, schema.NamingStrategy{})
	if err != nil {
		return nil, fmt.Errorf("parse schema: %w", err)
	}

	parsedSchemaCache.Store(modelType, s)
	return s, nil
}

func relationshipsFor(modelType reflect.Type) (map[string]*schema.Relationship, error) {
	if cached, ok := associationCache.Load(modelType); ok {
		return cached.(map[string]*schema.Relationship), nil
	}

	s, err := parseSchema(modelType)
	if err != nil {
		return nil, err
	}

	rels := make(map[string]*schema.Relationship, len(s.Relationships.Relations))
	for name, rel := range s.Relationships.Relations {
		rels[name] = rel
	}

	associationCache.Store(modelType, rels)
	return rels, nil
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

func (f *Options[T]) validateIncludes() error {
	rootType := reflect.TypeFor[T]()
	for _, path := range f.Include {
		if err := validateIncludePath(rootType, path); err != nil {
			return err
		}
	}
	return nil
}

func validateIncludePath(rootType reflect.Type, path string) error {
	if path == "" {
		return fmt.Errorf("invalid include path %q", path)
	}

	segments := strings.Split(path, ".")
	currentType := rootType

	for _, segment := range segments {
		if err := assertValidAssociationSegment(segment); err != nil {
			return err
		}

		rels, err := relationshipsFor(currentType)
		if err != nil {
			return err
		}

		rel, ok := rels[segment]
		if !ok {
			return fmt.Errorf("unknown include %q", path)
		}

		currentType = rel.FieldSchema.ModelType
	}

	return nil
}

func (f *Options[T]) Validate() error {
	if err := f.validateFieldNames(); err != nil {
		return err
	}
	return f.validateIncludes()
}
