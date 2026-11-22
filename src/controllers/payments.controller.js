import { collections } from '../config/db.js';
import { getStripe } from '../config/stripe.js';
import { savePaymentFromSession, serializePayment } from '../services/paymentService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError, badRequest, forbidden, notFound } from '../utils/AppError.js';
import { toObjectId } from '../utils/objectId.js';

function clientBaseUrl() {
  const raw = process.env.CLIENT_URL || 'http://localhost:3000';
  return raw.split(',')[0].trim().replace(/\/$/, '');
}

export const createCheckoutSession = asyncHandler(async (req, res) => {
  const bookingId = toObjectId(req.body?.bookingId);
  if (!bookingId) throw badRequest('A valid bookingId is required');

  const booking = await collections.bookings().findOne({ _id: bookingId });
  if (!booking) throw notFound('Booking not found');

  if (booking.customerEmail !== req.user.email) {
    throw forbidden('You can only pay for your own bookings');
  }
  if (booking.status !== 'completed') {
    throw badRequest('You can only pay for a completed service');
  }
  if (booking.paymentStatus === 'paid') {
    throw badRequest('This booking is already paid');
  }

  const amount = Number(booking.finalAmount ?? booking.basePrice);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw badRequest('Booking amount is invalid');
  }

  const stripe = getStripe();
  const baseUrl = clientBaseUrl();

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    customer_email: req.user.email,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: Math.round(amount * 100),
          product_data: {
            name: booking.serviceTitle,
            description: `FixMate booking ${booking._id}`,
          },
        },
      },
    ],
    success_url: `${baseUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/payment/cancel`,
    metadata: {
      bookingId: booking._id.toString(),
      customerEmail: req.user.email,
    },
  });

  res.json({ success: true, data: { url: session.url, sessionId: session.id } });
});

export const verifyPayment = asyncHandler(async (req, res) => {
  const sessionId = req.query?.session_id;
  if (typeof sessionId !== 'string' || !sessionId.trim()) {
    throw badRequest('session_id is required');
  }

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(sessionId.trim(), {
    expand: ['payment_intent'],
  });

  if (session.metadata?.customerEmail !== req.user.email) {
    throw forbidden('This payment does not belong to you');
  }
  if (session.payment_status !== 'paid') {
    throw badRequest('Payment is not completed yet');
  }

  const { payment, duplicate } = await savePaymentFromSession(session);

  res.json({
    success: true,
    data: {
      amount: payment.amount,
      currency: payment.currency,
      transactionId: payment.transactionId,
      bookingId: payment.bookingId,
      paidAt: payment.paidAt,
      duplicate,
    },
  });
});

export const listMyPayments = asyncHandler(async (req, res) => {
  const data = await collections
    .payments()
    .find({ customerEmail: req.user.email })
    .sort({ paidAt: -1 })
    .toArray();

  res.json({ success: true, data: data.map(serializePayment) });
});

export const getPaymentStats = asyncHandler(async (req, res) => {
  const rows = await collections
    .payments()
    .aggregate([
      { $match: { customerEmail: req.user.email } },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ])
    .toArray();

  res.json({
    success: true,
    data: { totalPaid: rows[0]?.total || 0, paymentCount: rows[0]?.count || 0 },
  });
});

export const paymentsWebhook = asyncHandler(async (req, res) => {
  const signature = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature) throw badRequest('Missing Stripe signature');
  if (!webhookSecret) {
    throw new AppError(503, 'Stripe webhook secret is not configured');
  }

  let event;
  try {
    event = getStripe().webhooks.constructEvent(req.body, signature, webhookSecret);
  } catch (error) {
    throw badRequest(`Webhook signature verification failed: ${error.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    if (session.payment_status === 'paid') {
      await savePaymentFromSession(session);
    }
  }

  res.json({ success: true, received: true });
});
