import { ApiProperty } from '@nestjs/swagger';

export class TransactionResponseDto {
  @ApiProperty({
    description: 'Unique transaction identifier',
    example: 'txn-12345',
  })
  transactionId: string;

  @ApiProperty({
    description: 'Transaction type',
    example: 'deposit',
  })
  type: string;

  @ApiProperty({
    description: 'Original transaction amount',
    example: 100.5,
  })
  amount: number;

  @ApiProperty({
    description: 'Original currency code',
    example: 'USD',
  })
  currency: string;

  @ApiProperty({
    description: 'Amount converted to EGP',
    example: 3100.0,
  })
  convertedAmount: number;

  @ApiProperty({
    description: 'Exchange rate used for conversion',
    example: 31.0,
  })
  exchangeRate: number;

  @ApiProperty({
    description: 'Current wallet balance after transaction (in EGP)',
    example: 3100.0,
  })
  balance: number;

  @ApiProperty({
    description: 'Transaction creation timestamp',
    example: '2024-01-15T10:30:00Z',
  })
  createdAt: Date;
}
