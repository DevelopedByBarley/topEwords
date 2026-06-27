---
name: cashier-stripe-development
description: "Handles Laravel Cashier Stripe integration including subscriptions, webhooks, Stripe Checkout, invoices, charges, refunds, trials, coupons, metered billing, and payment failure handling. Triggered when a user mentions Cashier, Billable, IncompletePayment, stripe_id, newSubscription, Stripe subscriptions, or billing. Also applies when setting up webhooks, handling SCA/3DS payment failures, testing with Stripe test cards, or troubleshooting incomplete subscriptions, CSRF webhook errors, or migration publish issues."
license: MIT
metadata:
  author: laravel
---
<?php
/** @var \Laravel\Boost\Install\GuidelineAssist $assist */
?>

# Cashier Stripe Development

## Documentation

Use ___SINGLE_BACKTICK___search-docs___SINGLE_BACKTICK___ for detailed Cashier patterns and documentation covering subscriptions, webhooks, Stripe Checkout, invoices, payment methods, and testing.

For deeper guidance on specific topics, read the relevant reference file before implementing:

- ___SINGLE_BACKTICK___references/subscriptions.md___SINGLE_BACKTICK___ covers subscription creation, status checks, swapping, trials, quantities, and multiple products
- ___SINGLE_BACKTICK___references/webhooks.md___SINGLE_BACKTICK___ covers webhook setup, custom handlers, CSRF exclusion, and local development with the Stripe CLI
- ___SINGLE_BACKTICK___references/testing.md___SINGLE_BACKTICK___ covers Stripe test cards, payment method tokens, and feature test patterns

## Basic Usage

### Installation

___SINGLE_BACKTICK______SINGLE_BACKTICK______SINGLE_BACKTICK___bash
<?php echo e($assist->artisanCommand('vendor:publish --tag="cashier-migrations"')); ?>

<?php echo e($assist->artisanCommand('migrate')); ?>

<?php echo e($assist->artisanCommand('vendor:publish --tag="cashier-config"')); ?>

___SINGLE_BACKTICK______SINGLE_BACKTICK______SINGLE_BACKTICK___

### Environment Variables

___SINGLE_BACKTICK______SINGLE_BACKTICK______SINGLE_BACKTICK___
STRIPE_KEY=pk_test_...
STRIPE_SECRET=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
CASHIER_CURRENCY=usd
CASHIER_CURRENCY_LOCALE=en_US
___SINGLE_BACKTICK______SINGLE_BACKTICK______SINGLE_BACKTICK___

### Billable Model

___BOOST_SNIPPET_0___

For a non-User model, register it in a service provider:

___BOOST_SNIPPET_1___

### Creating a Subscription

___BOOST_SNIPPET_2___

Always wrap subscription creation in a try/catch for ___SINGLE_BACKTICK___IncompletePayment___SINGLE_BACKTICK___. When a card requires 3DS authentication, Cashier throws this exception. The ___SINGLE_BACKTICK___cashier.payment___SINGLE_BACKTICK___ route is auto-registered and handles the confirmation flow.

## Verification

1. Run migrations and confirm ___SINGLE_BACKTICK___stripe_id___SINGLE_BACKTICK___, ___SINGLE_BACKTICK___pm_type___SINGLE_BACKTICK___, ___SINGLE_BACKTICK___pm_last_four___SINGLE_BACKTICK___, and ___SINGLE_BACKTICK___trial_ends_at___SINGLE_BACKTICK___ columns exist on the billable model table
2. Test the webhook endpoint with ___SINGLE_BACKTICK___stripe listen --forward-to localhost/stripe/webhook___SINGLE_BACKTICK___ if you use the default path, or swap ___SINGLE_BACKTICK___stripe___SINGLE_BACKTICK___ for your configured ___SINGLE_BACKTICK___CASHIER_PATH___SINGLE_BACKTICK___
3. Confirm ___SINGLE_BACKTICK___$user->subscribed('default')___SINGLE_BACKTICK___ returns the expected value for active and incomplete subscriptions

## Common Pitfalls

- The migration publish tag is ___SINGLE_BACKTICK___cashier-migrations___SINGLE_BACKTICK___, not ___SINGLE_BACKTICK___cashier___SINGLE_BACKTICK___. Running ___SINGLE_BACKTICK___migrate___SINGLE_BACKTICK___ before publishing results in missing columns and tables.
- ___SINGLE_BACKTICK___CASHIER_CURRENCY___SINGLE_BACKTICK___ must be set explicitly. It defaults to USD, which silently breaks non-US apps.
- The Stripe CLI generates its own webhook signing secret. It is different from the Dashboard endpoint secret. Using the wrong one causes signature verification failures.
- The webhook route must be excluded from CSRF verification using your configured ___SINGLE_BACKTICK___cashier.path___SINGLE_BACKTICK___. If you change ___SINGLE_BACKTICK___CASHIER_PATH___SINGLE_BACKTICK___ from ___SINGLE_BACKTICK___stripe___SINGLE_BACKTICK___ to ___SINGLE_BACKTICK___billing___SINGLE_BACKTICK___, exclude ___SINGLE_BACKTICK___billing/*___SINGLE_BACKTICK___, not ___SINGLE_BACKTICK___stripe/*___SINGLE_BACKTICK___.
- ___SINGLE_BACKTICK___canceled()___SINGLE_BACKTICK___ returns true as soon as ___SINGLE_BACKTICK___cancel()___SINGLE_BACKTICK___ is called, but the user still has access during the grace period. Use ___SINGLE_BACKTICK___ended()___SINGLE_BACKTICK___ to confirm access is fully revoked.
- ___SINGLE_BACKTICK___subscribed()___SINGLE_BACKTICK___ returns true during the grace period even though the subscription is canceled.
- ___SINGLE_BACKTICK___subscribed()___SINGLE_BACKTICK___ returns false for ___SINGLE_BACKTICK___incomplete___SINGLE_BACKTICK___ and ___SINGLE_BACKTICK___past_due___SINGLE_BACKTICK___ subscriptions by default.
- Prices cannot be swapped and quantity cannot be updated while a subscription has an incomplete payment.
- When extending ___SINGLE_BACKTICK___WebhookController___SINGLE_BACKTICK___, call ___SINGLE_BACKTICK___Cashier::ignoreRoutes()___SINGLE_BACKTICK___ in a service provider and re-register both ___SINGLE_BACKTICK___cashier.payment___SINGLE_BACKTICK___ and ___SINGLE_BACKTICK___cashier.webhook___SINGLE_BACKTICK___ under the configured ___SINGLE_BACKTICK___cashier.path___SINGLE_BACKTICK___.
- Use ___SINGLE_BACKTICK___Cashier::useCustomerModel()___SINGLE_BACKTICK___ in a service provider to set a custom billable model. There is no ___SINGLE_BACKTICK___CASHIER_MODEL___SINGLE_BACKTICK___ env var.
- ___SINGLE_BACKTICK___trial_ends_at___SINGLE_BACKTICK___ is a local database column synced via webhooks. It will be stale if webhooks are not configured in production.
- In MySQL, the ___SINGLE_BACKTICK___stripe_id___SINGLE_BACKTICK___ column must use ___SINGLE_BACKTICK___utf8_bin___SINGLE_BACKTICK___ collation to avoid case-sensitivity issues.
- ___SINGLE_BACKTICK___noProrate()___SINGLE_BACKTICK___ has no effect when combined with ___SINGLE_BACKTICK___swapAndInvoice()___SINGLE_BACKTICK___. That method always prorates.
- Methods like ___SINGLE_BACKTICK___withPromotionCode()___SINGLE_BACKTICK___ require the Stripe API ID such as ___SINGLE_BACKTICK___promo_xxxx___SINGLE_BACKTICK___, not the customer-facing code. Use ___SINGLE_BACKTICK___findPromotionCode()___SINGLE_BACKTICK___ to resolve a code to its ID.
- Always use ___SINGLE_BACKTICK___search-docs___SINGLE_BACKTICK___ for the latest Cashier documentation rather than relying on this skill alone.
<?php /**PATH /Applications/XAMPP/xamppfiles/htdocs/topEwords/storage/framework/views/e7f4a27e96bdd0635d8dc5b91b4bf6df.blade.php ENDPATH**/ ?>