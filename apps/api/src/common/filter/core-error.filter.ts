import { CoreError, CoreErrorCode } from "#src/core/error.js";
import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from "@nestjs/common";
import { BaseExceptionFilter } from "@nestjs/core";

/** HTTP status per code; a `Record` so a new code can't be left unmapped. */
const STATUS: Record<CoreErrorCode, HttpStatus> = {
  [CoreErrorCode.INVALID_JSON_SCHEMA]: HttpStatus.BAD_REQUEST,
  [CoreErrorCode.INVALID_DRIVER_OPTIONS]: HttpStatus.BAD_REQUEST,
  [CoreErrorCode.NOT_FOUND]: HttpStatus.NOT_FOUND,
};

/** The HTTP response for a core error; its message and details are client-safe by contract. */
export function coreToHttpException(error: CoreError): HttpException {
  const body = error.details === undefined ? error.message : { message: error.message, details: error.details };
  return new HttpException(body, STATUS[error.code]);
}

@Catch(CoreError)
export class CoreErrorFilter extends BaseExceptionFilter implements ExceptionFilter {
  catch(error: CoreError, host: ArgumentsHost) {
    super.catch(coreToHttpException(error), host);
  }
}
