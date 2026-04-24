import jwt from "jsonwebtoken";

export const identifyUser = async (req, res, next) => {
  const token = req.cookies.token;
  if (!token) {
    const err = new Error("token is required");
    err.statusCode = 401;
    return next(err);
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = decoded;
    console.log(req.user);
    
    next();
  } catch (error) {
    const err = new Error("Unauthorized");
    err.statusCode = 401;
    return next(err);
  }
};
