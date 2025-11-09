import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable validation pipe globally
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    })
  );

  // Enable global exception filter
  app.useGlobalFilters(new AllExceptionsFilter());

  // Swagger/OpenAPI configuration
  const config = new DocumentBuilder()
    .setTitle('Ledger / Wallet Service')
    .setDescription(
      'A NestJS-based Ledger/Wallet Service that handles financial transactions with strict requirements for atomicity, idempotency, and balance consistency.'
    )
    .setVersion('1.0')
    .addTag('wallet', 'Wallet transaction operations')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
  console.log(
    `Swagger documentation available at: http://localhost:${port}/api`
  );
}
bootstrap();
