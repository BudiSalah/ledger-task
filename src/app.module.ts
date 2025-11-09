import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { WalletModule } from './wallet/wallet.module';
import { CurrencyModule } from './currency/currency.module';

@Module({
  imports: [DatabaseModule, CurrencyModule, WalletModule],
})
export class AppModule {}
