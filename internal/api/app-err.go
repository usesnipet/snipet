package api

type AppError struct {
	StatusCode int
	Err        error
}

func (e *AppError) Error() string {
	return e.Err.Error()
}

func NewError(statusCode int, err error) *AppError {
	return &AppError{
		StatusCode: statusCode,
		Err:        err,
	}
}
