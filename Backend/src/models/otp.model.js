import mongoose from "mongoose";

const otpSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
    },
    otp: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ["email_verification", "password_reset"],
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 300, // auto-delete after 5 minutes (TTL index)
    },
  }
);

const otpModel = mongoose.model("Otp", otpSchema);
export default otpModel;
