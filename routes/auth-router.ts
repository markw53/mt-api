import {
  Router,
  Request,
  Response,
  NextFunction,
  RequestHandler,
} from "express";
import { body, validationResult } from "express-validator";
import * as authController from "../controllers/auth-controller";
const authRouter = Router();

// Validation middleware
const validateRequest: RequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map((error) => {
      if (error.type === "field") {
        return {
          field: error.path,
          message: error.msg,
        };
      }
      return {
        message: error.msg,
      };
    });

    res.status(400).json({
      status: "error",
      errors: formattedErrors,
    });
    return;
  }
  next();
};

// Register validation
const registerValidation = [
  body("username")
    .trim()
    .notEmpty()
    .withMessage("Username is required")
    .isLength({ min: 3, max: 30 })
    .withMessage("Username must be between 3 and 30 characters"),

  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Must be a valid email address"),

  body("password")
    .trim()
    .notEmpty()
    .withMessage("Password is required")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters"),

  // Optional fields for event organiser registration
  body("isEventOrganiser")
    .optional()
    .isBoolean()
    .withMessage("isEventOrganiser must be a boolean"),

  body("teamName")
    .optional()
    .custom((value, { req }) => {
      // Only require teamName if isEventOrganiser is true
      if (
        req.body.isEventOrganiser === true &&
        (!value || value.trim() === "")
      ) {
        throw new Error(
          "Team name is required when registering as an event organiser"
        );
      }
      return true;
    })
    // Only apply length validation if a non-empty value is provided
    .if((value) => value !== undefined && value !== null && value.trim() !== "")
    .isLength({ min: 3, max: 100 })
    .withMessage("Team name must be between 3 and 100 characters"),

  body("teamDescription").optional(),
];

// Login validation
const loginValidation = [
  body("username").trim().notEmpty().withMessage("Username is required"),

  body("password").trim().notEmpty().withMessage("Password is required"),
];

// Refresh token validation
const refreshTokenValidation = [
  body("refreshToken")
    .trim()
    .notEmpty()
    .withMessage("Refresh token is required"),
];

// Logout validation
const logoutValidation = [
  body("refreshToken")
    .trim()
    .notEmpty()
    .withMessage("Refresh token is required"),
];

// Type assertion for controller functions to ensure they match Express RequestHandler
const register = authController.register as RequestHandler;
const login = authController.login as RequestHandler;
const refreshTokenHandler = authController.refreshToken as RequestHandler;
const logout = authController.logout as RequestHandler;

// Auth routes
authRouter.post("/register", registerValidation, validateRequest, register);
authRouter.post("/login", loginValidation, validateRequest, login);
authRouter.post(
  "/refresh-token",
  refreshTokenValidation,
  validateRequest,
  refreshTokenHandler
);
authRouter.post("/logout", logoutValidation, validateRequest, logout);

export default authRouter;