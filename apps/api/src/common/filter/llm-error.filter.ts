import {
  ArgumentsHost,
  BadGatewayException,
  BadRequestException,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { BaseExceptionFilter } from "@nestjs/core";

import { attemptReason, FailoverError, LlmError, LlmErrorKind } from "../../infra/llm/errors.js";

// Client-safe responses: never the raw provider message for upstream
// failures, which may carry hosts or credentials details.
const BY_KIND: Record<LlmErrorKind, (e: LlmError) => HttpException> = {
  provider_not_found: () => new NotFoundException("llm provider not found"),
  model_not_found: () => new NotFoundException("llm model not found"),
  auth: () => new UnauthorizedException("llm provider rejected credentials"),
  rate_limit: () => new HttpException("llm provider rate limited", HttpStatus.TOO_MANY_REQUESTS),
  unavailable: () => new ServiceUnavailableException("llm provider unavailable"),
  context_too_long: () => new UnprocessableEntityException("conversation too long for this model"),
  invalid_options: (e) => new BadRequestException(e.message),
  bad_request: () => new BadRequestException("invalid llm request"),
};

export function toHttpException(error: LlmError | FailoverError): HttpException {
  if (error instanceof FailoverError) {
    return new BadGatewayException({
      message: "all configured llms failed",
      details: Object.fromEntries(error.attempts.map((a) => [a.llm, attemptReason(a.error)])),
    });
  }
  return BY_KIND[error.kind](error);
}

@Catch(LlmError, FailoverError)
export class LlmErrorFilter extends BaseExceptionFilter implements ExceptionFilter {
  catch(error: LlmError | FailoverError, host: ArgumentsHost) {
    super.catch(toHttpException(error), host);
  }
}
