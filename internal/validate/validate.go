package validate

import (
	"context"

	"github.com/go-playground/mold/v4"
	"github.com/go-playground/validator/v10"
)

type Validator struct {
	validate *validator.Validate
	mold     *mold.Transformer
}

func (v *Validator) Validate(out any) error {
	err := v.mold.Struct(context.Background(), out)
	if err != nil {
		return err
	}
	return v.validate.Struct(out)
}

func NewValidator() *Validator {
	v := validator.New()
	m := mold.New()
	return &Validator{
		validate: v,
		mold:     m,
	}
}
