import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb, persist } from '../db';
import { logOperation } from '../utils/logger';
import { Approval } from '../types';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  const db = getDb();
  const { status, article_id } = req.query;
  
  let approvals = [...db.approvals];

  if (status) {
    approvals = approvals.filter(a => a.status === status);
  }
  if (article_id) {
    approvals = approvals.filter(a => a.article_id === article_id);
  }

  approvals.sort((a, b) => new Date(b.requested_at).getTime() - new Date(a.requested_at).getTime());

  const result = approvals.map(approval => {
    const article = db.articles.find(a => a.id === approval.article_id);
    return {
      ...approval,
      article_title: article?.title
    };
  });

  res.json(result);
});

router.get('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const approval = db.approvals.find(a => a.id === req.params.id);
  if (!approval) {
    return res.status(404).json({ error: '审批记录不存在' });
  }
  const article = db.articles.find(a => a.id === approval.article_id);
  res.json({
    ...approval,
    article_title: article?.title
  });
});

router.post('/', (req: Request, res: Response) => {
  const db = getDb();
  const { article_id, request_note } = req.body;
  const id = uuidv4();
  const now = new Date().toISOString();

  const article = db.articles.find(a => a.id === article_id);
  if (!article) {
    return res.status(404).json({ error: '文章不存在' });
  }

  const newApproval: Approval = {
    id,
    article_id,
    status: 'pending',
    requester_id: 'system',
    request_note,
    requested_at: now
  };

  db.approvals.push(newApproval);
  article.status = 'pending_approval';
  article.updated_at = now;
  persist();

  logOperation('system', '系统用户', 'request_approval', 'approval', id, `提交审批: ${article.title}`);

  res.status(201).json({ id, article_id });
});

router.post('/:id/approve', (req: Request, res: Response) => {
  const db = getDb();
  const { id } = req.params;
  const { approval_note } = req.body;
  const now = new Date().toISOString();

  const approval = db.approvals.find(a => a.id === id);
  if (!approval) {
    return res.status(404).json({ error: '审批记录不存在' });
  }

  approval.status = 'approved';
  approval.approver_id = 'system';
  approval.approval_note = approval_note;
  approval.approved_at = now;

  const article = db.articles.find(a => a.id === approval.article_id);
  if (article) {
    article.status = 'published';
    article.published_at = now;
    article.updated_at = now;
  }

  persist();
  logOperation('system', '系统用户', 'approve', 'approval', id, `审批通过`);

  res.json({ success: true });
});

router.post('/:id/reject', (req: Request, res: Response) => {
  const db = getDb();
  const { id } = req.params;
  const { approval_note } = req.body;
  const now = new Date().toISOString();

  const approval = db.approvals.find(a => a.id === id);
  if (!approval) {
    return res.status(404).json({ error: '审批记录不存在' });
  }

  approval.status = 'rejected';
  approval.approver_id = 'system';
  approval.approval_note = approval_note;
  approval.approved_at = now;

  const article = db.articles.find(a => a.id === approval.article_id);
  if (article) {
    article.status = 'draft';
    article.updated_at = now;
  }

  persist();
  logOperation('system', '系统用户', 'reject', 'approval', id, `审批驳回`);

  res.json({ success: true });
});

export default router;
