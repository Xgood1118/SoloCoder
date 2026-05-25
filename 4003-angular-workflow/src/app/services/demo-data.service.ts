import { Injectable } from '@angular/core';
import { StorageService } from './storage.service';
import { TemplateService } from './template.service';
import { ProcessService } from './process.service';
import { FlowTemplate, FlowInstance, User } from '../models/workflow.model';

@Injectable({
  providedIn: 'root'
})
export class DemoDataService {

  constructor(
    private storage: StorageService,
    private templateService: TemplateService,
    private processService: ProcessService
  ) {}

  initDemoData(): void {
    this.ensureUsers();
    this.ensureTemplates();
    this.ensureInstances();
  }

  private ensureUsers(): void {
    const users = this.storage.getUsers();
    if (users.length === 0) {
      const demoUsers: User[] = [
        { id: 'u1', name: '张三', role: '员工', department: '技术部' },
        { id: 'u2', name: '李四', role: '部门负责人', department: '技术部' },
        { id: 'u3', name: '王五', role: 'HR经理', department: '人事部' },
        { id: 'u4', name: '赵六', role: '总经理', department: '总经办' },
        { id: 'u5', name: '钱七', role: '总裁', department: '总经办' }
      ];
      this.storage.saveUsers(demoUsers);
    }
  }

  private ensureTemplates(): void {
    const templates = this.templateService.getAllTemplates();
    if (templates.length > 0) return;

    const users = this.storage.getUsers();
    const now = new Date().toISOString();

    const leaveTemplate: FlowTemplate = {
      id: 'tpl_leave',
      name: '请假审批流程',
      description: '标准的请假审批流程，适用于公司所有员工',
      nodes: [
        { id: 'start_leave', type: 'start', name: '开始', order: 0 },
        { id: 'node_dept', type: 'approval', name: '部门负责人审批', approvers: [users[1]], approvalType: 'single', order: 1 },
        { id: 'node_hr', type: 'approval', name: 'HR审批', approvers: [users[2]], approvalType: 'single', order: 2 },
        { id: 'node_condition', type: 'condition', name: '金额条件判断', conditions: [{ field: 'amount', operator: '>', value: 50000 }], order: 3 },
        { id: 'node_president', type: 'approval', name: '总裁审批', approvers: [users[4]], approvalType: 'single', isConditionBranch: true, order: 4 },
        { id: 'end_leave', type: 'end', name: '结束', order: 5 }
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

    const expenseTemplate: FlowTemplate = {
      id: 'tpl_expense',
      name: '报销审批流程',
      description: '用于员工费用报销审批',
      nodes: [
        { id: 'start_expense', type: 'start', name: '开始', order: 0 },
        { id: 'node_dept2', type: 'approval', name: '部门负责人审批', approvers: [users[1]], approvalType: 'single', order: 1 },
        { id: 'node_finance', type: 'approval', name: '财务审核', approvers: [users[2]], approvalType: 'single', order: 2 },
        { id: 'node_gm', type: 'approval', name: '总经理审批', approvers: [users[3]], approvalType: 'single', order: 3 },
        { id: 'end_expense', type: 'end', name: '结束', order: 4 }
      ],
      edges: [],
      formFields: [
        { id: 'ff_title2', name: 'title', label: '标题', type: 'text', required: true, placeholder: '请输入标题' },
        { id: 'ff_amount2', name: 'amount', label: '报销金额', type: 'number', required: true, placeholder: '请输入金额' },
        { id: 'ff_reason2', name: 'reason', label: '报销事由', type: 'textarea', required: true, placeholder: '请输入事由' },
        { id: 'ff_date', name: 'date', label: '日期', type: 'date', required: false }
      ],
      createdAt: now,
      updatedAt: now,
      version: 1
    };

    const purchaseTemplate: FlowTemplate = {
      id: 'tpl_purchase',
      name: '采购审批流程',
      description: '用于采购申请审批，支持多人会签',
      nodes: [
        { id: 'start_purchase', type: 'start', name: '开始', order: 0 },
        { id: 'node_dept3', type: 'approval', name: '部门负责人审批', approvers: [users[1]], approvalType: 'single', order: 1 },
        { id: 'node_finance2', type: 'approval', name: '财务审核', approvers: [users[2]], approvalType: 'single', order: 2 },
        { id: 'node_board', type: 'approval', name: '管理层会签', approvers: [users[3], users[4]], approvalType: 'countersign', order: 3 },
        { id: 'end_purchase', type: 'end', name: '结束', order: 4 }
      ],
      edges: [],
      formFields: [
        { id: 'ff_title3', name: 'title', label: '采购标题', type: 'text', required: true, placeholder: '请输入采购标题' },
        { id: 'ff_amount3', name: 'amount', label: '采购金额', type: 'number', required: true, placeholder: '请输入金额' },
        { id: 'ff_items', name: 'items', label: '采购明细', type: 'textarea', required: true, placeholder: '请输入采购明细' },
        { id: 'ff_reason3', name: 'reason', label: '采购原因', type: 'textarea', required: true, placeholder: '请输入采购原因' }
      ],
      createdAt: now,
      updatedAt: now,
      version: 1
    };

    this.storage.saveTemplate(leaveTemplate);
    this.storage.saveTemplate(expenseTemplate);
    this.storage.saveTemplate(purchaseTemplate);
  }

  private ensureInstances(): void {
    const instances = this.processService.getAllInstances();
    if (instances.length > 0) return;

    const users = this.storage.getUsers();
    const templates = this.templateService.getAllTemplates();
    if (templates.length === 0) return;

    this.storage.saveCurrentUser(users[0]);

    const draftInstance: FlowInstance = {
      id: 'inst_demo1',
      templateId: templates[0].id,
      templateName: templates[0].name,
      status: 'draft',
      formData: {
        title: '设备采购申请',
        amount: 30000,
        reason: '需要购买新的开发设备'
      },
      currentNodeId: '',
      approverQueue: [],
      approvalHistory: [],
      currentApprovers: [],
      approvalResults: {},
      createdBy: users[0],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isDraft: true
    };

    const pendingInstance: FlowInstance = {
      id: 'inst_demo2',
      templateId: templates[0].id,
      templateName: templates[0].name,
      status: 'pending',
      formData: {
        title: '年度团建申请',
        amount: 60000,
        reason: '申请年度团建活动经费'
      },
      currentNodeId: templates[0].nodes[1].id,
      approverQueue: [],
      approvalHistory: [
        {
          id: 'rec_demo1',
          nodeId: '',
          nodeName: '提交',
          approver: users[0],
          action: 'submit',
          comment: '请审批',
          createdAt: new Date(Date.now() - 3600000).toISOString()
        }
      ],
      currentApprovers: [users[1]],
      approvalResults: {},
      createdBy: users[0],
      createdAt: new Date(Date.now() - 3600000).toISOString(),
      updatedAt: new Date(Date.now() - 3600000).toISOString(),
      isDraft: false
    };

    const completedInstance: FlowInstance = {
      id: 'inst_demo3',
      templateId: templates[1].id,
      templateName: templates[1].name,
      status: 'completed',
      formData: {
        title: '差旅费报销',
        amount: 5000,
        reason: '出差北京参加会议'
      },
      currentNodeId: templates[1].nodes[templates[1].nodes.length - 1].id,
      approverQueue: [],
      approvalHistory: [
        {
          id: 'rec_demo2',
          nodeId: '',
          nodeName: '提交',
          approver: users[0],
          action: 'submit',
          comment: '',
          createdAt: new Date(Date.now() - 86400000 * 3).toISOString()
        },
        {
          id: 'rec_demo3',
          nodeId: templates[1].nodes[1].id,
          nodeName: templates[1].nodes[1].name,
          approver: users[1],
          action: 'approve',
          comment: '同意',
          createdAt: new Date(Date.now() - 86400000 * 2).toISOString()
        },
        {
          id: 'rec_demo4',
          nodeId: templates[1].nodes[2].id,
          nodeName: templates[1].nodes[2].name,
          approver: users[2],
          action: 'approve',
          comment: '已审核',
          createdAt: new Date(Date.now() - 86400000).toISOString()
        },
        {
          id: 'rec_demo5',
          nodeId: templates[1].nodes[3].id,
          nodeName: templates[1].nodes[3].name,
          approver: users[3],
          action: 'approve',
          comment: '同意',
          createdAt: new Date().toISOString()
        },
        {
          id: 'rec_demo6',
          nodeId: templates[1].nodes[4].id,
          nodeName: '流程结束',
          approver: users[0],
          action: 'end',
          comment: '流程已完成',
          createdAt: new Date().toISOString()
        }
      ],
      currentApprovers: [],
      approvalResults: {
        [templates[1].nodes[1].id]: [
          {
            id: 'rec_demo3',
            nodeId: templates[1].nodes[1].id,
            nodeName: templates[1].nodes[1].name,
            approver: users[1],
            action: 'approve',
            comment: '同意',
            createdAt: new Date(Date.now() - 86400000 * 2).toISOString()
          }
        ],
        [templates[1].nodes[2].id]: [
          {
            id: 'rec_demo4',
            nodeId: templates[1].nodes[2].id,
            nodeName: templates[1].nodes[2].name,
            approver: users[2],
            action: 'approve',
            comment: '已审核',
            createdAt: new Date(Date.now() - 86400000).toISOString()
          }
        ],
        [templates[1].nodes[3].id]: [
          {
            id: 'rec_demo5',
            nodeId: templates[1].nodes[3].id,
            nodeName: templates[1].nodes[3].name,
            approver: users[3],
            action: 'approve',
            comment: '同意',
            createdAt: new Date().toISOString()
          }
        ]
      },
      createdBy: users[0],
      createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
      updatedAt: new Date().toISOString(),
      isDraft: false
    };

    const rejectedInstance: FlowInstance = {
      id: 'inst_demo4',
      templateId: templates[2].id,
      templateName: templates[2].name,
      status: 'rejected',
      formData: {
        title: '办公用品采购',
        amount: 80000,
        items: '电脑、打印机、办公桌',
        reason: '部门新员工入职需要'
      },
      currentNodeId: templates[2].nodes[1].id,
      approverQueue: [],
      approvalHistory: [
        {
          id: 'rec_demo7',
          nodeId: '',
          nodeName: '提交',
          approver: users[0],
          action: 'submit',
          comment: '',
          createdAt: new Date(Date.now() - 86400000 * 2).toISOString()
        },
        {
          id: 'rec_demo8',
          nodeId: templates[2].nodes[1].id,
          nodeName: templates[2].nodes[1].name,
          approver: users[1],
          action: 'reject',
          comment: '金额过大，请拆分采购',
          createdAt: new Date(Date.now() - 86400000).toISOString()
        }
      ],
      currentApprovers: [],
      approvalResults: {
        [templates[2].nodes[1].id]: [
          {
            id: 'rec_demo8',
            nodeId: templates[2].nodes[1].id,
            nodeName: templates[2].nodes[1].name,
            approver: users[1],
            action: 'reject',
            comment: '金额过大，请拆分采购',
            createdAt: new Date(Date.now() - 86400000).toISOString()
          }
        ]
      },
      createdBy: users[0],
      createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
      updatedAt: new Date(Date.now() - 86400000).toISOString(),
      isDraft: false,
      rejectedFromNode: templates[2].nodes[1].id
    };

    this.storage.saveInstance(draftInstance);
    this.storage.saveInstance(pendingInstance);
    this.storage.saveInstance(completedInstance);
    this.storage.saveInstance(rejectedInstance);
  }
}
