import { Injectable, Inject } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Transaction } from './entities/transaction.entity';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { TransactionResponseDto } from './dto/transaction-response.dto';
import { CurrencyService } from '../currency/currency.service';
import { InsufficientFundsException } from '../common/exceptions/insufficient-funds.exception';

@Injectable()
export class WalletService {
  private readonly processingTransactions = new Map<
    string,
    Promise<TransactionResponseDto>
  >();

  constructor(
    @Inject(DataSource)
    private readonly dataSource: DataSource,
    private readonly currencyService: CurrencyService
  ) {}

  async createTransaction(
    dto: CreateTransactionDto
  ): Promise<TransactionResponseDto> {
    // Check in-memory map first (fast path for idempotency)
    const existingPromise = this.processingTransactions.get(dto.transactionId);
    if (existingPromise) {
      return existingPromise;
    }

    // Create processing promise
    const transactionPromise = this.processTransaction(dto);

    // Store in map
    this.processingTransactions.set(dto.transactionId, transactionPromise);

    try {
      // Process transaction
      return await transactionPromise;
    } finally {
      // Remove from map after completion
      this.processingTransactions.delete(dto.transactionId);
    }
  }

  private async processTransaction(
    dto: CreateTransactionDto
  ): Promise<TransactionResponseDto> {
    return await this.dataSource.transaction(async (manager) => {
      // Check database (second check for idempotency)
      const existing = await manager.findOne(Transaction, {
        where: { transactionId: dto.transactionId },
      });
      if (existing) {
        const balance = await this.calculateBalance(manager);
        return this.toResponseDto(existing, balance);
      }

      // Convert currency to EGP
      const amountInEGP = await this.currencyService.convertToEGP(
        dto.amount,
        dto.currency
      );
      const exchangeRate = this.currencyService.getExchangeRate(dto.currency);

      // Calculate current balance
      const balance = await this.calculateBalance(manager);

      // Validate balance constraint
      if (dto.type === 'withdrawal' && balance - amountInEGP < 0) {
        throw new InsufficientFundsException();
      }

      // Create transaction
      // Store withdrawals as negative amounts for correct balance calculation
      const transactionAmount =
        dto.type === 'withdrawal' ? -amountInEGP : amountInEGP;

      const transaction = manager.create(Transaction, {
        transactionId: dto.transactionId,
        type: dto.type,
        amount: transactionAmount,
        currency: dto.currency,
        originalAmount: dto.amount,
        exchangeRate: exchangeRate,
      });

      const savedTransaction = await manager.save(transaction);
      const newBalance = balance + transactionAmount;

      return this.toResponseDto(savedTransaction, newBalance);
    });
  }

  private async calculateBalance(manager: any): Promise<number> {
    // Use PostgreSQL advisory lock to serialize balance calculations
    // This prevents race conditions when multiple withdrawals happen concurrently
    const lockId = 12345; // Fixed lock ID for balance calculations

    try {
      // Acquire advisory lock (blocks until available)
      await manager.query('SELECT pg_advisory_xact_lock($1)', [lockId]);

      // Calculate balance while holding the lock
      const result = await manager
        .createQueryBuilder(Transaction, 'transaction')
        .select('COALESCE(SUM(transaction.amount), 0)', 'balance')
        .getRawOne();

      // Lock is automatically released when transaction commits/rolls back
      return parseFloat(result.balance) || 0;
    } catch (error) {
      // Lock will be released automatically on transaction rollback
      throw error;
    }
  }

  private toResponseDto(
    transaction: Transaction,
    balance: number
  ): TransactionResponseDto {
    return {
      transactionId: transaction.transactionId,
      type: transaction.type,
      amount: transaction.originalAmount,
      currency: transaction.currency,
      convertedAmount: transaction.amount,
      exchangeRate: transaction.exchangeRate,
      balance: balance,
      createdAt: transaction.createdAt,
    };
  }
}
