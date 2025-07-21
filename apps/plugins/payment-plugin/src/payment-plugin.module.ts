import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PaymentController } from './controllers/payment.controller';
import { WebhookController } from './controllers/webhook.controller';
import { PaymentEntity } from './entities/payment.entity';
import { TransactionEntity } from './entities/transaction.entity';
import { PaymentService } from './services/payment.service';
import { PayPalService } from './services/paypal.service';
import { StripeService } from './services/stripe.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: ['.env.payment', '.env'],
      isGlobal: true,
    }),
    TypeOrmModule.forFeature([PaymentEntity, TransactionEntity]),
    CacheModule.register({
      ttl: 3600, // 1 hour
      max: 1000,
    }),
  ],
  controllers: [PaymentController, WebhookController],
  providers: [PaymentService, StripeService, PayPalService],
  exports: [PaymentService],
})
export class PaymentPluginModule {
  constructor(private readonly paymentService: PaymentService) {}

  async onModuleInit() {
    console.log('Payment Plugin initialized');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const service = this.paymentService as any;
    if (typeof service.initializeProviders === 'function') {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      await service.initializeProviders();
    }
  }

  async onModuleDestroy() {
    console.log('Payment Plugin destroyed');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const service = this.paymentService as any;
    if (typeof service.cleanupProviders === 'function') {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      await service.cleanupProviders();
    }
  }
}

// Plugin-specific exports for dynamic loading
export const PluginModule = PaymentPluginModule as unknown;
export const PluginController = PaymentController as unknown;
export const PluginService = PaymentService as unknown;

// Plugin metadata for the host system
export const PluginMetadata = {
  name: 'payment-plugin',
  version: '1.0.0',
  description: 'A comprehensive payment processing plugin',
  author: 'Plugin Developer',
  apiVersion: '1.0.0',
  dependencies: {
    stripe: '^13.0.0',
    '@paypal/checkout-server-sdk': '^1.0.0',
  },
  routes: [
    { path: '/payment/providers', method: 'GET', handler: 'getProviders' },
    { path: '/payment/intent', method: 'POST', handler: 'createPaymentIntent' },
    {
      path: '/payment/intent/:id/confirm',
      method: 'POST',
      handler: 'confirmPayment',
    },
    {
      path: '/payment/intent/:id/cancel',
      method: 'POST',
      handler: 'cancelPayment',
    },
    {
      path: '/payment/webhooks/:provider',
      method: 'POST',
      handler: 'handleWebhook',
    },
    {
      path: '/payment/transactions',
      method: 'GET',
      handler: 'getTransactions',
    },
    {
      path: '/payment/transactions/:id',
      method: 'GET',
      handler: 'getTransaction',
    },
    { path: '/payment/refund', method: 'POST', handler: 'createRefund' },
    { path: '/payment/health', method: 'GET', handler: 'healthCheck' },
  ],
  permissions: [
    'network.request',
    'database.read',
    'database.write',
    'cache.read',
    'cache.write',
    'events.emit',
    'events.listen',
  ],
  hooks: {
    onLoad: () => console.log('Payment plugin loaded'),
    onUnload: () => console.log('Payment plugin unloaded'),
  },
};

// Default export for plugin loading
export default PaymentPluginModule;
