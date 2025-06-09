import { Router } from 'express';
import AuthController from '../controllers/authController';
import { authenticateJWT } from '../authenticate';

const router = Router();

router.post('/signUp', AuthController.signUp);

router.post('/verifyOtp', AuthController.verifyOtp)

router.post('/login', AuthController.login);

router.post('/resendOtp', AuthController.resendOtp);

router.get('/getAllUserDetails', AuthController.getAllUserDetails);

router.get('/getUserDataById', AuthController.getUserDataById);

router.post('/updateUserStatus', AuthController.updateUSerStatus);

router.post('/updateStaticId', AuthController.updateStaticId);

router.get('/getUserDataByUserName', authenticateJWT,  AuthController.getUserDataByUserName);

router.post('/updateUserProfileByUserName',  AuthController.updateUserProfileByUserName);

export default router;
