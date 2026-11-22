import { Router } from 'express';
import {
  createService,
  deleteService,
  getPublicService,
  getTechnicianStats,
  listMyServices,
  listPublicServices,
  toggleAvailability,
  updateService,
} from '../controllers/services.controller.js';
import { verifyToken } from '../middlewares/verifyToken.js';
import { verifyTechnician } from '../middlewares/verifyRole.js';

const router = Router();

// Technician-only routes MUST stay above "/:id" so they are not read as ids.
router.get('/stats', verifyToken, verifyTechnician, getTechnicianStats);
router.get('/my', verifyToken, verifyTechnician, listMyServices);

router.get('/', listPublicServices);
router.post('/', verifyToken, verifyTechnician, createService);
router.get('/:id', getPublicService);

router.patch('/:id', verifyToken, verifyTechnician, updateService);
router.delete('/:id', verifyToken, verifyTechnician, deleteService);
router.patch('/:id/availability', verifyToken, verifyTechnician, toggleAvailability);

export default router;
