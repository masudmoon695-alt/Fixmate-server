import { Router } from 'express';
import { updateProfile } from '../controllers/users.controller.js';
import { verifyToken } from '../middlewares/verifyToken.js';

const router = Router();

router.patch('/profile', verifyToken, updateProfile);

export default router;
