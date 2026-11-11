import { FailoverError, LLMError, LLMErrorCode } from "#src/core/llm/errors.js";
import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from "@nestjs/common";
import { BaseExceptionFilter } from "@nestjs/core";

/** HTTP status per code; a `Record` so a new code can't be left unmapped. */
const STATUS: Record<LLMErrorCode, HttpStatus> = {
  [LLMErrorCode.MODEL_NOT_FOUND]: HttpStatus.NOT_FOUND,
  [LLMErrorCode.LLM_NOT_FOUND]: HttpStatus.NOT_FOUND,
  [LLMErrorCode.CONNECTION_NOT_FOUND]: HttpStatus.NOT_FOUND,
  [LLMErrorCode.AUTH]: HttpStatus.BAD_GATEWAY,
  [LLMErrorCode.RATE_LIMIT]: HttpStatus.TOO_MANY_REQUESTS,
  [LLMErrorCode.UNAVAILABLE]: HttpStatus.SERVICE_UNAVAILABLE,
  [LLMErrorCode.BAD_REQUEST]: HttpStatus.BAD_REQUEST,
};

/** The HTTP response for an LLM error; its message and details are client-safe by contract. */
export function llmToHttpException(error: LLMError | FailoverError): HttpException {
  if (error instanceof FailoverError) {
    return new HttpException(
      {
        message: "all configured llms failed",
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

@Catch(LLMError, FailoverError)
export class LlmErrorFilter extends BaseExceptionFilter implements ExceptionFilter {
  catch(error: LLMError | FailoverError, host: ArgumentsHost) {
    super.catch(llmToHttpException(error), host);
  }
}
