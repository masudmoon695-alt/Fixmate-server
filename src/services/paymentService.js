import { collections } from '../config/db.js';
import { AppError } from '../utils/AppError.js';
import { objectIdString, toObjectId } from '../utils/objectId.js';

function transactionIdFrom(session) {
  const intent = session?.payment_intent;
  if (!intent) return null;
  if (typeof intent === 'string') return intent;
  return intent.id || null;
}

async function markBookingPaid(bookingId) {
  await collections
    .bookings()
    .updateOne({ _id: bookingId, paymentStatus: { $ne: 'paid' } }, { $set: { paymentStatus: 'paid' } });
}

/**
 * The ONE place that writes a payment document.
 * Used by GET /api/payments/verify and the Stripe webhook so retries and
 * duplicate events can never create a second payment for a booking.
 */
export async function savePaymentFromSession(session) {
  if (!session || session.payment_status !== 'paid') {
    throw new AppError(400, 'Payment has not been completed');
  }

  const bookingId = toObjectId(session.metadata?.bookingId);
  if (!bookingId) {
    throw new AppError(400, 'Stripe session is missing a valid bookingId');
  }

  const booking = await collections.bookings().findOne({ _id: bookingId });
  if (!booking) throw new AppError(404, 'Booking not found');

  if (booking.status !== 'completed') {
    throw new AppError(400, 'Payment is only allowed for completed bookings');
  }

  const payments = collections.payments();
  const lookup = { $or: [{ stripeSessionId: session.id }, { bookingId: bookingId.toString() }] };

  const existing = await payments.findOne(lookup);
  if (existing) {
    await markBookingPaid(bookingId);
    return { payment: existing, duplicate: true };
  }

  const payment = {
    bookingId: bookingId.toString(),
    serviceTitle: booking.serviceTitle,
    customerName: booking.customerName,
    customerEmail: booking.customerEmail,
    technicianName: booking.technicianName,
    technicianEmail: booking.technicianEmail,
    amount:
      typeof session.amount_total === 'number'
        ? session.amount_total / 100
        : Number(booking.finalAmount ?? booking.basePrice),
    currency: session.currency || 'usd',
    transactionId: transactionIdFrom(session),
    stripeSessionId: session.id,
    paymentStatus: 'paid',
    paidAt: session.created ? new Date(session.created * 1000) : new Date(),
  };

  try {
    const result = await payments.insertOne(payment);
    payment._id = result.insertedId;
  } catch (error) {
    // Unique indexes are the ultimate guarantee against double payments.
    if (error.code === 11000) {
      const duplicate = await payments.findOne(lookup);
      await markBookingPaid(bookingId);
      return { payment: duplicate, duplicate: true };
    }
    throw error;
  }

  await markBookingPaid(bookingId);
  return { payment, duplicate: false };
}

export function serializePayment(payment) {
  if (!payment) return null;
  return { ...payment, _id: objectIdString(payment._id) };
}
