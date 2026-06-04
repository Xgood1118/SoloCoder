import { Router, Request, Response } from 'express';
import { getDb } from '../db';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  const db = getDb();
  const { operator_id, action, target_type, page = 1, page_size = 50 } = req.query;
  
  let logs = [...db.operation_logs];

  if (operator_id) {
    logs = logs.filter(l => l.operator_id === operator_id);
  }
  if (action) {
    logs = logs.filter(l => l.action === action);
  }
  if (target_type) {
    logs = logs.filter(l => l.target_type === target_type);
  }

  const total = logs.length;
  const offset = (Number(page) - 1) * Number(page_size);
  const paginatedLogs = logs.slice(offset, offset + Number(page_size));

  res.json({
    data: paginatedLogs,
    total,
    page: Number(page),
    page_size: Number(page_size)
  });
});

export default router;
