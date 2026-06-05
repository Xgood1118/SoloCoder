class MemoryStorage {
  constructor() {
    this.forms = new Map();
    this.formVersions = new Map();
    this.submissions = new Map();
    this.templates = new Map();
    this.webhookLogs = new Map();
    this.drafts = new Map();
    this.sharedForms = new Map();
    this.nextFormId = 1;
    this.nextVersionId = 1;
    this.nextSubmissionId = 1;
    this.nextTemplateId = 1;
    this.nextLogId = 1;
    this.nextDraftId = 1;

    this.initTemplates();
  }

  initTemplates() {
    const templates = [
      {
        id: 'leave-application',
        name: '请假申请',
        description: '员工请假申请单',
        formConfig: {
          name: '请假申请',
          description: '员工请假申请表单',
          webhookUrl: '',
          fields: [
            {
              key: 'employeeName',
              label: '员工姓名',
              type: 'text',
              required: true,
              placeholder: '请输入姓名',
              typeMeta: { minLength: 1, maxLength: 100 }
            },
            {
              key: 'department',
              label: '所属部门',
              type: 'select',
              required: true,
              options: [
                { label: '技术部', value: 'tech' },
                { label: '产品部', value: 'product' },
                { label: '运营部', value: 'operation' },
                { label: '人事部', value: 'hr' },
                { label: '财务部', value: 'finance' }
              ]
            },
            {
              key: 'leaveType',
              label: '请假类型',
              type: 'radio',
              required: true,
              options: [
                { label: '事假', value: 'personal' },
                { label: '病假', value: 'sick' },
                { label: '年假', value: 'annual' },
                { label: '婚假', value: 'marriage' },
                { label: '产假', value: 'maternity' }
              ]
            },
            {
              key: 'startDate',
              label: '开始日期',
              type: 'date',
              required: true
            },
            {
              key: 'endDate',
              label: '结束日期',
              type: 'date',
              required: true
            },
            {
              key: 'reason',
              label: '请假原因',
              type: 'textarea',
              required: true,
              placeholder: '请详细说明请假原因',
              typeMeta: { minLength: 1, maxLength: 2000 }
            },
            {
              key: 'days',
              label: '请假天数',
              type: 'number',
              required: true,
              typeMeta: { min: 0.5, max: 365 }
            }
          ]
        },
        isBuiltIn: true
      },
      {
        id: 'equipment-repair',
        name: '设备报修',
        description: '办公设备报修申请',
        formConfig: {
          name: '设备报修',
          description: '办公设备报修申请表单',
          webhookUrl: '',
          fields: [
            {
              key: 'reporter',
              label: '报修人',
              type: 'text',
              required: true,
              typeMeta: { minLength: 1, maxLength: 100 }
            },
            {
              key: 'equipmentType',
              label: '设备类型',
              type: 'select',
              required: true,
              options: [
                { label: '电脑', value: 'computer' },
                { label: '打印机', value: 'printer' },
                { label: '空调', value: 'ac' },
                { label: '投影仪', value: 'projector' },
                { label: '其他', value: 'other' }
              ]
            },
            {
              key: 'location',
              label: '设备位置',
              type: 'text',
              required: true,
              placeholder: '如：3楼302会议室'
            },
            {
              key: 'urgency',
              label: '紧急程度',
              type: 'rating',
              required: true
            },
            {
              key: 'description',
              label: '故障描述',
              type: 'textarea',
              required: true,
              typeMeta: { minLength: 1, maxLength: 2000 }
            },
            {
              key: 'photos',
              label: '故障照片',
              type: 'file',
              required: false,
              typeMeta: {
                maxFiles: 5,
                maxSize: 5 * 1024 * 1024,
                allowedTypes: ['image/jpeg', 'image/png', 'application/pdf']
              }
            }
          ]
        },
        isBuiltIn: true
      },
      {
        id: 'event-registration',
        name: '活动报名',
        description: '活动报名登记表单',
        formConfig: {
          name: '活动报名',
          description: '活动报名登记',
          webhookUrl: '',
          fields: [
            {
              key: 'name',
              label: '姓名',
              type: 'text',
              required: true,
              typeMeta: { minLength: 1, maxLength: 100 }
            },
            {
              key: 'phone',
              label: '联系电话',
              type: 'text',
              required: true,
              validation: { pattern: '^1[3-9]\\d{9}$' }
            },
            {
              key: 'email',
              label: '邮箱',
              type: 'text',
              required: false,
              validation: { pattern: '^[^@]+@[^@]+\\.[^@]+$' }
            },
            {
              key: 'eventDate',
              label: '活动日期',
              type: 'date',
              required: true
            },
            {
              key: 'eventTime',
              label: '活动时间',
              type: 'time',
              required: true
            },
            {
              key: 'participants',
              label: '参与人数',
              type: 'number',
              required: true,
              typeMeta: { min: 1, max: 100 },
              defaultValue: 1
            },
            {
              key: 'dietaryRequirements',
              label: '饮食需求',
              type: 'checkbox',
              options: [
                { label: '素食', value: 'vegetarian' },
                { label: '清真', value: 'halal' },
                { label: '无麸质', value: 'gluten-free' },
                { label: '无特殊需求', value: 'none' }
              ]
            },
            {
              key: 'remarks',
              label: '备注',
              type: 'textarea',
              required: false
            }
          ]
        },
        isBuiltIn: true
      },
      {
        id: 'survey-questionnaire',
        name: '调研问卷',
        description: '通用调研问卷模板',
        formConfig: {
          name: '调研问卷',
          description: '用户满意度调研',
          webhookUrl: '',
          fields: [
            {
              key: 'ageGroup',
              label: '年龄段',
              type: 'select',
              required: true,
              options: [
                { label: '18岁以下', value: 'under18' },
                { label: '18-25岁', value: '18-25' },
                { label: '26-35岁', value: '26-35' },
                { label: '36-45岁', value: '36-45' },
                { label: '46岁以上', value: 'over46' }
              ]
            },
            {
              key: 'satisfaction',
              label: '整体满意度',
              type: 'rating',
              required: true
            },
            {
              key: 'likedFeatures',
              label: '您喜欢的功能（可多选）',
              type: 'multiselect',
              options: [
                { label: '界面设计', value: 'ui' },
                { label: '响应速度', value: 'speed' },
                { label: '功能丰富', value: 'features' },
                { label: '易用性', value: 'usability' },
                { label: '客户服务', value: 'support' }
              ]
            },
            {
              key: 'wouldRecommend',
              label: '是否会推荐给朋友',
              type: 'radio',
              required: true,
              options: [
                { label: '一定会', value: 'definitely' },
                { label: '可能会', value: 'maybe' },
                { label: '不会', value: 'no' }
              ]
            },
            {
              key: 'suggestions',
              label: '改进建议',
              type: 'textarea',
              required: false,
              typeMeta: { maxLength: 2000 }
            }
          ]
        },
        isBuiltIn: true
      }
    ];

    templates.forEach(t => {
      this.templates.set(t.id, t);
    });
  }

  createForm(formData) {
    const id = String(this.nextFormId++);
    const form = {
      id,
      ...formData,
      derivedFrom: formData.derivedFrom || null,
      sharedWith: formData.sharedWith || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1
    };
    this.forms.set(id, form);
    this.createFormVersion(id, form, 'Initial version');
    return form;
  }

  getForm(id) {
    return this.forms.get(id);
  }

  getForms() {
    return Array.from(this.forms.values());
  }

  updateForm(id, formData, changeNote = 'Updated') {
    const existing = this.forms.get(id);
    if (!existing) return null;

    const newVersion = existing.version + 1;
    const updated = {
      ...existing,
      ...formData,
      id,
      version: newVersion,
      updatedAt: new Date().toISOString()
    };
    this.forms.set(id, updated);
    this.createFormVersion(id, updated, changeNote);
    return updated;
  }

  deleteForm(id) {
    const deleted = this.forms.delete(id);
    if (deleted) {
      const versions = this.formVersions.get(id) || [];
      versions.forEach(v => this.formVersions.delete(v.id));
      this.submissions.forEach((sub, subId) => {
        if (sub.formId === id) this.submissions.delete(subId);
      });
    }
    return deleted;
  }

  createFormVersion(formId, form, note) {
    const versionId = String(this.nextVersionId++);
    const version = {
      id: versionId,
      formId,
      versionNumber: form.version,
      formData: JSON.parse(JSON.stringify(form)),
      note,
      createdAt: new Date().toISOString()
    };
    if (!this.formVersions.has(formId)) {
      this.formVersions.set(formId, []);
    }
    this.formVersions.get(formId).push(version);
    return version;
  }

  getFormVersions(formId) {
    return this.formVersions.get(formId) || [];
  }

  getFormVersion(formId, versionId) {
    const versions = this.formVersions.get(formId) || [];
    return versions.find(v => v.id === versionId);
  }

  rollbackToVersion(formId, versionId) {
    const version = this.getFormVersion(formId, versionId);
    if (!version) return null;

    return this.updateForm(formId, version.formData, `Rollback to version ${version.versionNumber}`);
  }

  createSubmission(formId, data, is补录 = false) {
    const id = String(this.nextSubmissionId++);
    const submission = {
      id,
      formId,
      data,
      is补录,
      createdAt: new Date().toISOString()
    };
    this.submissions.set(id, submission);
    return submission;
  }

  getSubmissions(formId) {
    return Array.from(this.submissions.values())
      .filter(s => s.formId === formId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  getSubmission(id) {
    return this.submissions.get(id);
  }

  deleteSubmission(id) {
    return this.submissions.delete(id);
  }

  deleteSubmissions(ids) {
    ids.forEach(id => this.submissions.delete(id));
    return true;
  }

  getTemplates() {
    return Array.from(this.templates.values());
  }

  getTemplate(id) {
    return this.templates.get(id);
  }

  createTemplate(templateData) {
    const id = String(this.nextTemplateId++);
    const template = {
      id,
      ...templateData,
      isBuiltIn: false,
      createdAt: new Date().toISOString()
    };
    this.templates.set(id, template);
    return template;
  }

  createWebhookLog(formId, submissionId, url, status, error = null) {
    const id = String(this.nextLogId++);
    const log = {
      id,
      formId,
      submissionId,
      url,
      status,
      error,
      attempts: 1,
      createdAt: new Date().toISOString(),
      lastAttemptAt: new Date().toISOString()
    };
    this.webhookLogs.set(id, log);
    return log;
  }

  updateWebhookLog(logId, status, error = null) {
    const log = this.webhookLogs.get(logId);
    if (!log) return null;
    log.status = status;
    log.error = error;
    log.attempts += 1;
    log.lastAttemptAt = new Date().toISOString();
    return log;
  }

  getWebhookLogs(formId = null) {
    let logs = Array.from(this.webhookLogs.values());
    if (formId) {
      logs = logs.filter(l => l.formId === formId);
    }
    return logs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  createDraft(formId, data, userId = 'anonymous') {
    const existingDraft = Array.from(this.drafts.values()).find(
      d => d.formId === formId && d.userId === userId
    );

    if (existingDraft) {
      existingDraft.data = data;
      existingDraft.updatedAt = new Date().toISOString();
      return existingDraft;
    }

    const id = String(this.nextDraftId++);
    const draft = {
      id,
      formId,
      userId,
      data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.drafts.set(id, draft);
    return draft;
  }

  getDraft(formId, userId = 'anonymous') {
    return Array.from(this.drafts.values()).find(
      d => d.formId === formId && d.userId === userId
    );
  }

  deleteDraft(id) {
    return this.drafts.delete(id);
  }

  shareForm(formId, users) {
    const form = this.forms.get(formId);
    if (!form) return null;
    form.sharedWith = users;
    form.updatedAt = new Date().toISOString();
    return form;
  }
}

module.exports = new MemoryStorage();
