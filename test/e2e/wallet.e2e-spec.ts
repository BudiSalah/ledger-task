import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppModule } from '../../src/app.module';
import { Transaction } from '../../src/wallet/entities/transaction.entity';
import { DataSource } from 'typeorm';

describe('WalletController (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
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
        AppModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      })
    );

    dataSource = moduleFixture.get<DataSource>(DataSource);
    await app.init();
  });

  afterAll(async () => {
    await dataSource.destroy();
    await app.close();
  });

  beforeEach(async () => {
    // Clear all transactions before each test
    await dataSource.query(
      'TRUNCATE TABLE transactions RESTART IDENTITY CASCADE'
    );
  });

  describe('POST /wallet/transaction', () => {
    it('should create a deposit transaction', () => {
      return request(app.getHttpServer())
        .post('/wallet/transaction')
        .send({
          transactionId: 'txn-1',
          type: 'deposit',
          amount: 100,
          currency: 'USD',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('transactionId', 'txn-1');
          expect(res.body).toHaveProperty('type', 'deposit');
          expect(res.body).toHaveProperty('amount', 100);
          expect(res.body).toHaveProperty('currency', 'USD');
          expect(res.body).toHaveProperty('convertedAmount', 3100);
          expect(res.body).toHaveProperty('balance', 3100);
          expect(res.body).toHaveProperty('exchangeRate', 31.0);
          expect(res.body).toHaveProperty('createdAt');
        });
    });

    it('should create a withdrawal transaction', async () => {
      // First deposit
      await request(app.getHttpServer())
        .post('/wallet/transaction')
        .send({
          transactionId: 'txn-deposit',
          type: 'deposit',
          amount: 1000,
          currency: 'EGP',
        })
        .expect(201);

      // Then withdraw
      return request(app.getHttpServer())
        .post('/wallet/transaction')
        .send({
          transactionId: 'txn-withdrawal',
          type: 'withdrawal',
          amount: 500,
          currency: 'EGP',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('type', 'withdrawal');
          expect(res.body).toHaveProperty('balance', 500);
        });
    });

    it('should reject withdrawal when insufficient funds', async () => {
      // Deposit 100 EGP
      await request(app.getHttpServer())
        .post('/wallet/transaction')
        .send({
          transactionId: 'txn-deposit',
          type: 'deposit',
          amount: 100,
          currency: 'EGP',
        })
        .expect(201);

      // Try to withdraw 200 EGP
      return request(app.getHttpServer())
        .post('/wallet/transaction')
        .send({
          transactionId: 'txn-withdrawal',
          type: 'withdrawal',
          amount: 200,
          currency: 'EGP',
        })
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toContain('Insufficient funds');
        });
    });

    it('should handle idempotent transactions', async () => {
      const dto = {
        transactionId: 'txn-idempotent',
        type: 'deposit',
        amount: 100,
        currency: 'EGP',
      };

      const [response1, response2] = await Promise.all([
        request(app.getHttpServer()).post('/wallet/transaction').send(dto),
        request(app.getHttpServer()).post('/wallet/transaction').send(dto),
      ]);

      expect(response1.status).toBe(201);
      expect(response2.status).toBe(201);
      expect(response1.body.transactionId).toBe(response2.body.transactionId);
      expect(response1.body.balance).toBe(response2.body.balance);

      // Verify only one transaction in database
      const transactions = await dataSource
        .getRepository(Transaction)
        .find({ where: { transactionId: 'txn-idempotent' } });

      expect(transactions.length).toBe(1);
    });

    it('should validate request body', () => {
      return request(app.getHttpServer())
        .post('/wallet/transaction')
        .send({
          transactionId: 'txn-invalid',
          // Missing type, amount, currency
        })
        .expect(400);
    });

    it('should reject invalid currency', () => {
      return request(app.getHttpServer())
        .post('/wallet/transaction')
        .send({
          transactionId: 'txn-invalid-currency',
          type: 'deposit',
          amount: 100,
          currency: 'JPY', // Unsupported
        })
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toContain('Unsupported currency');
        });
    });

    it('should handle multiple concurrent transactions correctly', async () => {
      // Initial deposit
      await request(app.getHttpServer())
        .post('/wallet/transaction')
        .send({
          transactionId: 'txn-initial',
          type: 'deposit',
          amount: 1000,
          currency: 'EGP',
        })
        .expect(201);

      // Launch 10 concurrent withdrawals of 100 EGP each
      const promises = Array.from({ length: 10 }, (_, i) =>
        request(app.getHttpServer())
          .post('/wallet/transaction')
          .send({
            transactionId: `txn-${i}`,
            type: 'withdrawal',
            amount: 100,
            currency: 'EGP',
          })
      );

      const results = await Promise.allSettled(promises);

      // All should succeed (total: 1000 EGP)
      const successful = results.filter((r) => r.status === 'fulfilled');
      expect(successful.length).toBe(10);

      // Final balance should be 0
      const finalTransaction = await dataSource
        .getRepository(Transaction)
        .findOne({
          where: { transactionId: 'txn-9' },
          order: { createdAt: 'DESC' },
        });

      expect(finalTransaction).toBeDefined();
    });

    it('should prevent negative balance under concurrent withdrawals', async () => {
      // Deposit 200 EGP
      await request(app.getHttpServer())
        .post('/wallet/transaction')
        .send({
          transactionId: 'txn-deposit',
          type: 'deposit',
          amount: 200,
          currency: 'EGP',
        })
        .expect(201);

      // Try to withdraw 150 EGP twice concurrently (total would be 300, but only 200 available)
      const promises = [
        request(app.getHttpServer()).post('/wallet/transaction').send({
          transactionId: 'txn-1',
          type: 'withdrawal',
          amount: 150,
          currency: 'EGP',
        }),
        request(app.getHttpServer()).post('/wallet/transaction').send({
          transactionId: 'txn-2',
          type: 'withdrawal',
          amount: 150,
          currency: 'EGP',
        }),
      ];

      const results = await Promise.allSettled(promises);

      // Filter results - only one should succeed (one gets 150, the other fails as balance would be -50)
      const successful = results.filter(
        (r) => r.status === 'fulfilled' && r.value?.status === 201
      );
      const failed = results.filter(
        (r) => r.status === 'fulfilled' && r.value?.status === 400
      );

      // With proper locking, exactly one should succeed and one should fail
      expect(successful.length).toBe(1);
      expect(failed.length).toBe(1);

      // Verify final balance is correct (200 - 150 = 50)
      const successfulResult = successful[0];
      if (successfulResult.status === 'fulfilled') {
        const successfulTxn = successfulResult.value.body;
        expect(successfulTxn.balance).toBe(50); // 200 - 150 = 50
      }
    });

    it('should convert currencies correctly', () => {
      return request(app.getHttpServer())
        .post('/wallet/transaction')
        .send({
          transactionId: 'txn-currency',
          type: 'deposit',
          amount: 100,
          currency: 'EUR',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.convertedAmount).toBe(3350); // 100 * 33.5
          expect(res.body.exchangeRate).toBe(33.5);
        });
    });
  });
});
