import { Test, TestingModule } from '@nestjs/testing';
import { CurrencyService } from './currency.service';
import { InvalidCurrencyException } from '../common/exceptions/invalid-currency.exception';

describe('CurrencyService', () => {
  let service: CurrencyService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CurrencyService],
    }).compile();

    service = module.get<CurrencyService>(CurrencyService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('convertToEGP', () => {
    it('should convert USD to EGP correctly', async () => {
      const result = await service.convertToEGP(100, 'USD');
      expect(result).toBe(3100); // 100 * 31.0
    });

    it('should convert EUR to EGP correctly', async () => {
      const result = await service.convertToEGP(100, 'EUR');
      expect(result).toBe(3350); // 100 * 33.5
    });

    it('should convert GBP to EGP correctly', async () => {
      const result = await service.convertToEGP(100, 'GBP');
      expect(result).toBeCloseTo(3920, 2); // 100 * 39.2
    });

    it('should return same amount for EGP', async () => {
      const result = await service.convertToEGP(100, 'EGP');
      expect(result).toBe(100); // 100 * 1.0
    });

    it('should handle case-insensitive currency codes', async () => {
      const result1 = await service.convertToEGP(100, 'usd');
      const result2 = await service.convertToEGP(100, 'USD');
      expect(result1).toBe(result2);
      expect(result1).toBe(3100);
    });

    it('should throw InvalidCurrencyException for unsupported currency', async () => {
      await expect(service.convertToEGP(100, 'JPY')).rejects.toThrow(
        InvalidCurrencyException
      );
    });
  });

  describe('getExchangeRate', () => {
    it('should return correct rate for USD', () => {
      expect(service.getExchangeRate('USD')).toBe(31.0);
    });

    it('should return correct rate for EUR', () => {
      expect(service.getExchangeRate('EUR')).toBe(33.5);
    });

    it('should return correct rate for GBP', () => {
      expect(service.getExchangeRate('GBP')).toBe(39.2);
    });

    it('should return 1.0 for EGP', () => {
      expect(service.getExchangeRate('EGP')).toBe(1.0);
    });

    it('should handle case-insensitive currency codes', () => {
      expect(service.getExchangeRate('usd')).toBe(31.0);
      expect(service.getExchangeRate('eur')).toBe(33.5);
    });

    it('should throw InvalidCurrencyException for unsupported currency', () => {
      expect(() => service.getExchangeRate('JPY')).toThrow(
        InvalidCurrencyException
      );
    });
  });
});
