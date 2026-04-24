import dotenv from 'dotenv';

dotenv.config();

if(!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is required in environment variables');
}

if(!process.env.COHERE_API_KEY) {
    throw new Error('COHERE_API_KEY is required in environment variables');
}

if(!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is required in environment variables');
}

if(!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is required in environment variables');
}

export const config = {
    PORT: process.env.PORT || 3000,
    MONGO_URI: process.env.MONGO_URI,
    JWT_SECRET: process.env.JWT_SECRET,
    NODE_ENV: process.env.NODE_ENV || 'development',

    // AI
    geminiApiKey: process.env.GEMINI_API_KEY,
    cohereApiKey: process.env.COHERE_API_KEY,

    // Mail (Nodemailer — Gmail)
    MAIL_USER: process.env.GOOGLE_USER,
    MAIL_PASS: process.env.GOOGLE_APP_PASSWORD,

    // Google OAuth
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
}