package api

type ErrorResponse struct {
	Error      string `json:"error" example:"Error message"`
	StatusCode int    `json:"statusCode" example:"400"`
	StatusText string `json:"statusText" example:"Bad Request"`
}
