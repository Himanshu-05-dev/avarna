import userModel from "../models/user.model.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { sendEmail } from "../services/mail.service.js";
import { verifyEmailTemplate, otpVerifyTemplate, resetPasswordTemplate } from "../services/mail.templates.js";
import otpModel from "../models/otp.model.js";
import blacklistModel from "../models/blacklist.model.js";
import { config } from "../config/config.js";

export const authRegisterController = async (req, res, next) => {
  try {
    const { username, email, password } = req.body;

    const userAlreadyExists = await userModel.findOne({
      $or: [{ email: email }, { username: username }],
    });
    console.log(userAlreadyExists);

    if (userAlreadyExists) {
      return res.status(400).json({
        message: "User with the given email or username already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await userModel.create({
      username,
      email,
      password: hashedPassword,
    });

    const emailVerificationToken = jwt.sign(
      {
        userId: newUser._id,
        email: newUser.email,
      },
      config.JWT_SECRET,
      { expiresIn: "1d" },
    );

    const verificationLink = `http://localhost:3000/api/auth/verify-email/${emailVerificationToken}`;

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await otpModel.deleteMany({ email: newUser.email, type: 'email_verification' });
    await otpModel.create({ email: newUser.email, otp, type: 'email_verification' });

    await sendEmail({
      to: newUser.email,
      subject: "YourCrawl — Verify your email",
      text: `Welcome to YourCrawl, ${newUser.username}!\n\nYour verification code is: ${otp} (Expires in 5 minutes).\n\nVerify your email via link: ${verificationLink}\nLink expires in 24 hours.`,
      html: verifyEmailTemplate({ username: newUser.username, verificationLink, otp }),
    });

    res.status(201).json({
      message:
        "user registered successfully, please verify your email to activate your account",
      user: {
        id: newUser._id,
        username: newUser.username,
        email: newUser.email,
      },
    });
  } catch (err) {
    console.log(err);
    err.statusCode = err.statusCode || 500;
    err.message = err.message || "Something went wrong while registering.";
    return next(err);
  }
};

export const authVerifyEmailController = async (req, res, next) => {
  try {
    const { token } = req.params;

    const decoded = jwt.verify(token, config.JWT_SECRET);
    const userId = decoded.userId;

    const user = await userModel.findById(userId);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    if (user.verified) {
      return res.status(400).json({
        message: "Email is already verified",
      });
    }

    user.verified = true;
    await user.save();

    res.status(200).json({
      message:
        "Email verified successfully, you can now log in to your account",
    });
  } catch (err) {
    console.log(err);
    err.statusCode = err.statusCode || 500;
    err.message = err.message || "Something went wrong while verifying email.";
    return next(err);
  }
};

export const authLoginController = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await userModel.findOne({ email }).select("+password");

    if (!user) {
      return res.status(409).json({
        message: "user does not exist with this email...",
      });
    }
    if (!user.verified) {
      return res.status(403).json({
        message: "Please verify your email before logging in.",
      });
    }
    if(!user.password){
      res.status(403).json({
        message :"user have not created the password yet login with google or create one...",
        id : user._id,
        email : user.email,
      })
    }

    const checkPassword = await bcrypt.compare(password, user.password);

    if (!checkPassword) {
      return res.status(409).json({
        message: "You have entered the wrong password...",
      });
    }

    const token = jwt.sign(
      {
        id: user._id,
        email: user.email,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" },
    );

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days (matches JWT expiry)
    });

    return res.status(201).json({
      message: "user login successfully...",
    });
  } catch (err) {
    console.log(err);
    err.statusCode = err.statusCode || 500;
    err.message = err.message || "Something went wrong while logging in.";
    return next(err);
  }
};

export const authCreatePassword = async (req , res, next)=>{
  const {email , password , confirmPass} = req.body;
  if(!email || !password || !confirmPass){
    return res.status(409).json({
      message : "All fields are required..."
    })
  }

  const user = await userModel.findOne({email : email}).select("+password");
  if(!user){
    return res.status(409).json({
      message : "user does not exist..."
    })
  }
  if(user.password){
    return res.status(409).json({
      message : "user have already created the password..."
    })
  }
  
  if(password != confirmPass){
    return res.status(409).json({
      message : "pass and conPass should be same..."
    })
  }

  const isSamePassword = await bcrypt.compare(password, user.password);
  if (isSamePassword) {
    return res.status(400).json({
      message: "New password cannot be the same as the old password.",
    });
  }
  
  const hashedPassword = await bcrypt.hash(password, 10);
  user.password = hashedPassword;
  user.save();

  return res.status(200).json({
    message : "password created successfully you can login now...",
    user : {
      id : user._id,
      email : user.email,
    }
  })

};

export const authGoogleCallbackController = async (req, res, next) => {

  try {
    const user = req.user;

    if (!user) {
      return res.status(409).json({
        message: "There is the issue in signing in..."
      })
    }

    const email = user.emails[0].value;
    const verified = user.emails[0].verified;
    const Google_id = user.id;
    const username = user.displayName;

    const alreadyUser = await userModel.findOne({ email });

    if (!alreadyUser) {
      const newUser = await userModel.create({
        username: username,
        email: email,
        googleId: Google_id,
        verified: verified,
      })

      const token = jwt.sign({
        id : newUser._id,
        email : newUser.email,
      }, process.env.JWT_SECRET, { expiresIn: "7d" });

      res.cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 24 * 60 * 60 * 1000, // 1 day
      });

      return res.redirect("http://localhost:5173/set-password");

    }

    if(!alreadyUser.googleId){
      alreadyUser.googleId = Google_id;
      alreadyUser.verified = true;
      await alreadyUser.save();
    }


    const token = jwt.sign({
      id : alreadyUser._id,
      email : alreadyUser.email,
    }, process.env.JWT_SECRET, { expiresIn: "7d" });

    
    res.cookie("token" , token , {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000*7, // 1 week
    })

    return res.redirect("http://localhost:5173/dashboard");

  } catch (err) {
    console.log(err);
    err.statusCode = err.statusCode || 500;
    err.message = err.message || "Something went wrong while logging in.";
    return next(err);
  }
};

export async function authGetMeController(req, res, next) {
  try {
    const user = await userModel.findById(req.user.id).select("-password");
    if (!user) {
      const err = new Error("User not found.");
      err.statusCode = 404;
      return next(err);
    }
    return res.status(200).json({ user });
  } catch (err) {
    console.error(err);
    err.statusCode = err.statusCode || 500;
    err.message =
      err.message || "Something went wrong while fetching user data.";
    return next(err);
  }
}

export async function authVerifyOtpController(req, res, next) {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      const err = new Error("Email and OTP are required.");
      err.statusCode = 400;
      return next(err);
    }

    const storedOtpDoc = await otpModel.findOne({ email, type: 'email_verification' });
    const storedOtp = storedOtpDoc ? storedOtpDoc.otp : null;

    if (!storedOtp) {
      const err = new Error(
        "OTP expired or not found. Please request a new one.",
      );
      err.statusCode = 400;
      return next(err);
    }

    if (storedOtp != otp) {
      const err = new Error("Invalid OTP. Please try again.");
      err.statusCode = 401;
      return next(err);
    }

    // OTP is valid, mark user as verified
    const user = await userModel.findOne({ email });
    if (!user) {
      const err = new Error("User not found.");
      err.statusCode = 404;
      return next(err);
    }

    user.verified = true;
    await user.save();
    await otpModel.deleteMany({ email, type: 'email_verification' });

    return res.status(200).json({ message: "Email verified successfully." });
  } catch (err) {
    console.error(err);
    err.statusCode = err.statusCode || 500;
    err.message =
      err.message || "Something went wrong during OTP verification.";
    return next(err);
  }
}

export async function authLogoutController(req, res, next) {
  try {
    const token = req.cookies.token;
    if (!token) {
      const err = new Error("No active session found.");
      err.statusCode = 400;
      return next(err);
    }
    await blacklistModel.create({ token });

    res.clearCookie("token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });
    return res.status(200).json({ message: "Logout successful." });
  } catch (err) {
    console.error(err);
    err.statusCode = err.statusCode || 500;
    err.message = err.message || "Something went wrong while logging out.";
    return next(err);
  }
}

export async function authResendOtpController(req, res, next) {
  try {
    // ── 1. Validate body ───────────────────────────────────────────────────
    if (!req.body) {
      const err = new Error("Request body is missing.");
      err.statusCode = 400;
      return next(err);
    }

    const { email } = req.body;

    if (!email) {
      const err = new Error("Email is required.");
      err.statusCode = 400;
      return next(err);
    }
    // ── 2. Find user ───────────────────────────────────────────────────────
    const user = await userModel.findOne({ email });
    if (!user) {
      const err = new Error("No account found with this email address.");
      err.statusCode = 404;
      return next(err);
    }

    if (user.verified) {
      const err = new Error("This email is already verified. You can sign in.");
      err.statusCode = 400;
      return next(err);
    }

    // ── 3. Rate limiting — max 3 resends per 10 minutes ───────────────────
    const recentOtps = await otpModel.countDocuments({ email, type: 'email_verification' });

    if (recentOtps >= 3) {
      const err = new Error(
        "Too many OTP requests. Please wait 10 minutes before trying again.",
      );
      err.statusCode = 429;
      return next(err);
    }

    // ── 4. Delete old OTP and generate new one ─────────────────────────────
    await otpModel.deleteMany({ email, type: 'email_verification' });
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await otpModel.create({ email, otp, type: 'email_verification' });

    // ── 5. Send branded email ──────────────────────────────────────────────
    await sendEmail({
      to: email,
      subject: "YourCrawl — Verification Code",
      text: `YourCrawl verification code: ${otp}\nExpires in 5 minutes.`,
      html: otpVerifyTemplate({ otp }),
    });

    return res.status(200).json({
      message: "New verification code sent to your email.",
      expiresIn: 300, // seconds
    });
  } catch (err) {
    console.error("Resend OTP error:", err);
    err.statusCode = err.statusCode || 500;
    err.message =
      err.message || "Something went wrong while resending the code.";
    return next(err);
  }
}

export async function authForgetPasswordController(req, res, next) {
  try {
    const { email } = req.body;

    if (!email) {
      const err = new Error("Email is required.");
      err.statusCode = 400;
      return next(err);
    }

    const user = await userModel.findOne({ email });
    if (!user) {
      const err = new Error("No account found with this email address.");
      err.statusCode = 404;
      return next(err);
    }

    if (user.verified === false) {
      const err = new Error(
        "Email not verified. Please verify your email before resetting password.",
      );
      err.statusCode = 403;
      return next(err);
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await otpModel.deleteMany({ email, type: 'password_reset' });
    await otpModel.create({ email, otp, type: 'password_reset' });

    const resetUrl = `http://localhost:5173/forgot-password?email=${encodeURIComponent(email)}&otp=${otp}`;

    await sendEmail({
      to: email,
      subject: "YourCrawl — Password Reset",
      text: `YourCrawl password reset code: ${otp}\nExpires in 5 minutes.\nReset link: ${resetUrl}`,
      html: resetPasswordTemplate({ otp, resetUrl }),
    });

    return res.status(200).json({
      message: "Password reset OTP sent to your email successfully.",
      email,
    });
  } catch (err) {
    console.error(err);
    err.statusCode = err.statusCode || 500;
    err.message =
      err.message || "Something went wrong while sending reset code.";
    return next(err);
  }
}

export async function authResetPasswordController(req, res, next) {
  try {
    const { email, otp, password , confirmPass} = req.body;

    if (!email || !otp || !password || !confirmPass) {
      const err = new Error("Email, OTP and new password are required.");
      err.statusCode = 400;
      return next(err);
    }
    if(password != confirmPass){
      const err = new Error("Password and confirm password do not match.");
      err.statusCode = 400;
      return next(err);
    }

    const storedOtpDoc = await otpModel.findOne({ email, type: 'password_reset' });
    if (!storedOtpDoc || storedOtpDoc.otp != otp) {
      const err = new Error("Invalid or expired OTP.");
      err.statusCode = 400;
      return next(err);
    }
    const user = await userModel.findOne({ email }).select("+password");
    if (!user) {
      const err = new Error("No account found with this email address.");
      err.statusCode = 404;
      return next(err);
    }


    if(user.verified === false) {
      const err = new Error(
        "Email not verified. Please verify your email before resetting password.",
      );
      err.statusCode = 403;
      return next(err);
    }

    const isSamePassword = await bcrypt.compare(password, user.password);
    if (isSamePassword) {
      const err = new Error("New password cannot be the same as the old password.");
      err.statusCode = 400;
      return next(err);
    }

    user.password = await bcrypt.hash(password, 10);
    await user.save();
    
    await otpModel.deleteMany({ email, type: 'password_reset' });

    return res.status(200).json({
      message:
        "Password reset successfully. You can now log in with your new password.",
    });
  } catch (err) {
    console.error(err);
    err.statusCode = err.statusCode || 500;
    err.message = err.message || "Something went wrong while resetting password.";
    return next(err);
  }
}

export async function authUpdateProfileController(req, res, next) {
  try {
    const { username, mobileNo } = req.body;
    const user = await userModel.findById(req.user.id);
    if (!user) {
      const err = new Error("User not found.");
      err.statusCode = 404;
      return next(err);
    }
    
    if (username) user.username = username;
    if (mobileNo !== undefined) user.mobileNo = mobileNo;
    
    await user.save();
    return res.status(200).json({ message: "Profile updated successfully.", user });
  } catch (err) {
    console.error(err);
    err.statusCode = err.statusCode || 500;
    err.message = err.message || "Something went wrong while updating profile.";
    return next(err);
  }
}

