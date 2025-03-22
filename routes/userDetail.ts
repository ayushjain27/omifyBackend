import { Router } from 'express';
import UserDetailController from '../controllers/userDetailControllr';

const router = Router();

router.get('/getAllPaymentUserDetails', UserDetailController.getAllPaymentUserDetails);

export default router;
