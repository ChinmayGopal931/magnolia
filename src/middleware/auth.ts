import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { logger } from '../utils/logger';

/**
 * Middleware to authenticate JWT tokens
 */
export const authenticateJWT = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: 'Authorization header is required' });
  }

  const token = authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Bearer token is required' });
  }

  try {
    const jwtSecret = config.jwt.secret || 'magnolia-dev-secret';
    const decoded = jwt.verify(token, jwtSecret);
    // @ts-ignore - add user data to request
    req.user = decoded;
    next();
  } catch (error) {
    logger.error('JWT verification failed:', error);
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};
