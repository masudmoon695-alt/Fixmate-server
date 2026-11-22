import { collections } from '../config/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { badRequest, notFound } from '../utils/AppError.js';
import { objectIdString } from '../utils/objectId.js';
import { readString } from '../utils/validate.js';

export const updateProfile = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const updates = {};
  const has = (key) => Object.prototype.hasOwnProperty.call(body, key);

  if (has('name')) {
    updates.name = readString(body.name, 'Name', { required: true, min: 2, max: 80 });
  }
  if (has('phone')) {
    updates.phone = readString(body.phone, 'Phone', { max: 30 });
  }
  if (has('area')) {
    updates.area = readString(body.area, 'Area', { max: 120 });
  }
  if (has('bio')) {
    updates.bio = readString(body.bio, 'Bio', { max: 1000 });
  }
  if (has('image')) {
    updates.image = readString(body.image, 'Image URL', { max: 1000 });
  }
  if (has('role') || has('email') || has('approvalStatus') || has('paymentStatus')) {
    throw badRequest('role, email, approvalStatus and paymentStatus cannot be changed here');
  }

  if (Object.keys(updates).length === 0) {
    throw badRequest('No valid fields to update');
  }

  const users = collections.users();
  const result = await users.findOneAndUpdate(
    { email: req.user.email },
    { $set: updates },
    { returnDocument: 'after' },
  );

  const user = result?.value ?? result;
  if (!user) throw notFound('User not found');

  res.json({
    success: true,
    data: {
      _id: objectIdString(user._id),
      name: user.name,
      email: user.email,
      image: user.image || null,
      role: user.role || 'customer',
      phone: user.phone || '',
      area: user.area || '',
      bio: user.bio || '',
    },
    message: 'Profile updated',
  });
});
