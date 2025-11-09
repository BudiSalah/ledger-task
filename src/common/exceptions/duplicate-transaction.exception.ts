import { HttpException, HttpStatus } from '@nestjs/common';

export class DuplicateTransactionException extends HttpException {
  constructor(transactionId: string) {
    super(
      `Transaction with transactionId '${transactionId}' already exists`,
      HttpStatus.CONFLICT
    );
  }
}
