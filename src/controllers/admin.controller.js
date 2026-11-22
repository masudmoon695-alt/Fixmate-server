import { collections } from '../config/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { badRequest, forbidden, notFound } from '../utils/AppError.js';
import { escapeRegex } from '../utils/escapeRegex.js';
import { objectIdString, toObjectId } from '../utils/objectId.js';
import { BOOKING_STATUSES } from '../utils/statusRules.js';
import { readEnum, readQueryInt, readString } from '../utils/validate.js';

const ROLES = ['customer', 'technician', 'admin'];
const APPROVAL_STATUSES = ['pending', 'approved', 'rejected'];

function publicUser(user) {
  return {
    _id: objectIdString(user._id),
    name: user.name,
    email: user.email,
    image: user.image || null,
    role: user.role || 'customer',
    phone: user.phone || '',
    area: user.area || '',
    bio: user.bio || '',
    createdAt: user.createdAt || null,
  };
}

export const listUsers = asyncHandler(async (req, res) => {
  const filter = {};
  const role = readEnum(req.query.role, 'role', ROLES);
  if (role) filter.role = role;

  if (typeof req.query.search === 'string' && req.query.search.trim()) {
    const regex = new RegExp(escapeRegex(req.query.search.trim()), 'i');
    filter.$or = [{ name: regex }, { email: regex }];
  }

  const perPage = readQueryInt(req.query.limit, 100, { min: 1, max: 200 });
  const page = readQueryInt(req.query.page, 1, { min: 1, max: 100000 });

  const users = collections.users();
  const [total, data] = await Promise.all([
    users.countDocuments(filter),
    users
      .find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * perPage)
      .limit(perPage)
      .toArray(),
  ]);

  res.json({
    success: true,
    data: data.map(publicUser),
    total,
    page,
    totalPages: Math.max(Math.ceil(total / perPage), 1),
  });
});

export const updateUserRole = asyncHandler(async (req, res) => {
  const id = toObjectId(req.params.id);
  if (!id) throw notFound('User not found');

  const role = readEnum(req.body?.role, 'role', ROLES, { required: true });
  if (role === null) throw badRequest('role is required');

  const user = await collections.users().findOne({ _id: id });
  if (!user) throw notFound('User not found');

  if (user._id.toString() === req.user.id || user.email === req.user.email) {
    throw forbidden('You cannot change your own role');
  }

  const result = await collections.users().findOneAndUpdate(
    { _id: id },
    { $set: { role } },
    { returnDocument: 'after' },
  );

  res.json({
    success: true,
    data: publicUser(result?.value ?? result),
    message: `${user.name} is now a ${role}`,
  });
});

export const listAllServices = asyncHandler(async (req, res) => {
  const filter = {};
  const approvalStatus = readEnum(
    req.query.approvalStatus,
    'approvalStatus',
    APPROVAL_STATUSES,
  );
  if (approvalStatus) filter.approvalStatus = approvalStatus;

  if (typeof req.query.search === 'string' && req.query.search.trim()) {
    const regex = new RegExp(escapeRegex(req.query.search.trim()), 'i');
    filter.$or = [{ title: regex }, { technicianEmail: regex }];
  }

  const data = await collections.services().find(filter).sort({ createdAt: -1 }).toArray();

  res.json({
    success: true,
    data: data.map((service) => ({ ...service, _id: objectIdString(service._id) })),
  });
});

export const updateServiceApproval = asyncHandler(async (req, res) => {
  const id = toObjectId(req.params.id);
  if (!id) throw notFound('Service not found');

  const approvalStatus = readEnum(
    req.body?.approvalStatus,
    'approvalStatus',
    APPROVAL_STATUSES,
    { required: true },
  );

  const service = await collections.services().findOne({ _id: id });
  if (!service) throw notFound('Service not found');

  const result = await collections.services().findOneAndUpdate(
    { _id: id },
    { $set: { approvalStatus } },
    { returnDocument: 'after' },
  );

  const updated = result?.value ?? result;

  res.json({
    success: true,
    data: { ...updated, _id: objectIdString(updated._id) },
    message: `Service ${approvalStatus}`,
  });
});

export const listAllBookings = asyncHandler(async (req, res) => {
  const filter = {};
  const status = readEnum(req.query.status, 'status', BOOKING_STATUSES);
  if (status) filter.status = status;

  const data = await collections.bookings().find(filter).sort({ createdAt: -1 }).toArray();

  res.json({
    success: true,
    data: data.map((booking) => ({
      ...booking,
      _id: objectIdString(booking._id),
      serviceId: objectIdString(booking.serviceId),
    })),
  });
});

export const listAllPayments = asyncHandler(async (req, res) => {
  const data = await collections.payments().find({}).sort({ paidAt: -1 }).toArray();

  res.json({
    success: true,
    data: data.map((payment) => ({ ...payment, _id: objectIdString(payment._id) })),
  });
});

export const getAdminStats = asyncHandler(async (req, res) => {
  const users = collections.users();
  const services = collections.services();
  const bookings = collections.bookings();
  const payments = collections.payments();

  const [usersByRole, servicesByApproval, servicesByCategory, bookingsByStatus, revenue] =
    await Promise.all([
      users.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]).toArray(),
      services.aggregate([{ $group: { _id: '$approvalStatus', count: { $sum: 1 } } }]).toArray(),
      services.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }]).toArray(),
      bookings.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]).toArray(),
      payments
        .aggregate([
          {
            $group: {
              _id: null,
              total: { $sum: '$amount' },
              count: { $sum: 1 },
            },
          },
        ])
        .toArray(),
    ]);

  const monthlyRevenue = await payments
    .aggregate([
      { $match: { paidAt: { $type: 'date' } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$paidAt' } },
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      { $limit: 12 },
    ])
    .toArray();

  const recentBookings = await bookings.find({}).sort({ createdAt: -1 }).limit(5).toArray();

  res.json({
    success: true,
    data: {
      users: {
        total: usersByRole.reduce((sum, row) => sum + row.count, 0),
        byRole: Object.fromEntries(usersByRole.map((row) => [row._id, row.count])),
      },
      services: {
        total: servicesByApproval.reduce((sum, row) => sum + row.count, 0),
        byApproval: Object.fromEntries(servicesByApproval.map((row) => [row._id, row.count])),
        byCategory: Object.fromEntries(servicesByCategory.map((row) => [row._id, row.count])),
      },
      bookings: {
        total: bookingsByStatus.reduce((sum, row) => sum + row.count, 0),
        byStatus: Object.fromEntries(bookingsByStatus.map((row) => [row._id, row.count])),
      },
      revenue: {
        total: revenue[0]?.total || 0,
        payments: revenue[0]?.count || 0,
        monthly: monthlyRevenue.map((row) => ({ month: row._id, total: row.total, count: row.count })),
      },
      recentBookings: recentBookings.map((booking) => ({
        ...booking,
        _id: objectIdString(booking._id),
      })),
    },
  });
});
