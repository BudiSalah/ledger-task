import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBadRequestResponse,
  ApiConflictResponse,
} from '@nestjs/swagger';
import { WalletService } from './wallet.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { TransactionResponseDto } from './dto/transaction-response.dto';

@ApiTags('wallet')
@Controller('wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Post('transaction')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new transaction',
    description:
      'Record a new transaction (deposit or withdrawal). The transaction is idempotent - sending the same transactionId multiple times will only process it once. All amounts are stored internally in EGP.',
  })
  @ApiResponse({
    status: 201,
    description: 'Transaction created successfully',
    type: TransactionResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid request or insufficient funds',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: {
          type: 'string',
          example: 'Insufficient funds',
        },
        error: { type: 'string', example: 'Bad Request' },
      },
    },
  })
  @ApiConflictResponse({
    description: 'Transaction with this transactionId already exists',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 409 },
        message: {
          type: 'string',
          example: "Transaction with transactionId 'txn-123' already exists",
        },
        error: { type: 'string', example: 'Conflict' },
      },
    },
  })
  async createTransaction(
    @Body() createTransactionDto: CreateTransactionDto
  ): Promise<TransactionResponseDto> {
    return this.walletService.createTransaction(createTransactionDto);
  }
}
