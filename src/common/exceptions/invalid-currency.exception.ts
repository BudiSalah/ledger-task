import { HttpException, HttpStatus } from '@nestjs/common';

export class InvalidCurrencyException extends HttpException {
  constructor(currency: string) {
    super(`Unsupported currency: ${currency}`, HttpStatus.BAD_REQUEST);
  }
}
