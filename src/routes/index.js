import { Router } from 'express';
import adminRoutes from './admin.routes.js';
import bookingsRoutes from './bookings.routes.js';
import paymentsRoutes from './payments.routes.js';
import servicesRoutes from './services.routes.js';
import usersRoutes from './users.routes.js';

const router = Router();

router.use('/admin', adminRoutes);
router.use('/bookings', bookingsRoutes);
router.use('/payments', paymentsRoutes);
router.use('/services', servicesRoutes);
router.use('/users', usersRoutes);

export default router;
