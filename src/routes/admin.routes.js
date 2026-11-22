import { Router } from 'express';
import {
  getAdminStats,
  listAllBookings,
  listAllPayments,
  listAllServices,
  listUsers,
  updateServiceApproval,
  updateUserRole,
} from '../controllers/admin.controller.js';
import { verifyToken } from '../middlewares/verifyToken.js';
import { verifyAdmin } from '../middlewares/verifyRole.js';

const router = Router();

router.use(verifyToken, verifyAdmin);

router.get('/users', listUsers);
router.patch('/users/:id/role', updateUserRole);

router.get('/services', listAllServices);
router.patch('/services/:id/approval', updateServiceApproval);

router.get('/bookings', listAllBookings);
router.get('/payments', listAllPayments);
router.get('/stats', getAdminStats);

export default router;
