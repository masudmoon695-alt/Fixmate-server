import { collections } from '../config/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { badRequest, conflict, forbidden, notFound } from '../utils/AppError.js';
import { objectIdString, toObjectId } from '../utils/objectId.js';
import {
  ACTIVE_BOOKING_STATUSES,
  BOOKING_STATUSES,
  canTechnicianTransition,
} from '../utils/statusRules.js';
import { readDate, readNumber, readString, startOfToday } from '../utils/validate.js';

function serialize(booking) {
  if (!booking) return null;
  return { ...booking, _id: objectIdString(booking._id), serviceId: objectIdString(booking.serviceId) };
}

export const createBooking = asyncHandler(async (req, res) => {
  const body = req.body || {};

  const serviceId = toObjectId(body.serviceId);
  if (!serviceId) throw badRequest('A valid serviceId is required');

  const customerPhone = readString(body.customerPhone, 'Phone number', {
    required: true,
    min: 6,
    max: 30,
  });
  const address = readString(body.address, 'Address', { required: true, min: 5, max: 300 });
  const preferredDate = readDate(body.preferredDate, 'Preferred date');
  const problemDescription = readString(body.problemDescription, 'Problem description', {
    required: true,
    min: 20,
    max: 2000,
  });

  const today = startOfToday();
  if (preferredDate < today) {
    throw badRequest('Preferred date must be today or in the future');
  }

  const service = await collections
    .services()
    .findOne({ _id: serviceId, approvalStatus: 'approved', isAvailable: true });

  if (!service) throw notFound('Service is not available for booking');

  if (service.technicianEmail === req.user.email) {
    throw forbidden('You cannot book your own service');
  }

  const activeBooking = await collections.bookings().findOne({
    serviceId: serviceId.toString(),
    customerEmail: req.user.email,
    status: { $in: ACTIVE_BOOKING_STATUSES },
  });

  if (activeBooking) {
    throw conflict('You already have an active request for this service');
  }

  const booking = {
    serviceId: serviceId.toString(),
    serviceTitle: service.title,
    serviceImage: service.image || '',
    category: service.category,
    basePrice: service.basePrice,
    technicianName: service.technicianName,
    technicianEmail: service.technicianEmail,
    customerName: req.user.name || '',
    customerEmail: req.user.email,
    customerPhone,
    address,
    preferredDate,
    problemDescription,
    status: 'requested',
    finalAmount: service.basePrice,
    paymentStatus: 'unpaid',
    createdAt: new Date(),
  };

  const result = await collections.bookings().insertOne(booking);

  res.status(201).json({
    success: true,
    data: serialize({ ...booking, _id: result.insertedId }),
    message: 'Repair request sent to the technician',
  });
});

export const getMyBookings = asyncHandler(async (req, res) => {
  const data = await collections
    .bookings()
    .find({ customerEmail: req.user.email })
    .sort({ createdAt: -1 })
    .toArray();

  res.json({ success: true, data: data.map(serialize) });
});

export const getTechnicianBookings = asyncHandler(async (req, res) => {
  const data = await collections
    .bookings()
    .find({ technicianEmail: req.user.email })
    .sort({ createdAt: -1 })
    .toArray();

  res.json({ success: true, data: data.map(serialize) });
});

export const cancelBooking = asyncHandler(async (req, res) => {
  const id = toObjectId(req.params.id);
  if (!id) throw notFound('Booking not found');

  const booking = await collections.bookings().findOne({ _id: id });
  if (!booking) throw notFound('Booking not found');
  if (booking.customerEmail !== req.user.email) {
    throw forbidden('You can only cancel your own bookings');
  }
  if (booking.status !== 'requested') {
    throw badRequest(`A ${booking.status} booking can no longer be cancelled`);
  }

  const result = await collections.bookings().findOneAndUpdate(
    { _id: id },
    { $set: { status: 'cancelled' } },
    { returnDocument: 'after' },
  );

  res.json({
    success: true,
    data: serialize(result?.value ?? result),
    message: 'Booking cancelled',
  });
});

export const submitReview = asyncHandler(async (req, res) => {
  const id = toObjectId(req.params.id);
  if (!id) throw notFound('Booking not found');

  const rating = readNumber(req.body?.rating, 'Rating', { required: true, min: 1, max: 5 });
  if (!Number.isInteger(rating)) {
    throw badRequest('Rating must be a whole number between 1 and 5');
  }

  const review = readString(req.body?.review, 'Review', { required: false, max: 300 });

  const booking = await collections.bookings().findOne({ _id: id });
  if (!booking) throw notFound('Booking not found');
  if (booking.customerEmail !== req.user.email) {
    throw forbidden('You can only review your own bookings');
  }
  if (booking.paymentStatus !== 'paid') {
    throw badRequest('Only paid bookings can be reviewed');
  }
  if (booking.rating !== undefined && booking.rating !== null) {
    throw conflict('Already reviewed');
  }

  const result = await collections.bookings().findOneAndUpdate(
    { _id: id },
    { $set: { rating, review, reviewedAt: new Date() } },
    { returnDocument: 'after' },
  );

  res.json({
    success: true,
    data: serialize(result?.value ?? result),
    message: 'Thanks! Your review was submitted.',
  });
});

export const updateBookingStatus = asyncHandler(async (req, res) => {
  const id = toObjectId(req.params.id);
  if (!id) throw notFound('Booking not found');

  const booking = await collections.bookings().findOne({ _id: id });
  if (!booking) throw notFound('Booking not found');
  if (booking.technicianEmail !== req.user.email) {
    throw forbidden('You can only update your own jobs');
  }

  const status = req.body?.status;
  if (typeof status !== 'string' || !BOOKING_STATUSES.includes(status)) {
    throw badRequest(`status must be one of: ${BOOKING_STATUSES.join(', ')}`);
  }

  if (!canTechnicianTransition(booking.status, status)) {
    throw badRequest(`Cannot change status from "${booking.status}" to "${status}"`);
  }

  const updates = { status };

  if (status === 'completed') {
    const finalAmount = readNumber(req.body?.finalAmount, 'Final amount', { min: 0.01 });
    if (!finalAmount || !Number.isFinite(finalAmount) || finalAmount <= 0) {
      throw badRequest('finalAmount must be a number greater than 0 when completing a job');
    }
    updates.finalAmount = finalAmount;
  }

  // technicianEmail, customerEmail, paymentStatus can never be set from here.
  const result = await collections.bookings().findOneAndUpdate(
    { _id: id },
    { $set: updates },
    { returnDocument: 'after' },
  );

  res.json({
    success: true,
    data: serialize(result?.value ?? result),
    message: `Booking status updated to ${status}`,
  });
});

export const getCustomerStats = asyncHandler(async (req, res) => {
  const customerEmail = req.user.email;

  const [bookingsByStatus, payments] = await Promise.all([
    collections
      .bookings()
      .aggregate([
        { $match: { customerEmail } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ])
      .toArray(),
    collections
      .payments()
      .aggregate([
        { $match: { customerEmail } },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ])
      .toArray(),
  ]);

  const statuses = Object.fromEntries(bookingsByStatus.map((row) => [row._id, row.count]));

  res.json({
    success: true,
    data: {
      bookings: {
        total: bookingsByStatus.reduce((sum, row) => sum + row.count, 0),
        ...statuses,
      },
      payments: {
        total: payments[0]?.total || 0,
        count: payments[0]?.count || 0,
      },
    },
  });
});
