export class AppError extends Error {
  constructor(message, statusCode = 500, errors = null) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${String(statusCode).startsWith("4") ? "fail" : "error"}`;
    this.isOperational = true;
    this.errors = errors;

    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const status = `${String(statusCode).startsWith("4") ? "fail" : "error"}`;

  const responseBody = {
    status,
    message: err.message || "Internal Server Error",
  };

  if (err.errors && Array.isArray(err.errors) && err.errors.length > 0) {
    responseBody.errors = err.errors;
  }

  if (err.name === "ValidationError" && err.errors) {
    responseBody.errors = Object.values(err.errors).map((fieldError) => ({
      field: fieldError.path || fieldError.param,
      message: fieldError.message,
    }));
  }

  if (err.name === "MongoServerError" && err.code === 11000) {
    responseBody.message = "Duplicate field value detected";
    responseBody.errors = Object.entries(err.keyValue).map(
      ([field, value]) => ({
        field,
        message: `${field} \"${value}\" already exists`,
      }),
    );
  }

  if (process.env.NODE_ENV === "development") {
    responseBody.stack = err.stack;
  }

  return res.status(statusCode).json(responseBody);
};
