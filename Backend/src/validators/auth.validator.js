import { body, validationResult } from "express-validator";

const PASSWORD_MIN = 6;
const PASSWORD_MAX = 128;

export const validateRegister = [
  body("username")
    .exists({ checkFalsy: true })
    .withMessage("Username is required")
    .bail()
    .isString()
    .withMessage("Username must be text")
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage("Username must be between 3 and 30 characters")
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage(
      "Username may contain only letters, numbers, underscores, and hyphens",
    )
    .customSanitizer((value) => value.toLowerCase()),

  body("email")
    .exists({ checkFalsy: true })
    .withMessage("Email is required")
    .bail()
    .isEmail()
    .withMessage("Invalid email address")
    .normalizeEmail({ gmail_remove_dots: false })
    .isLength({ max: 254 })
    .withMessage("Email must not exceed 254 characters"),

  body("password")
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .withMessage("Password must be text")
    .isLength({ min: PASSWORD_MIN, max: PASSWORD_MAX })
    .withMessage(
      `Password must be between ${PASSWORD_MIN} and ${PASSWORD_MAX} characters long`,
    )
    .matches(/[a-z]/)
    .withMessage("Password must contain at least one lowercase letter")
    .matches(/[A-Z]/)
    .withMessage("Password must contain at least one uppercase letter")
    .matches(/[0-9]/)
    .withMessage("Password must contain at least one number")
    .matches(/[^A-Za-z0-9]/)
    .withMessage("Password must contain at least one special character")
    .custom((value, { req }) => {
      if (/\s/.test(value)) {
        throw new Error("Password must not contain spaces");
      }

      const username = req.body.username?.toString().toLowerCase();
      const email = req.body.email?.toString().toLowerCase();
      const lowerValue = value.toLowerCase();

      if (username && lowerValue.includes(username)) {
        throw new Error("Password must not contain the username");
      }

      if (email && lowerValue.includes(email)) {
        throw new Error("Password must not contain the email address");
      }

      const disallowedPatterns = [
        "password",
        "123456",
        "qwerty",
        "letmein",
        "admin",
      ];
      if (disallowedPatterns.some((pattern) => lowerValue.includes(pattern))) {
        throw new Error("Password is too weak");
      }

      return true;
    }),

  body("confirmPassword")
    .optional({ nullable: true, checkFalsy: true })
    .custom((value, { req }) => {
      if (req.body.password && value !== req.body.password) {
        throw new Error("Passwords do not match");
      }
      return true;
    }),

  validateRequest,
];

export const validateLogin = [
  body("email")
    .exists({ checkFalsy: true })
    .withMessage("Email is required")
    .bail()
    .isEmail()
    .withMessage("Invalid email address")
    .normalizeEmail({ gmail_remove_dots: false }),

  body("password")
    .exists({ checkFalsy: true })
    .withMessage("Password is required"),

  validateRequest,
];

export function validateRequest(req, res, next) {
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    return next();
  }

  return res.status(400).json({
    status: "error",
    message: "Validation failed",
    errors: errors
      .array()
      .map((err) => ({ field: err.param, message: err.msg })),
  });
}
