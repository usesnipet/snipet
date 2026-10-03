import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ConflictException,
  ExceptionFilter,
  HttpException,
} from "@nestjs/common";
import { BaseExceptionFilter } from "@nestjs/core";
import { QueryFailedError } from "typeorm";

// Postgres error codes -> HTTP errors, so services don't special-case them.
const PG_ERRORS: Record<string, () => HttpException> = {
  // unique_violation
  "23505": () => new ConflictException("already exists"),
  // foreign_key_violation: referenced row missing (insert/update) or still referenced (delete)
  "23503": () => new ConflictException("related record missing or still in use"),
  // not_null_violation
  "23502": () => new BadRequestException("required field missing"),
};

@Catch(QueryFailedError)
export class DbErrorFilter extends BaseExceptionFilter implements ExceptionFilter {
  catch(error: QueryFailedError & { code?: string }, host: ArgumentsHost) {
    const mapped = error.code && PG_ERRORS[error.code];
    super.catch(mapped ? mapped() : error, host);
  }
}
