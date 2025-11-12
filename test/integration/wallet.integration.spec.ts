import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { WalletModule } from '../../src/wallet/wallet.module';
import { CurrencyModule } from '../../src/currency/currency.module';
import { WalletService } from '../../src/wallet/wallet.service';
import { Transaction } from '../../src/wallet/entities/transaction.entity';
import {
  CreateTransactionDto,
  TransactionType,
} from '../../src/wallet/dto/create-transaction.dto';
import { InsufficientFundsException } from '../../src/common/exceptions/insufficient-funds.exception';

describe('WalletService Integration', () => {
  let module: TestingModule;
  let service: WalletService;
  let dataSource: DataSource;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: process.env.DB_HOST || 'localhost',
          port: parseInt(process.env.DB_PORT || '5432'),
          username: process.env.DB_USER || 'postgres',
          password: process.env.DB_PASSWORD || '',
          database: process.env.DB_NAME || 'ledger_db',
          entities: [Transaction],
          synchronize: true,
          dropSchema: true,
        }),
        TypeOrmModule.forFeature([Transaction]),
        WalletModule,
        CurrencyModule,
      ],
    }).compile();

    service = module.get<WalletService>(WalletService);
    dataSource = module.get<DataSource>(DataSource);
  });

  afterAll(async () => {
    await dataSource.destroy();
    await module.close();
  });

  beforeEach(async () => {
    // Clear all transactions before each test
    await dataSource.query(
      'TRUNCATE TABLE transactions RESTART IDENTITY CASCADE'
    );
  });

  describe('Transaction Persistence', () => {
    it('should persist a deposit transaction', async () => {
      const dto: CreateTransactionDto = {
        transactionId: 'txn-1',
        type: TransactionType.DEPOSIT,
        amount: 100,
        currency: 'USD',
      };

      const result = await service.createTransaction(dto);

      expect(result.transactionId).toBe('txn-1');
      expect(result.type).toBe('deposit');
      expect(result.balance).toBe(3100); // 100 USD * 31.0 = 3100 EGP

      // Verify in database
      const transaction = await dataSource
        .getRepository(Transaction)
        .findOne({ where: { transactionId: 'txn-1' } });

      expect(transaction).toBeDefined();

      // DECIMAL values from database are returned as strings, parse to number
      expect(parseFloat(transaction?.amount as any)).toBe(3100);
    });

    it('should persist a withdrawal transaction', async () => {
      // First deposit
      await service.createTransaction({
        transactionId: 'txn-deposit',
        type: TransactionType.DEPOSIT,
        amount: 1000,
        currency: 'EGP',
      });

      // Then withdraw
      const result = await service.createTransaction({
        transactionId: 'txn-withdrawal',
        type: TransactionType.WITHDRAWAL,
        amount: 500,
        currency: 'EGP',
      });

      expect(result.balance).toBe(500);
    });
  });

  describe('Balance Calculation', () => {
    it('should calculate balance correctly after multiple transactions', async () => {
      await service.createTransaction({
        transactionId: 'txn-1',
        type: TransactionType.DEPOSIT,
        amount: 100,
        currency: 'USD',
      });

      await service.createTransaction({
        transactionId: 'txn-2',
        type: TransactionType.DEPOSIT,
        amount: 50,
        currency: 'EUR',
      });

      const result = await service.createTransaction({
        transactionId: 'txn-3',
        type: TransactionType.WITHDRAWAL,
        amount: 1000,
        currency: 'EGP',
      });

      // 100 USD * 31 = 3100, 50 EUR * 33.5 = 1675, total = 4775
      // Withdraw 1000, balance = 3775
      expect(result.balance).toBe(3775);
    });
  });

  describe('Idempotency', () => {
    it('should return same transaction for duplicate transactionId', async () => {
      const dto: CreateTransactionDto = {
        transactionId: 'txn-duplicate',
        type: TransactionType.DEPOSIT,
        amount: 100,
        currency: 'EGP',
      };

      const result1 = await service.createTransaction(dto);
      const result2 = await service.createTransaction(dto);

      expect(result1.transactionId).toBe(result2.transactionId);
      // Both should return the same transaction data
      expect(result1.balance).toBe(result2.balance);

      // Verify only one transaction in database
      const transactions = await dataSource
        .getRepository(Transaction)
        .find({ where: { transactionId: 'txn-duplicate' } });

      expect(transactions.length).toBe(1);
    });
  });

  describe('Insufficient Funds', () => {
    it('should throw InsufficientFundsException when withdrawal exceeds balance', async () => {
      await service.createTransaction({
        transactionId: 'txn-deposit',
        type: TransactionType.DEPOSIT,
        amount: 100,
        currency: 'EGP',
      });

      await expect(
        service.createTransaction({
          transactionId: 'txn-withdrawal',
          type: TransactionType.WITHDRAWAL,
          amount: 200,
          currency: 'EGP',
        })
      ).rejects.toThrow(InsufficientFundsException);
    });
  });
});
