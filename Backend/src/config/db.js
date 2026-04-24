import mongoose from "mongoose";
import { config } from "./config.js";

// Triggering nodemon restart to load new .env
export const connectToDb =async ()=>{
    await mongoose.connect(config.MONGO_URI);
    console.log("Connected to MongoDB");
}