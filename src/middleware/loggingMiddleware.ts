import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils';

export const loggingMiddleware = (req: Request, res: Response, next: NextFunction) => {
  logger.info(`${req.ip} ${req.headers['user-agent']} ${req.method} ${req.url}`);
  next();
};
