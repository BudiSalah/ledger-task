import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { QueryFailedError } from 'typeorm';
import { DuplicateTransactionException } from '../exceptions/duplicate-transaction.exception';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    // Handle TypeORM unique constraint violations
    if (exception instanceof QueryFailedError) {
      const error = exception as any;
      if (error.code === '23505') {
        // PostgreSQL unique violation
        const match = error.message.match(/Key \(transaction_id\)=\(([^)]+)\)/);
        const transactionId = match ? match[1] : 'unknown';
        const duplicateException = new DuplicateTransactionException(
          transactionId
        );
        return response
          .status(duplicateException.getStatus())
          .json(duplicateException.getResponse());
      }
    }

    // Handle NestJS HTTP exceptions
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      return response.status(status).json(exception.getResponse());
    }

    // Handle unknown errors
    const status = HttpStatus.INTERNAL_SERVER_ERROR;
    return response.status(status).json({
      statusCode: status,
      message: 'Internal server error',
    });
  }
}
