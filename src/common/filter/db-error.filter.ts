import { ArgumentsHost, Catch, ConflictException, ExceptionFilter, HttpException } from "@nestjs/common";
import { BaseExceptionFilter } from "@nestjs/core";
import { QueryFailedError } from "typeorm";

// Postgres error codes -> HTTP errors, so services don't special-case them.
const PG_ERRORS: Record<string, () => HttpException> = {
  "23505": () => new ConflictException("already exists"),
};

@Catch(QueryFailedError)
export class DbErrorFilter extends BaseExceptionFilter implements ExceptionFilter {
  catch(error: QueryFailedError & { code?: string }, host: ArgumentsHost) {
    const mapped = error.code && PG_ERRORS[error.code];
    super.catch(mapped ? mapped() : error, host);
  }
}
