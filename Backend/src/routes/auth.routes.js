import express from "express";
import { authLoginController, authRegisterController, authVerifyEmailController, authGoogleCallbackController, authCreatePassword, authLogoutController, authResendOtpController, authForgetPasswordController, authResetPasswordController, authVerifyOtpController, authGetMeController, authUpdateProfileController } from "../controllers/auth.controller.js";
import { validateLogin, validateRegister } from "../validators/auth.validator.js";
import passport from '../config/passport.js';
import { identifyUser } from "../middlewares/auth.middleware.js";


const authRouter = express.Router();



authRouter.post("/register" ,validateRegister, authRegisterController);
authRouter.post("/login" , validateLogin , authLoginController);
authRouter.get("/verify-email/:token", authVerifyEmailController);
authRouter.get('/google',
  passport.authenticate('google', { scope: ['profile', 'email'], session: false })
);
authRouter.get('/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: 'http://localhost:5173/failed' }),
    authGoogleCallbackController
);
authRouter.post("/setPassword"  , authCreatePassword);
authRouter.post("/logout"  , authLogoutController);
authRouter.post("/resend-otp" , authResendOtpController);
authRouter.post("/Forget-password" , authForgetPasswordController);
authRouter.post("/reset-password" , authResetPasswordController);
authRouter.post("/verify-otp" , authVerifyOtpController);
authRouter.get("/Get-Me", identifyUser , authGetMeController);
authRouter.put("/profile", identifyUser, authUpdateProfileController);


export default authRouter;