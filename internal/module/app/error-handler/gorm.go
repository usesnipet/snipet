package errorhandler

import (
	"github.com/gofiber/fiber/v3"
	"gorm.io/gorm"
)

func GormMapper(err error) (error, bool) {
	switch err {
	case gorm.ErrRecordNotFound:
		return fiber.NewError(fiber.StatusNotFound, "record not found"), true
	case gorm.ErrInvalidTransaction,
		gorm.ErrNotImplemented,
		gorm.ErrMissingWhereClause,
		gorm.ErrUnsupportedRelation,
		gorm.ErrPrimaryKeyRequired,
		gorm.ErrModelValueRequired,
		gorm.ErrModelAccessibleFieldsRequired,
		gorm.ErrInvalidData,
		gorm.ErrInvalidDB,
		gorm.ErrInvalidField,
		gorm.ErrInvalidValue:
		return fiber.NewError(fiber.StatusInternalServerError, "internal server error"), true
	default:
		return err, false
	}
}
