import { clientMessage, CoreError, CoreErrorCode } from "#src/core/error.js";
import { FailoverError, LLMError, LLMErrorCode } from "#src/core/llm/errors.js";
import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from "@nestjs/common";
import { BaseExceptionFilter } from "@nestjs/core";

/** HTTP status per code; a `Record` so a new code can't be left unmapped. */
const STATUS: Record<CoreErrorCode | LLMErrorCode, HttpStatus> = {
  [CoreErrorCode.INVALID_JSON_SCHEMA]: HttpStatus.BAD_REQUEST,
  [CoreErrorCode.INVALID_DRIVER_OPTIONS]: HttpStatus.BAD_REQUEST,
  [CoreErrorCode.NOT_FOUND]: HttpStatus.NOT_FOUND,
  [LLMErrorCode.MODEL_NOT_FOUND]: HttpStatus.NOT_FOUND,
  [LLMErrorCode.LLM_NOT_FOUND]: HttpStatus.NOT_FOUND,
  [LLMErrorCode.CONNECTION_NOT_FOUND]: HttpStatus.NOT_FOUND,
  [LLMErrorCode.AUTH]: HttpStatus.BAD_GATEWAY,
  [LLMErrorCode.RATE_LIMIT]: HttpStatus.TOO_MANY_REQUESTS,
  [LLMErrorCode.UNAVAILABLE]: HttpStatus.SERVICE_UNAVAILABLE,
  [LLMErrorCode.BAD_REQUEST]: HttpStatus.BAD_REQUEST,
};

type ExpectedError = CoreError | LLMError | FailoverError;

/** The HTTP response for an expected error; its message and details are client-safe by contract. */
export function toHttpException(error: ExpectedError): HttpException {
  if (error instanceof FailoverError) {
    return new HttpException(
      {
        message: clientMessage(error),
        // A list, not a map by model: the same model may be tried on several connections.
        details: error.attempts.map(({ connectionId, model, error }) => ({
          connectionId,
          model,
          error: error.message,
        })),
      },
      HttpStatus.BAD_GATEWAY,
    );
  }
  const body = error.details === undefined ? error.message : { message: error.message, details: error.details };
  return new HttpException(body, STATUS[error.code]);
}

@Catch(CoreError, LLMError, FailoverError)
export class CoreErrorFilter extends BaseExceptionFilter implements ExceptionFilter {
  catch(error: ExpectedError, host: ArgumentsHost) {
    super.catch(toHttpException(error), host);
  }
}
