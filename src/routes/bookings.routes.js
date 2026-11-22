import { Router } from 'express';
import {
  cancelBooking,
  createBooking,
  getCustomerStats,
  getMyBookings,
  getTechnicianBookings,
  submitReview,
  updateBookingStatus,
} from '../controllers/bookings.controller.js';
import { verifyToken } from '../middlewares/verifyToken.js';
import { verifyCustomer, verifyTechnician } from '../middlewares/verifyRole.js';

const router = Router();

router.post('/', verifyToken, verifyCustomer, createBooking);
router.get('/my', verifyToken, verifyCustomer, getMyBookings);
router.get('/stats', verifyToken, verifyCustomer, getCustomerStats);
router.get('/technician', verifyToken, verifyTechnician, getTechnicianBookings);

router.patch('/:id/cancel', verifyToken, verifyCustomer, cancelBooking);
router.post('/:id/review', verifyToken, verifyCustomer, submitReview);
router.patch('/:id/status', verifyToken, verifyTechnician, updateBookingStatus);

export default router;
