import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { WalletService } from './wallet.service';
import { CurrencyService } from '../currency/currency.service';
import { Transaction } from './entities/transaction.entity';
import {
  CreateTransactionDto,
  TransactionType,
} from './dto/create-transaction.dto';
import { InsufficientFundsException } from '../common/exceptions/insufficient-funds.exception';

describe('WalletService', () => {
  let service: WalletService;
  let repository: Repository<Transaction>;
  let dataSource: DataSource;
  let currencyService: CurrencyService;

  const mockRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockDataSource = {
    transaction: jest.fn(),
  };

  const mockCurrencyService = {
    convertToEGP: jest.fn(),
    getExchangeRate: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletService,
        {
          provide: getRepositoryToken(Transaction),
          useValue: mockRepository,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
        {
          provide: CurrencyService,
          useValue: mockCurrencyService,
        },
      ],
    }).compile();

    service = module.get<WalletService>(WalletService);
    repository = module.get<Repository<Transaction>>(
      getRepositoryToken(Transaction)
    );
    dataSource = module.get<DataSource>(DataSource);
    currencyService = module.get<CurrencyService>(CurrencyService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createTransaction', () => {
    const mockDto: CreateTransactionDto = {
      transactionId: 'txn-123',
      type: TransactionType.DEPOSIT,
      amount: 100,
      currency: 'USD',
    };

    it('should create a deposit transaction successfully', async () => {
      const mockTransaction = {
        id: 1,
        transactionId: 'txn-123',
        type: 'deposit',
        amount: 3100,
        currency: 'USD',
        originalAmount: 100,
        exchangeRate: 31.0,
        createdAt: new Date(),
      };

      const mockManager = {
        findOne: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockReturnValue(mockTransaction),
        save: jest.fn().mockResolvedValue(mockTransaction),
        createQueryBuilder: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnThis(),
          getRawOne: jest.fn().mockResolvedValue({ balance: '0' }),
        }),
      };

      mockDataSource.transaction.mockImplementation(async (callback) => {
        return callback(mockManager);
      });

      mockCurrencyService.convertToEGP.mockResolvedValue(3100);
      mockCurrencyService.getExchangeRate.mockReturnValue(31.0);

      const result = await service.createTransaction(mockDto);

      expect(result.transactionId).toBe('txn-123');
      expect(result.type).toBe('deposit');
      expect(result.amount).toBe(100);
      expect(result.convertedAmount).toBe(3100);
      expect(result.balance).toBe(3100);
      expect(mockCurrencyService.convertToEGP).toHaveBeenCalledWith(100, 'USD');
    });

    it('should create a withdrawal transaction successfully', async () => {
      const depositTransaction = {
        id: 1,
        transactionId: 'txn-deposit',
        type: 'deposit',
        amount: 5000,
        currency: 'EGP',
        originalAmount: 5000,
        exchangeRate: 1.0,
        createdAt: new Date(),
      };

      const withdrawalTransaction = {
        id: 2,
        transactionId: 'txn-withdrawal',
        type: 'withdrawal',
        amount: -2000, // Withdrawals stored as negative
        currency: 'EGP',
        originalAmount: 2000,
        exchangeRate: 1.0,
        createdAt: new Date(),
      };

      const mockManager = {
        findOne: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockReturnValue(withdrawalTransaction),
        save: jest.fn().mockResolvedValue(withdrawalTransaction),
        createQueryBuilder: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnThis(),
          getRawOne: jest.fn().mockResolvedValue({ balance: '5000' }),
        }),
      };

      mockDataSource.transaction.mockImplementation(async (callback) => {
        return callback(mockManager);
      });

      mockCurrencyService.convertToEGP.mockResolvedValue(2000);
      mockCurrencyService.getExchangeRate.mockReturnValue(1.0);

      const withdrawalDto: CreateTransactionDto = {
        transactionId: 'txn-withdrawal',
        type: TransactionType.WITHDRAWAL,
        amount: 2000,
        currency: 'EGP',
      };

      const result = await service.createTransaction(withdrawalDto);

      expect(result.type).toBe('withdrawal');
      expect(result.balance).toBe(3000); // 5000 - 2000
    });

    it('should throw InsufficientFundsException when withdrawal exceeds balance', async () => {
      const mockManager = {
        findOne: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
        createQueryBuilder: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnThis(),
          getRawOne: jest.fn().mockResolvedValue({ balance: '100' }),
        }),
      };

      mockDataSource.transaction.mockImplementation(async (callback) => {
        return callback(mockManager);
      });

      mockCurrencyService.convertToEGP.mockResolvedValue(200);
      mockCurrencyService.getExchangeRate.mockReturnValue(1.0);

      const withdrawalDto: CreateTransactionDto = {
        transactionId: 'txn-withdrawal',
        type: TransactionType.WITHDRAWAL,
        amount: 200,
        currency: 'EGP',
      };

      await expect(service.createTransaction(withdrawalDto)).rejects.toThrow(
        InsufficientFundsException
      );
    });

    it('should return existing transaction if transactionId already exists (idempotency)', async () => {
      const existingTransaction = {
        id: 1,
        transactionId: 'txn-123',
        type: 'deposit',
        amount: 3100,
        currency: 'USD',
        originalAmount: 100,
        exchangeRate: 31.0,
        createdAt: new Date(),
      };

      const mockManager = {
        findOne: jest.fn().mockResolvedValue(existingTransaction),
        create: jest.fn(),
        createQueryBuilder: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnThis(),
          getRawOne: jest.fn().mockResolvedValue({ balance: '3100' }),
        }),
      };

      mockDataSource.transaction.mockImplementation(async (callback) => {
        return callback(mockManager);
      });

      const result = await service.createTransaction(mockDto);

      expect(result.transactionId).toBe('txn-123');
      expect(mockManager.findOne).toHaveBeenCalledWith(Transaction, {
        where: { transactionId: 'txn-123' },
      });
      expect(mockManager.create).not.toHaveBeenCalled();
    });

    it('should handle idempotency with in-memory map', async () => {
      const mockTransaction = {
        id: 1,
        transactionId: 'txn-123',
        type: 'deposit',
        amount: 3100,
        currency: 'USD',
        originalAmount: 100,
        exchangeRate: 31.0,
        createdAt: new Date(),
      };

      const mockManager = {
        findOne: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockReturnValue(mockTransaction),
        save: jest.fn().mockResolvedValue(mockTransaction),
        createQueryBuilder: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnThis(),
          getRawOne: jest.fn().mockResolvedValue({ balance: '0' }),
        }),
      };

      mockDataSource.transaction.mockImplementation(async (callback) => {
        return callback(mockManager);
      });

      mockCurrencyService.convertToEGP.mockResolvedValue(3100);
      mockCurrencyService.getExchangeRate.mockReturnValue(31.0);

      // Call twice concurrently
      const [result1, result2] = await Promise.all([
        service.createTransaction(mockDto),
        service.createTransaction(mockDto),
      ]);

      // Both should return the same result
      expect(result1.transactionId).toBe(result2.transactionId);
      // The transaction should only be created once
      expect(mockManager.save).toHaveBeenCalledTimes(1);
    });
  });
});
