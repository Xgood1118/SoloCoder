import { type Request, type Response, type NextFunction } from 'express';

export function validateBody(requiredFields: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const missing = requiredFields.filter(field => req.body[field] === undefined || req.body[field] === '');
    if (missing.length > 0) {
      res.status(400).json({ error: `缺少必填字段: ${missing.join(', ')}` });
      return;
    }
    next();
  };
}

export function validateQuery(requiredFields: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const missing = requiredFields.filter(field => req.query[field] === undefined || req.query[field] === '');
    if (missing.length > 0) {
      res.status(400).json({ error: `缺少必填查询参数: ${missing.join(', ')}` });
      return;
    }
    next();
  };
}

export function validateEnum(field: string, allowedValues: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const value = req.body[field];
    if (value !== undefined && !allowedValues.includes(value)) {
      res.status(400).json({ error: `${field} 必须是以下值之一: ${allowedValues.join(', ')}` });
      return;
    }
    next();
  };
}
