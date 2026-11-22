import { collections } from '../config/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { badRequest, forbidden, notFound } from '../utils/AppError.js';
import { escapeRegex } from '../utils/escapeRegex.js';
import { objectIdString, toObjectId } from '../utils/objectId.js';
import {
  readBoolean,
  readEnum,
  readNumber,
  readQueryInt,
  readString,
} from '../utils/validate.js';

export const CATEGORIES = [
  'Smartphone',
  'Laptop & PC',
  'AC',
  'Refrigerator',
  'TV',
  'Washing Machine',
  'Electrical',
];

export const SERVICE_MODES = ['Home Visit', 'Shop Drop-off'];

const SORT_OPTIONS = {
  'price-asc': { basePrice: 1 },
  'price-desc': { basePrice: -1 },
  newest: { createdAt: -1 },
};

const PUBLIC_FILTER = { approvalStatus: 'approved', isAvailable: true };

function serialize(service) {
  if (!service) return null;
  return { ...service, _id: objectIdString(service._id) };
}

function roundRating(value) {
  return Math.round(value * 10) / 10;
}

/**
 * Enriches serialized services with averageRating / reviewCount computed from
 * reviewed (paid) bookings. `rating` mirrors averageRating for card widgets.
 */
async function attachRatings(docs) {
  const list = docs.filter(Boolean).map(serialize);
  if (list.length === 0) return list;

  const ids = list.map((service) => service._id);
  const rows = await collections
    .bookings()
    .aggregate([
      { $match: { serviceId: { $in: ids }, rating: { $type: 'number' } } },
      {
        $group: {
          _id: '$serviceId',
          averageRating: { $avg: '$rating' },
          reviewCount: { $sum: 1 },
        },
      },
    ])
    .toArray();

  const byId = new Map(rows.map((row) => [String(row._id), row]));

  return list.map((service) => {
    const row = byId.get(String(service._id));
    const averageRating = row ? roundRating(row.averageRating) : null;
    return {
      ...service,
      rating: averageRating,
      averageRating,
      reviewCount: row ? row.reviewCount : 0,
    };
  });
}

/** Fields a technician is allowed to write. Everything else is ignored. */
function readServiceBody(body, { partial = false } = {}) {
  const data = {};
  const has = (key) => Object.prototype.hasOwnProperty.call(body, key);

  if (!partial || has('title')) {
    data.title = readString(body.title, 'Title', { required: !partial, min: 3, max: 120 });
  }
  if (!partial || has('category')) {
    data.category = readEnum(body.category, 'Category', CATEGORIES, { required: !partial });
  }
  if (!partial || has('description')) {
    data.description = readString(body.description, 'Description', {
      required: !partial,
      min: 20,
      max: 2000,
    });
  }
  if (!partial || has('image')) {
    data.image = readString(body.image, 'Image URL', { max: 1000 });
  }
  if (!partial || has('basePrice')) {
    data.basePrice = readNumber(body.basePrice, 'Base price', { required: !partial, min: 0.01 });
  }
  if (!partial || has('estimatedDuration')) {
    data.estimatedDuration = readString(body.estimatedDuration, 'Estimated duration', { max: 80 });
  }
  if (!partial || has('serviceMode')) {
    data.serviceMode = readEnum(body.serviceMode, 'Service mode', SERVICE_MODES, {
      required: !partial,
    });
  }
  if (!partial || has('serviceArea')) {
    data.serviceArea = readString(body.serviceArea, 'Service area', { max: 120 });
  }
  if (!partial && has('isAvailable')) {
    data.isAvailable = readBoolean(body.isAvailable, 'isAvailable');
  }

  return data;
}

export const listPublicServices = asyncHandler(async (req, res) => {
  const { search, category, serviceMode, sort, limit, page } = req.query;
  const filter = { ...PUBLIC_FILTER };

  if (typeof search === 'string' && search.trim()) {
    const regex = new RegExp(escapeRegex(search.trim()), 'i');
    filter.$or = [{ title: regex }, { category: regex }];
  }

  if (category !== undefined && category !== '') {
    filter.category = readEnum(category, 'category', CATEGORIES);
  }

  if (serviceMode !== undefined && serviceMode !== '') {
    filter.serviceMode = readEnum(serviceMode, 'serviceMode', SERVICE_MODES);
  }

  const sortSpec = SORT_OPTIONS[sort] || SORT_OPTIONS.newest;
  const wantsPagination = page !== undefined || limit !== undefined;
  const services = collections.services();

  if (!wantsPagination) {
    const data = await services.find(filter).sort(sortSpec).toArray();
    return res.json({ success: true, data: await attachRatings(data) });
  }

  const perPage = readQueryInt(limit, 6, { min: 1, max: 100 });
  const currentPage = readQueryInt(page, 1, { min: 1, max: 100000 });

  const [total, data] = await Promise.all([
    services.countDocuments(filter),
    services
      .find(filter)
      .sort(sortSpec)
      .skip((currentPage - 1) * perPage)
      .limit(perPage)
      .toArray(),
  ]);

  res.json({
    success: true,
    data: await attachRatings(data),
    total,
    page: currentPage,
    totalPages: Math.max(Math.ceil(total / perPage), 1),
  });
});

export const getPublicService = asyncHandler(async (req, res) => {
  const id = toObjectId(req.params.id);
  if (!id) throw notFound('Service not found');

  const service = await collections.services().findOne({ _id: id, ...PUBLIC_FILTER });
  if (!service) throw notFound('Service not found');

  const [enriched] = await attachRatings([service]);

  const reviews = await collections
    .bookings()
    .aggregate([
      { $match: { serviceId: objectIdString(id), rating: { $type: 'number' } } },
      { $sort: { reviewedAt: -1 } },
      { $limit: 10 },
      {
        $project: {
          _id: 0,
          customerName: 1,
          rating: 1,
          review: 1,
          reviewedAt: 1,
        },
      },
    ])
    .toArray();

  res.json({ success: true, data: { ...enriched, reviews } });
});

export const listMyServices = asyncHandler(async (req, res) => {
  const data = await collections
    .services()
    .find({ technicianEmail: req.user.email })
    .sort({ createdAt: -1 })
    .toArray();

  res.json({ success: true, data: data.map(serialize) });
});

export const createService = asyncHandler(async (req, res) => {
  const body = readServiceBody(req.body);

  const service = {
    ...body,
    image: body.image || '',
    estimatedDuration: body.estimatedDuration || '',
    serviceArea: body.serviceArea || '',
    technicianName: req.user.name || '',
    technicianEmail: req.user.email,
    approvalStatus: 'pending',
    isAvailable: body.isAvailable !== false,
    createdAt: new Date(),
  };

  const result = await collections.services().insertOne(service);

  res.status(201).json({
    success: true,
    data: serialize({ ...service, _id: result.insertedId }),
    message: 'Service submitted for admin approval',
  });
});

async function findOwnedService(req) {
  const id = toObjectId(req.params.id);
  if (!id) throw notFound('Service not found');

  const service = await collections.services().findOne({ _id: id });
  if (!service) throw notFound('Service not found');
  if (service.technicianEmail !== req.user.email) {
    throw forbidden('You can only manage your own services');
  }

  return { id, service };
}

export const updateService = asyncHandler(async (req, res) => {
  const { id } = await findOwnedService(req);
  const updates = readServiceBody(req.body, { partial: true });

  if (Object.keys(updates).length === 0) {
    throw badRequest('No valid fields to update');
  }

  // Any edit sends the listing back for admin approval.
  const result = await collections.services().findOneAndUpdate(
    { _id: id },
    { $set: { ...updates, approvalStatus: 'pending' } },
    { returnDocument: 'after' },
  );

  res.json({
    success: true,
    data: serialize(result?.value ?? result),
    message: 'Service updated and sent for re-approval',
  });
});

export const deleteService = asyncHandler(async (req, res) => {
  const { id } = await findOwnedService(req);
  await collections.services().deleteOne({ _id: id });

  res.json({ success: true, message: 'Service deleted' });
});

export const toggleAvailability = asyncHandler(async (req, res) => {
  const { id } = await findOwnedService(req);
  const isAvailable = readBoolean(req.body?.isAvailable, 'isAvailable');

  const result = await collections.services().findOneAndUpdate(
    { _id: id },
    { $set: { isAvailable } },
    { returnDocument: 'after' },
  );

  res.json({
    success: true,
    data: serialize(result?.value ?? result),
    message: isAvailable ? 'Service is now available' : 'Service is now unavailable',
  });
});

export const getTechnicianStats = asyncHandler(async (req, res) => {
  const services = collections.services();
  const bookings = collections.bookings();
  const payments = collections.payments();
  const technicianEmail = req.user.email;

  const [servicesByApproval, bookingsByStatus, revenue] = await Promise.all([
    services
      .aggregate([
        { $match: { technicianEmail } },
        { $group: { _id: '$approvalStatus', count: { $sum: 1 } } },
      ])
      .toArray(),
    bookings
      .aggregate([
        { $match: { technicianEmail } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ])
      .toArray(),
    payments
      .aggregate([
        { $match: { technicianEmail } },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ])
      .toArray(),
  ]);

  const approval = Object.fromEntries(servicesByApproval.map((row) => [row._id, row.count]));
  const statuses = Object.fromEntries(bookingsByStatus.map((row) => [row._id, row.count]));

  res.json({
    success: true,
    data: {
      services: {
        total: servicesByApproval.reduce((sum, row) => sum + row.count, 0),
        approved: approval.approved || 0,
        pending: approval.pending || 0,
        rejected: approval.rejected || 0,
      },
      bookings: {
        total: bookingsByStatus.reduce((sum, row) => sum + row.count, 0),
        ...statuses,
      },
      earnings: {
        total: revenue[0]?.total || 0,
        paidBookings: revenue[0]?.count || 0,
      },
    },
  });
});
