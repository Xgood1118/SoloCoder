import { Injectable } from '@angular/core';
import { StorageService } from './storage.service';
import { TemplateService } from './template.service';
import { 
  FlowInstance, FlowTemplate, FlowNode, User, ApprovalRecord, 
  ApprovalAction, ProcessStatus, ConditionRule 
} from '../models/workflow.model';

@Injectable({
  providedIn: 'root'
})
export class ProcessService {

  constructor(
    private storage: StorageService,
    private templateService: TemplateService
  ) {}

  getAllInstances(): FlowInstance[] {
    return this.storage.getInstances().sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  getMyInstances(userId: string): FlowInstance[] {
    return this.getAllInstances().filter(i => i.createdBy.id === userId);
  }

  getMyPendingApprovals(userId: string): FlowInstance[] {
    return this.getAllInstances().filter(i => 
      i.status === 'pending' && 
      i.currentApprovers.some(a => a.id === userId)
    );
  }

  getMyCompletedApprovals(userId: string): FlowInstance[] {
    return this.getAllInstances().filter(i => 
      i.approvalHistory.some(h => h.approver.id === userId)
    );
  }

  getInstance(id: string): FlowInstance | undefined {
    return this.storage.getInstance(id);
  }

  createDraft(templateId: string, formData: Record<string, any>): FlowInstance {
    const template = this.templateService.getTemplate(templateId);
    if (!template) {
      throw new Error('Template not found');
    }

    const currentUser = this.storage.getCurrentUser();
    const now = new Date().toISOString();

    const instance: FlowInstance = {
      id: 'inst_' + this.storage.generateId(),
      templateId: template.id,
      templateName: template.name,
      status: 'draft',
      formData,
      currentNodeId: '',
      approverQueue: [],
      approvalHistory: [],
      currentApprovers: [],
      approvalResults: {},
      createdBy: currentUser,
      createdAt: now,
      updatedAt: now,
      isDraft: true
    };

    this.storage.saveInstance(instance);
    return instance;
  }

  submitInstance(instanceId: string, formData: Record<string, any>): FlowInstance {
    const instance = this.storage.getInstance(instanceId);
    if (!instance) {
      throw new Error('Instance not found');
    }

    const template = this.templateService.getTemplate(instance.templateId);
    if (!template) {
      throw new Error('Template not found');
    }

    const currentUser = this.storage.getCurrentUser();
    const now = new Date().toISOString();

    instance.formData = formData;
    instance.isDraft = false;
    instance.status = 'pending';
    instance.createdAt = now;
    instance.updatedAt = now;

    instance.approvalHistory.push({
      id: 'rec_' + this.storage.generateId(),
      nodeId: '',
      nodeName: '提交',
      approver: currentUser,
      action: 'submit',
      comment: formData._submitComment || '',
      createdAt: now
    });

    this.moveToNextNode(instance, template);
    this.storage.saveInstance(instance);
    return instance;
  }

  approve(instanceId: string, comment: string): FlowInstance {
    return this.processApproval(instanceId, 'approve', comment);
  }

  reject(instanceId: string, comment: string, returnToSubmitter: boolean = true): FlowInstance {
    const instance = this.storage.getInstance(instanceId);
    if (!instance) {
      throw new Error('Instance not found');
    }

    const template = this.templateService.getTemplate(instance.templateId);
    if (!template) {
      throw new Error('Template not found');
    }

    const currentUser = this.storage.getCurrentUser();
    const now = new Date().toISOString();

    const currentNode = template.nodes.find(n => n.id === instance.currentNodeId);
    instance.approvalHistory.push({
      id: 'rec_' + this.storage.generateId(),
      nodeId: instance.currentNodeId,
      nodeName: currentNode?.name || '',
      approver: currentUser,
      action: 'reject',
      comment,
      createdAt: now
    });

    if (returnToSubmitter) {
      instance.status = 'rejected';
      instance.rejectedFromNode = instance.currentNodeId;
      instance.currentApprovers = [];
    } else {
      instance.status = 'completed';
    }

    instance.updatedAt = now;
    this.storage.saveInstance(instance);
    return instance;
  }

  transfer(instanceId: string, targetUser: User, comment: string): FlowInstance {
    const instance = this.storage.getInstance(instanceId);
    if (!instance) {
      throw new Error('Instance not found');
    }

    const template = this.templateService.getTemplate(instance.templateId);
    if (!template) {
      throw new Error('Template not found');
    }

    const currentUser = this.storage.getCurrentUser();
    const now = new Date().toISOString();

    const currentNode = template.nodes.find(n => n.id === instance.currentNodeId);
    instance.approvalHistory.push({
      id: 'rec_' + this.storage.generateId(),
      nodeId: instance.currentNodeId,
      nodeName: currentNode?.name || '',
      approver: currentUser,
      action: 'transfer',
      comment,
      createdAt: now,
      transferTo: targetUser
    });

    instance.currentApprovers = instance.currentApprovers.filter(a => a.id !== currentUser.id);
    if (!instance.currentApprovers.some(a => a.id === targetUser.id)) {
      instance.currentApprovers.push(targetUser);
    }

    instance.updatedAt = now;
    this.storage.saveInstance(instance);
    return instance;
  }

  resubmit(instanceId: string, formData: Record<string, any>): FlowInstance {
    const instance = this.storage.getInstance(instanceId);
    if (!instance) {
      throw new Error('Instance not found');
    }

    const template = this.templateService.getTemplate(instance.templateId);
    if (!template) {
      throw new Error('Template not found');
    }

    const currentUser = this.storage.getCurrentUser();
    const now = new Date().toISOString();

    instance.formData = formData;
    instance.status = 'pending';
    instance.rejectedFromNode = undefined;
    instance.updatedAt = now;

    instance.approvalHistory.push({
      id: 'rec_' + this.storage.generateId(),
      nodeId: instance.rejectedFromNode || '',
      nodeName: '重新提交',
      approver: currentUser,
      action: 'resubmit',
      comment: formData._resubmitComment || '',
      createdAt: now
    });

    if (instance.rejectedFromNode) {
      instance.currentNodeId = instance.rejectedFromNode;
      const node = template.nodes.find(n => n.id === instance.currentNodeId);
      if (node && node.approvers) {
        instance.currentApprovers = [...node.approvers];
      }
    } else {
      this.moveToNextNode(instance, template);
    }

    this.storage.saveInstance(instance);
    return instance;
  }

  batchApprove(instanceIds: string[], comment: string): FlowInstance[] {
    return instanceIds.map(id => this.approve(id, comment));
  }

  private processApproval(instanceId: string, action: ApprovalAction, comment: string): FlowInstance {
    const instance = this.storage.getInstance(instanceId);
    if (!instance) {
      throw new Error('Instance not found');
    }

    const template = this.templateService.getTemplate(instance.templateId);
    if (!template) {
      throw new Error('Template not found');
    }

    const currentUser = this.storage.getCurrentUser();
    const now = new Date().toISOString();

    const currentNode = template.nodes.find(n => n.id === instance.currentNodeId);
    if (!currentNode) {
      throw new Error('Current node not found');
    }

    if (!instance.approvalResults[instance.currentNodeId]) {
      instance.approvalResults[instance.currentNodeId] = [];
    }

    instance.approvalResults[instance.currentNodeId].push({
      id: 'rec_' + this.storage.generateId(),
      nodeId: instance.currentNodeId,
      nodeName: currentNode.name,
      approver: currentUser,
      action,
      comment,
      createdAt: now
    });

    instance.approvalHistory.push({
      id: 'rec_' + this.storage.generateId(),
      nodeId: instance.currentNodeId,
      nodeName: currentNode.name,
      approver: currentUser,
      action,
      comment,
      createdAt: now
    });

    instance.updatedAt = now;

    if (this.shouldMoveToNextNode(instance, currentNode)) {
      this.moveToNextNode(instance, template);
    }

    this.storage.saveInstance(instance);
    return instance;
  }

  private shouldMoveToNextNode(instance: FlowInstance, node: FlowNode): boolean {
    if (!node.approvers || node.approvers.length === 0) {
      return true;
    }

    const results = instance.approvalResults[node.id] || [];
    const approvers = node.approvers;

    if (node.approvalType === 'single') {
      return results.some(r => r.action === 'approve');
    }

    if (node.approvalType === 'or_sign') {
      return results.some(r => r.action === 'approve');
    }

    if (node.approvalType === 'countersign') {
      return approvers.every(a => 
        results.some(r => r.approver.id === a.id && r.action === 'approve')
      );
    }

    return false;
  }

  private moveToNextNode(instance: FlowInstance, template: FlowTemplate): void {
    const sortedNodes = template.nodes
      .filter(n => n.type !== 'start')
      .sort((a, b) => a.order - b.order);

    let currentIndex = sortedNodes.findIndex(n => n.id === instance.currentNodeId);
    
    if (currentIndex === -1) {
      currentIndex = -1;
    }

    let foundNext = false;
    for (let i = currentIndex + 1; i < sortedNodes.length; i++) {
      const nextNode = sortedNodes[i];

      if (nextNode.type === 'end') {
        instance.status = 'completed';
        instance.currentApprovers = [];
        instance.currentNodeId = nextNode.id;
        const now = new Date().toISOString();
        instance.approvalHistory.push({
          id: 'rec_' + this.storage.generateId(),
          nodeId: nextNode.id,
          nodeName: '流程结束',
          approver: instance.createdBy,
          action: 'end',
          comment: '流程已完成',
          createdAt: now
        });
        foundNext = true;
        break;
      }

      if (nextNode.type === 'condition') {
        if (this.evaluateCondition(nextNode, instance.formData)) {
          continue;
        } else {
          continue;
        }
      }

      if (nextNode.type === 'approval') {
        if (nextNode.isConditionBranch) {
          const prevConditionNode = this.findPreviousConditionNode(sortedNodes, i);
          if (prevConditionNode && !this.evaluateCondition(prevConditionNode, instance.formData)) {
            continue;
          }
        }

        instance.currentNodeId = nextNode.id;
        instance.currentApprovers = nextNode.approvers ? [...nextNode.approvers] : [];
        instance.approvalResults[nextNode.id] = [];
        foundNext = true;
        break;
      }
    }

    if (!foundNext) {
      const endNode = sortedNodes.find(n => n.type === 'end');
      if (endNode) {
        instance.status = 'completed';
        instance.currentApprovers = [];
        instance.currentNodeId = endNode.id;
        const now = new Date().toISOString();
        instance.approvalHistory.push({
          id: 'rec_' + this.storage.generateId(),
          nodeId: endNode.id,
          nodeName: '流程结束',
          approver: instance.createdBy,
          action: 'end',
          comment: '流程已完成',
          createdAt: now
        });
      }
    }
  }

  private findPreviousConditionNode(nodes: FlowNode[], currentIndex: number): FlowNode | undefined {
    for (let i = currentIndex - 1; i >= 0; i--) {
      if (nodes[i].type === 'condition') {
        return nodes[i];
      }
      if (nodes[i].type === 'approval' && !nodes[i].isConditionBranch) {
        break;
      }
    }
    return undefined;
  }

  private evaluateCondition(node: FlowNode, formData: Record<string, any>): boolean {
    if (!node.conditions || node.conditions.length === 0) {
      return false;
    }

    return node.conditions.some(condition => {
      const fieldValue = formData[condition.field];
      const conditionValue = condition.value;

      switch (condition.operator) {
        case '>':
          return fieldValue > conditionValue;
        case '<':
          return fieldValue < conditionValue;
        case '>=':
          return fieldValue >= conditionValue;
        case '<=':
          return fieldValue <= conditionValue;
        case '==':
          return fieldValue == conditionValue;
        default:
          return false;
      }
    });
  }

  deleteInstance(id: string): void {
    this.storage.deleteInstance(id);
  }

  getProcessProgress(instance: FlowInstance, template: FlowTemplate): { 
    currentStep: number; 
    totalSteps: number;
    steps: { name: string; status: 'completed' | 'current' | 'pending'; nodeId: string }[]
  } {
    const sortedNodes = template.nodes
      .filter(n => n.type !== 'start')
      .sort((a, b) => a.order - b.order);

    const steps = sortedNodes.map(node => {
      let status: 'completed' | 'current' | 'pending' = 'pending';
      
      if (instance.approvalResults[node.id] && instance.approvalResults[node.id].length > 0) {
        status = 'completed';
      }
      if (node.id === instance.currentNodeId) {
        status = 'current';
      }
      if (instance.status === 'completed' && node.type === 'end') {
        status = 'completed';
      }

      return {
        name: node.name,
        status,
        nodeId: node.id
      };
    });

    const currentStep = steps.findIndex(s => s.status === 'current') + 1 || steps.length;
    const totalSteps = steps.length;

    return { currentStep, totalSteps, steps };
  }
}
