# Payment Plugin

A comprehensive payment processing plugin that supports multiple payment providers including Stripe, PayPal, and custom payment gateways.

## Features

- **Multi-Provider Support**: Stripe, PayPal, and extensible architecture for custom providers
- **Payment Intents**: Create, confirm, and cancel payment intents
- **Webhook Handling**: Secure webhook processing for payment events
- **Transaction Management**: Complete transaction history and status tracking
- **Refund Processing**: Automated and manual refund capabilities
- **Health Monitoring**: Built-in health checks and monitoring
- **Security**: Webhook validation, HTTPS enforcement, and secure key management

## API Endpoints

### Payment Providers
- `GET /payment/providers` - Get available payment providers and their status

### Payment Processing
- `POST /payment/intent` - Create a new payment intent
- `POST /payment/intent/:id/confirm` - Confirm a payment intent
- `POST /payment/intent/:id/cancel` - Cancel a payment intent

### Webhooks
- `POST /payment/webhooks/:provider` - Handle payment provider webhooks

### Transaction Management
- `GET /payment/transactions` - Get transaction history with filtering and pagination
- `GET /payment/transactions/:id` - Get specific transaction details

### Refunds
- `POST /payment/refund` - Create a refund for a completed payment

### Health Check
- `GET /payment/health` - Payment system health and provider status

## Configuration

Configure the plugin by setting environment variables:

### Stripe Configuration
```bash
STRIPE_PUBLIC_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### PayPal Configuration
```bash
PAYPAL_CLIENT_ID=your_client_id
PAYPAL_CLIENT_SECRET=your_client_secret
PAYPAL_SANDBOX=true  # Set to false for production
```

### Database Configuration
The plugin uses the host system's database configuration and creates the following tables:
- `plugin_payments` - Payment intent records
- `plugin_transactions` - Transaction history
- `plugin_refunds` - Refund records

### Security Configuration
```bash
PAYMENT_REQUIRE_HTTPS=true
PAYMENT_MAX_REFUND_DAYS=30
PAYMENT_WEBHOOK_VALIDATION=true
```

## Installation

1. Install the plugin in your plugin host system
2. Configure the environment variables
3. The plugin will automatically initialize database tables
4. Configure webhook endpoints with your payment providers

## Development

```bash
# Install dependencies
npm install

# Build the plugin
npm run build

# Run tests
npm test

# Run tests with coverage
npm run test:cov

# Lint code
npm run lint
```

## Security Considerations

- All webhook endpoints validate signatures from payment providers
- Sensitive configuration is loaded from environment variables
- HTTPS is enforced for production environments
- API keys are never logged or exposed in responses
- Refund operations have configurable time limits

## Error Handling

The plugin provides comprehensive error handling for:
- Invalid payment data
- Provider API failures
- Network connectivity issues
- Webhook validation failures
- Database transaction errors

All errors are logged with appropriate detail levels and include correlation IDs for tracking.

## Monitoring

The plugin provides health check endpoints and metrics for:
- Payment provider availability
- Transaction success rates
- Webhook processing status
- Database connection health
- Cache system status

## License

MIT