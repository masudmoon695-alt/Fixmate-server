import { collections } from '../config/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { forbidden, unauthorized } from '../utils/AppError.js';
import { toObjectId } from '../utils/objectId.js';

/**
 * Loads the user from MongoDB using the verified token identity.
 * The role always comes from the database, never from the token or client.
 */
async function loadUser(req) {
  const users = collections.users();

  if (req.user?.email) {
    const user = await users.findOne({ email: req.user.email });
    if (user) return user;
  }

  const id = toObjectId(req.user?.id);
  if (id) {
    return users.findOne({ _id: id });
  }

  return null;
}

export const requireRole = (role) =>
  asyncHandler(async (req, res, next) => {
    const user = await loadUser(req);

    if (!user) {
      throw unauthorized('User account no longer exists');
    }

    if (user.role !== role) {
      throw forbidden(`This action requires the ${role} role`);
    }

    req.user = {
      id: user._id.toString(),
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      image: user.image || null,
      phone: user.phone || null,
      area: user.area || null,
      bio: user.bio || null,
    };

    next();
  });

export const verifyCustomer = requireRole('customer');
export const verifyTechnician = requireRole('technician');
export const verifyAdmin = requireRole('admin');
