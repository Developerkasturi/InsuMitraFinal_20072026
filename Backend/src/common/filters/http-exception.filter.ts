// ─────────────────────────────────────────────────────────────────────────────
// Global HTTP Exception Filter — standardises error responses
// ─────────────────────────────────────────────────────────────────────────────
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  catch(exception: any, host: ArgumentsHost) {
    const ctx      = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request  = ctx.getRequest<Request>();

    let status  = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | object = 'Internal server error';
    let errors: any  = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object') {
        const resp = exceptionResponse as any;
        message = resp.message ?? exception.message;
        errors  = Array.isArray(resp.message) ? resp.message : undefined;
        if (errors) {
          message = 'Validation failed';
          this.logger.error(`Validation errors: ${JSON.stringify(errors)}`);
        }
      } else {
        message = exceptionResponse;
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      // Map Prisma error codes to HTTP responses
      switch (exception.code) {
        case 'P2002': {
          // Unique constraint violation
          // MongoDB returns meta.target as a string; SQL returns string[]. Handle both.
          const rawTarget = exception.meta?.target;
          const fields = Array.isArray(rawTarget)
            ? rawTarget.join(', ')
            : typeof rawTarget === 'string'
              ? rawTarget.replace(/_key$/, '').replace(/_/g, ' ')
              : 'field';
          status  = HttpStatus.CONFLICT;
          message = `A record with this ${fields} already exists`;
          break;
        }
        case 'P2025':
          // Record not found (e.g., update/delete on non-existent record)
          status  = HttpStatus.NOT_FOUND;
          message = (exception.meta?.cause as string) ?? 'Record not found';
          break;
        case 'P2003':
          // Foreign key constraint failed
          status  = HttpStatus.BAD_REQUEST;
          message = 'Related record does not exist';
          break;
        default:
          this.logger.error(`Prisma ${exception.code}: ${exception.message}`, exception.stack);
          message = 'Database operation failed';
      }
    } else if (exception instanceof Prisma.PrismaClientValidationError) {
      // Bad data types sent to Prisma (e.g., string where number expected)
      status  = HttpStatus.BAD_REQUEST;
      message = 'Invalid data format';
      this.logger.warn(`PrismaValidationError: ${exception.message}`);
    } else if (exception instanceof Error) {
      this.logger.error(exception.message, exception.stack);
      message = 'An unexpected error occurred';
    }

    response.status(status).json({
      success:    false,
      statusCode: status,
      message,
      errors,
      path:       request.url,
      timestamp:  new Date().toISOString(),
    });
  }
}
