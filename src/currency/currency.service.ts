import { Injectable } from '@nestjs/common';
import { InvalidCurrencyException } from '../common/exceptions/invalid-currency.exception';

@Injectable()
export class CurrencyService {
  private readonly rates = {
    USD: 31.0,
    EUR: 33.5,
    GBP: 39.2,
    EGP: 1.0,
  };

  async convertToEGP(amount: number, currency: string): Promise<number> {
    const rate = this.getExchangeRate(currency);
    return amount * rate;
  }

  getExchangeRate(currency: string): number {
    const rate = this.rates[currency.toUpperCase()];
    if (!rate) {
      throw new InvalidCurrencyException(currency);
    }
    return rate;
  }
}
