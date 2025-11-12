# Ledger / Wallet Service

A **Ledger / Wallet Service** built with **NestJS** that handles financial transactions with strict requirements for atomicity, idempotency, and balance consistency.

## Features

- ✅ **Atomic Transactions**: All transactions are processed atomically using database transactions
- ✅ **Idempotency**: Duplicate transaction IDs are handled gracefully (in-memory map + database constraint)
- ✅ **Balance Protection**: Balance never goes negative (rejects insufficient fund withdrawals)
- ✅ **Currency Conversion**: Supports USD, EUR, GBP, and EGP with automatic conversion to EGP
- ✅ **Concurrent Safety**: Handles concurrent requests correctly with database-level locking
- ✅ **Comprehensive Testing**: Unit, integration, and E2E tests included

## API Endpoint

- `POST /wallet/transaction` → Record a new transaction (deposit or withdrawal)

## Requirements

- **Transactions & Ledger**

  - Record each transaction with `transactionId`, `type`, `amount`, `currency`, and `createdAt`.
  - Positive amounts increase balance, negative amounts decrease balance.
  - Balance must **never go negative** (reject if insufficient funds).
  - All transactions are **append-only** (cannot be updated or deleted).

- **Currency Handling**

  - Internally store all amounts in **EGP**.
  - If a different currency is provided, uses a **mock conversion service** before saving.

- **Atomicity**

  - All transactions must be **atomic** (balance should always remain consistent even under concurrent requests).

- **Idempotency**
  - If the same `transactionId` is sent more than once, process it **only once**.

---

## Prerequisites

- Node.js (v18 or higher)
- pnpm (package manager)
- Docker and Docker Compose (for PostgreSQL)

## Setup Instructions

### 1. Clone the repository

```bash
git clone <repository-url>
cd ledger-task
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Set up environment variables

Copy the example environment file:

```bash
cp .env.example .env
```

The `.env` file should contain:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=
DB_NAME=ledger_db

# Application Configuration
NODE_ENV=development
PORT=3000

# TypeORM Configuration
TYPEORM_SYNCHRONIZE=false
TYPEORM_LOGGING=true
```

### 4. Start PostgreSQL

```bash
docker-compose up -d
```

This will start a PostgreSQL container with:

- User: `postgres`
- Password: None (trust authentication)
- Database: `ledger_db`
- Port: `5432`

### 5. Run the application

```bash
# Development mode (with hot reload)
pnpm run start:dev

# Production mode
pnpm run build
pnpm run start:prod
```

The application will be available at `http://localhost:3000`

### 6. Access API Documentation

Once the application is running, visit:

- **Swagger UI**: `http://localhost:3000/api`

---

## Running Tests

```bash
# Run all tests (unit, integration, and E2E)
pnpm test:all

# Run unit tests only
pnpm test

# Run tests in watch mode
pnpm run test:watch

# Run tests with coverage
pnpm run test:cov

# Run integration tests (requires PostgreSQL running)
pnpm test:integration

# Run E2E tests (requires PostgreSQL running)
pnpm test:e2e
```

### Test Types

- **Unit Tests** (`pnpm test`): Fast, isolated tests for individual services

  - Location: `src/**/*.spec.ts`
  - No database required

- **Integration Tests** (`pnpm test:integration`): Test database operations with real PostgreSQL

  - Location: `test/integration/**/*.integration.spec.ts`
  - Requires: PostgreSQL running (`docker-compose up -d`)

- **E2E Tests** (`pnpm test:e2e`): Full HTTP API tests with real database
  - Location: `test/e2e/**/*.e2e-spec.ts`
  - Requires: PostgreSQL running (`docker-compose up -d`)
  - Tests complete request/response cycle

### Prerequisites for Integration & E2E Tests

Make sure PostgreSQL is running before running integration or E2E tests:

```bash
docker-compose up -d
```

## API Usage Examples

### Create a Deposit Transaction

```bash
curl -X POST http://localhost:3000/wallet/transaction \
  -H "Content-Type: application/json" \
  -d '{
    "transactionId": "txn-12345",
    "type": "deposit",
    "amount": 100,
    "currency": "USD"
  }'
```

**Response:**

```json
{
  "transactionId": "txn-12345",
  "type": "deposit",
  "amount": 100,
  "currency": "USD",
  "convertedAmount": 3100,
  "exchangeRate": 31.0,
  "balance": 3100,
  "createdAt": "2024-01-15T10:30:00Z"
}
```

### Create a Withdrawal Transaction

```bash
curl -X POST http://localhost:3000/wallet/transaction \
  -H "Content-Type: application/json" \
  -d '{
    "transactionId": "txn-67890",
    "type": "withdrawal",
    "amount": 500,
    "currency": "EGP"
  }'
```

### Idempotent Transaction

Sending the same `transactionId` multiple times will return the same transaction without creating duplicates:

```bash
# First request
curl -X POST http://localhost:3000/wallet/transaction \
  -H "Content-Type: application/json" \
  -d '{
    "transactionId": "txn-12345",
    "type": "deposit",
    "amount": 100,
    "currency": "USD"
  }'

# Second request with same transactionId - returns existing transaction
curl -X POST http://localhost:3000/wallet/transaction \
  -H "Content-Type: application/json" \
  -d '{
    "transactionId": "txn-12345",
    "type": "deposit",
    "amount": 100,
    "currency": "USD"
  }'
```

## Supported Currencies

- **USD** (US Dollar) - Rate: 31.0 EGP
- **EUR** (Euro) - Rate: 33.5 EGP
- **GBP** (British Pound) - Rate: 39.2 EGP
- **EGP** (Egyptian Pound) - Rate: 1.0 EGP

## Error Responses

### Insufficient Funds (400)

```json
{
  "statusCode": 400,
  "message": "Insufficient funds",
  "error": "Bad Request"
}
```

### Duplicate Transaction (409)

```json
{
  "statusCode": 409,
  "message": "Transaction with transactionId 'txn-123' already exists",
  "error": "Conflict"
}
```

### Invalid Currency (400)

```json
{
  "statusCode": 400,
  "message": "Unsupported currency: JPY",
  "error": "Bad Request"
}
```

## Testing Coverage

The test suite covers:

- ✅ Deposit increases balance
- ✅ Withdrawal decreases balance and fails if it would go negative
- ✅ Multiple concurrent transactions keep the balance consistent
- ✅ Idempotent transaction does not duplicate effects
- ✅ Currency conversion works correctly
- ✅ Database persistence and retrieval

## Project Structure

```
ledger-task/
├── src/
│   ├── wallet/              # Wallet module
│   │   ├── entities/        # Transaction entity
│   │   ├── dto/             # Data transfer objects
│   │   ├── wallet.controller.ts
│   │   ├── wallet.service.ts
│   │   └── wallet.module.ts
│   ├── currency/            # Currency conversion module
│   ├── common/              # Shared utilities
│   │   ├── exceptions/      # Custom exceptions
│   │   └── filters/         # Exception filters
│   ├── database/            # Database configuration
│   ├── app.module.ts
│   └── main.ts
├── test/
│   ├── e2e/                 # End-to-end tests
│   └── integration/         # Integration tests
├── docker-compose.yml       # PostgreSQL setup
└── package.json
```

## Technology Stack

- **Framework**: NestJS
- **Database**: PostgreSQL
- **ORM**: TypeORM
- **Testing**: Jest, Supertest
- **Documentation**: Swagger/OpenAPI
- **Package Manager**: pnpm

## License

ISC
