package database

import (
	"errors"

	"github.com/jackc/pgx/v5/pgconn"
	apperr "github.com/usesnipet/snipet/internal/app-err"
	"gorm.io/gorm"
)

func HandleDBError(err error) (*apperr.Error, bool) {
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return apperr.NotFound("record not found"), true
	}
	if errors.Is(err, gorm.ErrDuplicatedKey) {
		return apperr.Conflict("duplicated key"), true
	}
	if errors.Is(err, gorm.ErrForeignKeyViolated) {
		return apperr.BadRequest("foreign key constraint violated"), true
	}
	if errors.Is(err, gorm.ErrCheckConstraintViolated) {
		return apperr.BadRequest("check constraint violated"), true
	}

	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		switch pgErr.Code {
		case "23505":
			return apperr.Conflict("duplicated key"), true
		case "23503":
			return apperr.BadRequest("foreign key constraint violated"), true
		case "23514":
			return apperr.BadRequest("check constraint violated"), true
		}
	}

	return apperr.InternalServerError("internal server error"), false
}
