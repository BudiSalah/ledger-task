import { HttpException, HttpStatus } from '@nestjs/common';

export class InsufficientFundsException extends HttpException {
  constructor() {
    super('Insufficient funds', HttpStatus.BAD_REQUEST);
  }
}
