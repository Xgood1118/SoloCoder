import { v4 as uuidv4 } from 'uuid';
import { getDb, persist } from '../db';

export function logOperation(
  operatorId: string,
  operatorName: string,
  action: string,
  targetType: string,
  targetId: string,
  details?: string,
  ipAddress?: string
) {
  const db = getDb();
  db.operation_logs.unshift({
    id: uuidv4(),
    operator_id: operatorId,
    operator_name: operatorName,
    action,
    target_type: targetType,
    target_id: targetId,
    details,
    ip_address: ipAddress,
    created_at: new Date().toISOString()
  });
  persist();
}

export function getOperationLogs(targetType?: string, targetId?: string, limit: number = 100) {
  const db = getDb();
  let logs = db.operation_logs;
  
  if (targetType) {
    logs = logs.filter(l => l.target_type === targetType);
  }
  if (targetId) {
    logs = logs.filter(l => l.target_id === targetId);
  }
  
  return logs.slice(0, limit);
}
