import nodemailer from "nodemailer";
import { config } from "../config/config.js";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: config.MAIL_USER,
    pass: config.MAIL_PASS,
  },
});

transporter
  .verify()
  .then(() => {
    console.log("✉️  Email transporter ready.");
  })
  .catch((err) => {
    console.error("✉️  Email transporter verification failed:", err.message);
  });

export async function sendEmail({ to, subject, html, text }) {
  const mailInfo = await transporter.sendMail({
    from: `"YourCrawl" <${config.MAIL_USER}>`,
    to,
    subject,
    html,
    text,
  });
  console.log(`✉️  Email sent → ${to} [${mailInfo.messageId}]`);
  return mailInfo;
}
