import { Router } from 'express';
import AuthController from '../controllers/authController';

const router = Router();

router.post('/signUp', AuthController.signUp);

router.post('/verifyOtp', AuthController.verifyOtp)

router.post('/login', AuthController.login);

router.post('/resendOtp', AuthController.resendOtp);

router.get('/getAllUserDetails', AuthController.getAllUserDetails);

router.get('/getUserDataById', AuthController.getUserDataById);

router.post('/updateUserStatus', AuthController.updateUSerStatus);

export default router;
