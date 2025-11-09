import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const password = configService.get<string>('DB_PASSWORD');
        const config: any = {
          type: 'postgres',
          host: configService.get<string>('DB_HOST', 'localhost'),
          port: configService.get<number>('DB_PORT', 5432),
          username: configService.get<string>('DB_USER', 'postgres'),
          database: configService.get<string>('DB_NAME', 'ledger_db'),
          entities: [__dirname + '/../**/*.entity{.ts,.js}'],
          synchronize:
            configService.get<string>('TYPEORM_SYNCHRONIZE') === 'true',
          logging: configService.get<string>('TYPEORM_LOGGING') === 'true',
        };

        // Only set password if it's provided and not empty
        if (password) {
          config.password = password;
        }

        return config;
      },
      inject: [ConfigService],
    }),
  ],
})
export class DatabaseModule {}
