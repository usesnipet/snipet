package filter

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/gofiber/fiber/v3"
	"github.com/usesnipet/snipet/app/internal/model"
)

func FromFiber[T model.Model](c fiber.Ctx) (*Options[T], error) {
	take, err := strconv.Atoi(c.Query("take", "2000"))
	if err != nil {
		take = 2000
	}

	skip, err := strconv.Atoi(c.Query("skip", "0"))
	if err != nil {
		skip = 0
	}

	options := &Options[T]{
		Take: take,
		Skip: skip,
		Order: OrderOptions{
			Fields: func() map[string]OrderDirection {
				fields := make(map[string]OrderDirection)
				for key, value := range c.Queries() {
					if strings.HasPrefix(key, "order[") && strings.HasSuffix(key, "]") {
						// remove "order[" and "]"
						key = strings.TrimPrefix(strings.TrimSuffix(key, "]"), "order[")
						fields[key] = ParseOrderDirection(value)
					}
				}
				return fields
			}(),
		},
	}

	whereFields, err := parseWhereFiber(c.Queries())
	if err != nil {
		return nil, err
	}
	options.Where = WhereOptions{Fields: whereFields}

	return options, nil
}

func parseWhereFiber(queries map[string]string) (map[string]WhereFieldOptions, error) {
	fields := make(map[string]WhereFieldOptions)
	for key, value := range queries {
		if strings.HasPrefix(key, "where[") {
			key = strings.TrimPrefix(key, "where")
			parts := make([]string, 0)
			for part := range strings.SplitSeq(key, "[") {
				if part == "" {
					continue
				}
				parts = append(parts, strings.TrimSuffix(part, "]"))
			}
			switch len(parts) {
			case 1:
				fields[parts[0]] = WhereFieldOptions{
					Operator: WhereOperatorEqual,
					Value:    []any{value},
				}
			case 2:
				fields[parts[0]] = WhereFieldOptions{
					Operator: ParseWhereOperator(parts[1]),
					Value:    []any{value},
				}
			case 3:
				if _, ok := fields[parts[0]]; !ok {
					fields[parts[0]] = WhereFieldOptions{
						Operator: ParseWhereOperator(parts[1]),
						Value:    []any{value},
					}
				} else {
					field := fields[parts[0]]
					field.Value = append(field.Value, value)
					fields[parts[0]] = field
				}
			default:
				return nil, fmt.Errorf("invalid where field %q", key)
			}
		}
	}
	return fields, nil
}
