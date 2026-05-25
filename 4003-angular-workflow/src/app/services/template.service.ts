import { Injectable } from '@angular/core';
import { StorageService } from './storage.service';
import { FlowTemplate, FlowNode, FlowEdge, FormField, ConditionRule } from '../models/workflow.model';

@Injectable({
  providedIn: 'root'
})
export class TemplateService {

  constructor(private storage: StorageService) {}

  getAllTemplates(): FlowTemplate[] {
    return this.storage.getTemplates().sort((a, b) => 
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  getTemplate(id: string): FlowTemplate | undefined {
    return this.storage.getTemplate(id);
  }

  createTemplate(name: string, description: string = ''): FlowTemplate {
    const now = new Date().toISOString();
    const startNode: FlowNode = {
      id: 'start_' + this.storage.generateId(),
      type: 'start',
      name: '开始',
      order: 0
    };
    const endNode: FlowNode = {
      id: 'end_' + this.storage.generateId(),
      type: 'end',
      name: '结束',
      order: 2
    };
    const template: FlowTemplate = {
      id: 'tpl_' + this.storage.generateId(),
      name: name,
      description: description,
      nodes: [startNode, endNode],
      edges: [],
      formFields: [
        { id: 'ff_title', name: 'title', label: '标题', type: 'text', required: true, placeholder: '请输入标题' },
        { id: 'ff_amount', name: 'amount', label: '金额', type: 'number', required: true, placeholder: '请输入金额' },
        { id: 'ff_reason', name: 'reason', label: '事由', type: 'textarea', required: true, placeholder: '请输入事由' }
      ],
      createdAt: now,
      updatedAt: now,
      version: 1
    };
    this.storage.saveTemplate(template);
    return template;
  }

  saveTemplate(template: FlowTemplate): void {
    template.updatedAt = new Date().toISOString();
    this.storage.saveTemplate(template);
  }

  deleteTemplate(id: string): void {
    this.storage.deleteTemplate(id);
  }

  copyTemplate(id: string): FlowTemplate {
    const template = this.storage.getTemplate(id);
    if (!template) {
      throw new Error('Template not found');
    }
    const now = new Date().toISOString();
    const newNodes = template.nodes.map(n => ({ ...n }));
    const newEdges = template.edges.map(e => ({ ...e }));
    const newFormFields = template.formFields.map(f => ({ ...f }));
    const newTemplate: FlowTemplate = {
      id: 'tpl_' + this.storage.generateId(),
      name: template.name + ' (副本)',
      description: template.description,
      nodes: newNodes,
      edges: newEdges,
      formFields: newFormFields,
      createdAt: now,
      updatedAt: now,
      version: 1
    };
    this.storage.saveTemplate(newTemplate);
    return newTemplate;
  }

  exportTemplate(id: string): string {
    const template = this.storage.getTemplate(id);
    if (!template) {
      throw new Error('Template not found');
    }
    return JSON.stringify(template, null, 2);
  }

  importTemplate(json: string): FlowTemplate {
    const template: FlowTemplate = JSON.parse(json);
    template.id = 'tpl_' + this.storage.generateId();
    template.createdAt = new Date().toISOString();
    template.updatedAt = template.createdAt;
    template.version = 1;
    this.storage.saveTemplate(template);
    return template;
  }

  addNode(template: FlowTemplate, nodeType: 'approval' | 'condition', name: string): FlowNode {
    const maxOrder = Math.max(...template.nodes.filter(n => n.type !== 'end').map(n => n.order), 0);
    const node: FlowNode = {
      id: 'node_' + this.storage.generateId(),
      type: nodeType,
      name: name,
      order: maxOrder + 1
    };
    if (nodeType === 'approval') {
      node.approvers = [];
      node.approvalType = 'single';
    }
    if (nodeType === 'condition') {
      node.conditions = [];
    }
    const endNode = template.nodes.find(n => n.type === 'end');
    if (endNode) {
      endNode.order = maxOrder + 2;
    }
    template.nodes.push(node);
    this.updateNodeOrders(template);
    return node;
  }

  removeNode(template: FlowTemplate, nodeId: string): void {
    template.nodes = template.nodes.filter(n => n.id !== nodeId);
    template.edges = template.edges.filter(e => e.from !== nodeId && e.to !== nodeId);
    this.updateNodeOrders(template);
  }

  updateNodeOrders(template: FlowTemplate): void {
    const startNode = template.nodes.find(n => n.type === 'start');
    const endNode = template.nodes.find(n => n.type === 'end');
    const otherNodes = template.nodes.filter(n => n.type !== 'start' && n.type !== 'end');
    
    const sortedNodes = otherNodes.sort((a, b) => a.order - b.order);
    
    if (startNode) startNode.order = 0;
    sortedNodes.forEach((node, index) => {
      node.order = index + 1;
    });
    if (endNode) endNode.order = sortedNodes.length + 1;
  }

  moveNode(template: FlowTemplate, nodeId: string, direction: 'up' | 'down'): void {
    const node = template.nodes.find(n => n.id === nodeId);
    if (!node) return;

    const regularNodes = template.nodes
      .filter(n => n.type !== 'start' && n.type !== 'end')
      .sort((a, b) => a.order - b.order);
    
    const currentIndex = regularNodes.findIndex(n => n.id === nodeId);
    
    if (direction === 'up' && currentIndex > 0) {
      const temp = regularNodes[currentIndex].order;
      regularNodes[currentIndex].order = regularNodes[currentIndex - 1].order;
      regularNodes[currentIndex - 1].order = temp;
    } else if (direction === 'down' && currentIndex < regularNodes.length - 1) {
      const temp = regularNodes[currentIndex].order;
      regularNodes[currentIndex].order = regularNodes[currentIndex + 1].order;
      regularNodes[currentIndex + 1].order = temp;
    }
    this.updateNodeOrders(template);
  }

  addFormField(template: FlowTemplate, field: FormField): void {
    template.formFields.push(field);
  }

  removeFormField(template: FlowTemplate, fieldId: string): void {
    template.formFields = template.formFields.filter(f => f.id !== fieldId);
  }

  addCondition(template: FlowTemplate, nodeId: string, condition: ConditionRule): void {
    const node = template.nodes.find(n => n.id === nodeId);
    if (node && node.conditions) {
      node.conditions.push(condition);
    }
  }

  removeCondition(template: FlowTemplate, nodeId: string, index: number): void {
    const node = template.nodes.find(n => n.id === nodeId);
    if (node && node.conditions) {
      node.conditions.splice(index, 1);
    }
  }

  getDefaultTemplate(): FlowTemplate {
    const now = new Date().toISOString();
    const users = this.storage.getUsers();
    
    const template: FlowTemplate = {
      id: 'tpl_' + this.storage.generateId(),
      name: '请假审批流程',
      description: '标准的请假审批流程，包含部门负责人审批、HR审批和总经理审批',
      nodes: [
        { id: 'start_1', type: 'start', name: '开始', order: 0 },
        { id: 'node_1', type: 'approval', name: '部门负责人审批', approvers: [users[1]], approvalType: 'single', order: 1 },
        { id: 'node_2', type: 'approval', name: 'HR审批', approvers: [users[2]], approvalType: 'single', order: 2 },
        { id: 'node_3', type: 'condition', name: '金额条件判断', conditions: [{ field: 'amount', operator: '>', value: 50000 }], order: 3 },
        { id: 'node_4', type: 'approval', name: '总裁审批', approvers: [users[4]], approvalType: 'single', isConditionBranch: true, order: 4 },
        { id: 'end_1', type: 'end', name: '结束', order: 5 }
      ],
      edges: [],
      formFields: [
        { id: 'ff_title', name: 'title', label: '标题', type: 'text', required: true, placeholder: '请输入标题' },
        { id: 'ff_amount', name: 'amount', label: '金额', type: 'number', required: true, placeholder: '请输入金额' },
        { id: 'ff_reason', name: 'reason', label: '事由', type: 'textarea', required: true, placeholder: '请输入事由' }
      ],
      createdAt: now,
      updatedAt: now,
      version: 1
    };
    
    return template;
  }
}
