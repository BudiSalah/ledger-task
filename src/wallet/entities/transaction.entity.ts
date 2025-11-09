import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('transactions')
export class Transaction {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'transaction_id', unique: true })
  @Index('idx_transaction_id')
  transactionId: string;

  @Column({ type: 'varchar', length: 50 })
  type: string;

  @Column({ type: 'decimal', precision: 19, scale: 4 })
  amount: number;

  @Column({ type: 'varchar', length: 3 })
  currency: string;

  @Column({ name: 'original_amount', type: 'decimal', precision: 19, scale: 4 })
  originalAmount: number;

  @Column({
    name: 'exchange_rate',
    type: 'decimal',
    precision: 19,
    scale: 8,
    nullable: true,
  })
  exchangeRate: number;

  @CreateDateColumn({ name: 'created_at' })
  @Index('idx_created_at')
  createdAt: Date;
}
