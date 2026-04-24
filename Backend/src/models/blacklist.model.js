import mongoose from "mongoose";

const blacklistSchema = new mongoose.Schema(
  {
    token: {
      type: String,
      required: true,
      unique: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 60 * 60 * 24 * 7, // auto-delete after 7 days (matches token expiry)
    },
  }
);

const blacklistModel = mongoose.model("Blacklist", blacklistSchema);
export default blacklistModel;
