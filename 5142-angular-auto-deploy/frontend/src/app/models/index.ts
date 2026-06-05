export type UserRole = 'submitter' | 'approver' | 'admin';

export interface User {
  id: string;
  username: string;
  role: UserRole;
  active: boolean;
  createdAt: string;
}

export type BuildStatus = 'queued' | 'building' | 'success' | 'failed';

export interface BuildTask {
  id: string;
  name: string;
  repository: string;
  branch: string;
  environment?: string;
  parameters?: Record<string, string>;
  config?: string;
  status: BuildStatus;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface BuildLog {
  id: string;
  buildId: string;
  content: string;
  level: string;
  timestamp: string;
}

export type DeployStatus =
  | 'pending_approval'
  | 'approving'
  | 'approved'
  | 'rejected'
  | 'queued'
  | 'deploying'
  | 'success'
  | 'failed'
  | 'waiting_prerequisite';

export type ApprovalNodeStatus = 'pending' | 'approved' | 'rejected';

export interface ApprovalNode {
  id: string;
  deployRequestId: string;
  approverId: string;
  order: number;
  status: ApprovalNodeStatus;
  comment?: string;
  processedAt?: string;
}

export interface DeployRequest {
  id: string;
  title: string;
  description?: string;
  buildTaskId: string;
  environmentId: string;
  userId: string;
  status: DeployStatus;
  approvalNodes?: ApprovalNode[];
  createdAt: string;
  updatedAt: string;
}

export type EnvironmentType = 'testing' | 'staging' | 'production';

export interface Environment {
  id: string;
  name: string;
  type: EnvironmentType;
  description?: string;
  serverHost?: string;
  deployPath?: string;
  credentials?: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export type RollbackStatus =
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'rolling_back'
  | 'success'
  | 'failed';

export interface RollbackRequest {
  id: string;
  reason: string;
  targetVersion: string;
  status: RollbackStatus;
  originalDeployId: string;
  targetEnvironmentId: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export type QueueItemStatus =
  | 'queued'
  | 'executing'
  | 'completed'
  | 'failed'
  | 'waiting_prerequisite';

export interface QueueItem {
  id: string;
  deployRequestId: string;
  environmentId: string;
  position: number;
  priority: number;
  status: QueueItemStatus;
  dependencyIds: string;
  retryCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface DependencyEdge {
  from: string;
  to: string;
}

export interface DependencyGraphNode {
  id: string;
  deployRequestId: string;
  status: string;
}

export interface DependencyGraph {
  nodes: DependencyGraphNode[];
  edges: DependencyEdge[];
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  message: string;
  user: User;
}

export interface ReorderQueueRequest {
  items: { id: string; position: number }[];
}
