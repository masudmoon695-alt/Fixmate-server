import { Router } from 'express';
import {
  createCheckoutSession,
  getPaymentStats,
  listMyPayments,
  verifyPayment,
} from '../controllers/payments.controller.js';
import { verifyToken } from '../middlewares/verifyToken.js';
import { verifyCustomer } from '../middlewares/verifyRole.js';

/**
 * POST /api/payments/webhook is mounted directly in app.js before
 * express.json() because signature verification needs the raw body.
 */
const router = Router();

router.post('/create-checkout-session', verifyToken, verifyCustomer, createCheckoutSession);
router.get('/verify', verifyToken, verifyCustomer, verifyPayment);
router.get('/my', verifyToken, verifyCustomer, listMyPayments);
router.get('/stats', verifyToken, verifyCustomer, getPaymentStats);

export default router;
