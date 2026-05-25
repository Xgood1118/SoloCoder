export interface User {
  id: string;
  name: string;
  role: string;
  department: string;
}

export type ApprovalType = 'single' | 'countersign' | 'or_sign';

export type NodeType = 'start' | 'approval' | 'condition' | 'end';

export interface ConditionRule {
  field: string;
  operator: '>' | '<' | '>=' | '<=' | '==';
  value: number | string;
}

export interface FlowNode {
  id: string;
  type: NodeType;
  name: string;
  approvers?: User[];
  approvalType?: ApprovalType;
  conditions?: ConditionRule[];
  conditionNodeId?: string;
  isConditionBranch?: boolean;
  order: number;
}

export interface FlowEdge {
  id: string;
  from: string;
  to: string;
  condition?: ConditionRule;
}

export interface FlowTemplate {
  id: string;
  name: string;
  description: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  formFields: FormField[];
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface FormField {
  id: string;
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'select' | 'date';
  required: boolean;
  options?: string[];
  placeholder?: string;
}

export type ProcessStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'completed';

export type ApprovalAction = 'approve' | 'reject' | 'transfer';

export interface ApprovalRecord {
  id: string;
  nodeId: string;
  nodeName: string;
  approver: User;
  action: ApprovalAction | 'submit' | 'resubmit' | 'end';
  comment: string;
  createdAt: string;
  transferTo?: User;
}

export interface FlowInstance {
  id: string;
  templateId: string;
  templateName: string;
  status: ProcessStatus;
  formData: Record<string, any>;
  currentNodeId: string;
  approverQueue: User[];
  approvalHistory: ApprovalRecord[];
  currentApprovers: User[];
  approvalResults: Record<string, ApprovalRecord[]>;
  createdBy: User;
  createdAt: string;
  updatedAt: string;
  isDraft: boolean;
  rejectedFromNode?: string;
}
