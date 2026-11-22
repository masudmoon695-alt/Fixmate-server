import Stripe from 'stripe';

let stripeClient = null;

/**
 * Lazily create the Stripe client so a missing key does not crash boot.
 * Stripe is kept in test mode by using a test-mode secret key only.
 */
export function getStripe() {
  if (stripeClient) return stripeClient;

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    const error = new Error('Stripe is not configured. Set STRIPE_SECRET_KEY.');
    error.statusCode = 503;
    throw error;
  }

  stripeClient = new Stripe(secretKey);
  return stripeClient;
}
