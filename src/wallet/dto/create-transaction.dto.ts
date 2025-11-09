import { IsString, IsNumber, IsEnum, IsNotEmpty, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum TransactionType {
  DEPOSIT = 'deposit',
  WITHDRAWAL = 'withdrawal',
}

export class CreateTransactionDto {
  @ApiProperty({
    description: 'Unique transaction identifier for idempotency',
    example: 'txn-12345',
  })
  @IsString()
  @IsNotEmpty()
  transactionId: string;

  @ApiProperty({
    description: 'Transaction type',
    enum: TransactionType,
    example: TransactionType.DEPOSIT,
  })
  @IsEnum(TransactionType)
  type: TransactionType;

  @ApiProperty({
    description: 'Transaction amount in the specified currency',
    example: 100.5,
    minimum: 0.01,
  })
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty({
    description: 'Currency code (USD, EUR, GBP, EGP)',
    example: 'USD',
  })
  @IsString()
  @IsNotEmpty()
  currency: string;
}
