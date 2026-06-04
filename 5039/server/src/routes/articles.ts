import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb, persist } from '../db';
import { logOperation } from '../utils/logger';
import { Article } from '../types';

const router = Router();

function getTagsForArticle(articleId: string) {
  const db = getDb();
  const articleTags = db.article_versions.filter(at => at.article_id === articleId);
  const tagIds = articleTags.map(at => at.id);
  return db.tags.filter(t => tagIds.includes(t.id));
}

function setArticleTags(articleId: string, tagIds: string[]) {
  const db = getDb();
  db.article_versions = db.article_versions.filter(at => at.article_id !== articleId);
  persist();
}

function createArticleVersion(articleId: string, createdBy: string, changeLog?: string) {
  const db = getDb();
  const article = db.articles.find(a => a.id === articleId);
  if (!article) return;

  const versions = db.article_versions.filter(v => v.article_id === articleId);
  const versionNumber = versions.length > 0 ? Math.max(...versions.map(v => v.version_number)) + 1 : 1;

  db.article_versions.push({
    id: uuidv4(),
    article_id: articleId,
    version_number: versionNumber,
    title: article.title,
    content: article.content,
    excerpt: article.excerpt,
    cover_image: article.cover_image,
    created_by: createdBy,
    change_log: changeLog,
    created_at: new Date().toISOString()
  });
  persist();
}

router.get('/', (req: Request, res: Response) => {
  const db = getDb();
  const { status, category_id, language, page = 1, page_size = 20, include_deleted = 'false' } = req.query;
  
  let articles = [...db.articles];

  if (include_deleted !== 'true') {
    articles = articles.filter(a => !a.deleted_at);
  }

  if (status) {
    articles = articles.filter(a => a.status === status);
  }
  if (category_id) {
    articles = articles.filter(a => a.category_id === category_id);
  }
  if (language) {
    articles = articles.filter(a => a.language === language);
  }

  articles.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const total = articles.length;
  const offset = (Number(page) - 1) * Number(page_size);
  const paginatedArticles = articles.slice(offset, offset + Number(page_size));

  const result = paginatedArticles.map(article => {
    const category = db.categories.find(c => c.id === article.category_id);
    const template = db.templates.find(t => t.id === article.template_id);
    const articleTagRelations = db.article_versions.filter(v => v.article_id === article.id);
    const articleTags = db.tags.filter(t => articleTagRelations.some(r => r.id === t.id));
    return {
      ...article,
      category_name: category?.name,
      template_name: template?.name,
      tags: articleTags
    };
  });

  res.json({
    data: result,
    total,
    page: Number(page),
    page_size: Number(page_size)
  });
});

router.get('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const article = db.articles.find(a => a.id === req.params.id);
  
  if (!article) {
    return res.status(404).json({ error: '文章不存在' });
  }

  const category = db.categories.find(c => c.id === article.category_id);
  const template = db.templates.find(t => t.id === article.template_id);
  const articleTagRelations = db.article_versions.filter(v => v.article_id === article.id);
  const articleTags = db.tags.filter(t => articleTagRelations.some(r => r.id === t.id));

  res.json({
    ...article,
    category_name: category?.name,
    template_name: template?.name,
    tags: articleTags
  });
});

router.get('/:id/related', (req: Request, res: Response) => {
  const db = getDb();
  const article = db.articles.find(a => a.id === req.params.id);
  if (!article) {
    return res.status(404).json({ error: '文章不存在' });
  }

  const articleTagRelations = db.article_versions.filter(v => v.article_id === article.id);
  const tagIds = articleTagRelations.map(r => r.id);

  let related = db.articles.filter(a => 
    a.id !== article.id && a.status === 'published' && !a.deleted_at
  );

  if (tagIds.length > 0 || article.category_id) {
    related = related.filter(a => {
      const relTags = db.article_versions.filter(v => v.article_id === a.id);
      const relTagIds = relTags.map(r => r.id);
      const hasCommonTag = tagIds.some(tid => relTagIds.includes(tid));
      const hasSameCategory = a.category_id === article.category_id;
      return hasCommonTag || hasSameCategory;
    });
  }

  related.sort((a, b) => new Date(b.published_at || b.created_at).getTime() - new Date(a.published_at || a.created_at).getTime());

  res.json(related.slice(0, 10));
});

router.get('/:id/versions', (req: Request, res: Response) => {
  const db = getDb();
  const versions = db.article_versions
    .filter(v => v.article_id === req.params.id)
    .sort((a, b) => b.version_number - a.version_number);
  res.json(versions);
});

router.post('/:id/restore-version/:versionId', (req: Request, res: Response) => {
  const db = getDb();
  const { id, versionId } = req.params;
  const version = db.article_versions.find(v => v.id === versionId && v.article_id === id);
  
  if (!version) {
    return res.status(404).json({ error: '版本不存在' });
  }

  createArticleVersion(id, 'system', `回滚到版本 ${version.version_number}`);

  const article = db.articles.find(a => a.id === id);
  if (article) {
    article.title = version.title;
    article.content = version.content;
    article.excerpt = version.excerpt;
    article.cover_image = version.cover_image;
    article.updated_at = new Date().toISOString();
    persist();
  }

  logOperation('system', '系统用户', 'restore_version', 'article', id, `回滚到版本 ${version.version_number}`);
  
  res.json({ success: true });
});

router.post('/', (req: Request, res: Response) => {
  const db = getDb();
  const { title, content, excerpt, cover_image, category_id, template_id, tags = [], language = 'zh-CN', master_id } = req.body;
  
  const id = uuidv4();
  const slug = `${Date.now()}-${title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '-').slice(0, 50)}`;
  const now = new Date().toISOString();

  const newArticle: Article = {
    id,
    title,
    slug,
    content,
    excerpt,
    cover_image,
    status: 'draft',
    language,
    category_id,
    template_id,
    author_id: 'system',
    created_at: now,
    updated_at: now,
    master_id: master_id || null
  };

  db.articles.push(newArticle);

  tags.forEach((tagId: string) => {
    db.article_versions.push({
      id: tagId,
      article_id: id,
      version_number: 0,
      title: '',
      created_by: 'system',
      created_at: now
    });
  });

  persist();
  logOperation('system', '系统用户', 'create', 'article', id, `创建文章: ${title}`);

  res.status(201).json({ id, title, slug });
});

router.put('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const { title, content, excerpt, cover_image, category_id, template_id, tags, status, language } = req.body;
  const { id } = req.params;

  const article = db.articles.find(a => a.id === id);
  if (!article) {
    return res.status(404).json({ error: '文章不存在' });
  }

  if (article.status === 'published' && (title !== undefined || content !== undefined)) {
    createArticleVersion(id, 'system', '编辑已发布文章');
  }

  if (title !== undefined) article.title = title;
  if (content !== undefined) article.content = content;
  if (excerpt !== undefined) article.excerpt = excerpt;
  if (cover_image !== undefined) article.cover_image = cover_image;
  if (category_id !== undefined) article.category_id = category_id;
  if (template_id !== undefined) article.template_id = template_id;
  if (status !== undefined) article.status = status;
  if (language !== undefined) article.language = language;
  article.updated_at = new Date().toISOString();

  if (tags && tags.length >= 0) {
    db.article_versions = db.article_versions.filter(v => v.article_id !== id || v.version_number > 0);
    tags.forEach((tagId: string) => {
      db.article_versions.push({
        id: tagId,
        article_id: id,
        version_number: 0,
        title: '',
        created_by: 'system',
        created_at: new Date().toISOString()
      });
    });
  }

  persist();
  logOperation('system', '系统用户', 'update', 'article', id, `更新文章`);

  res.json({ success: true });
});

router.post('/:id/publish', (req: Request, res: Response) => {
  const db = getDb();
  const { id } = req.params;
  const article = db.articles.find(a => a.id === id);
  
  if (!article) {
    return res.status(404).json({ error: '文章不存在' });
  }

  createArticleVersion(id, 'system', '发布文章');

  article.status = 'published';
  article.published_at = new Date().toISOString();
  article.updated_at = new Date().toISOString();
  persist();

  logOperation('system', '系统用户', 'publish', 'article', id, `发布文章: ${article.title}`);

  res.json({ success: true });
});

router.delete('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const { id } = req.params;
  const { permanent = 'false' } = req.query;

  const article = db.articles.find(a => a.id === id);
  if (!article) {
    return res.status(404).json({ error: '文章不存在' });
  }

  if (permanent === 'true') {
    db.articles = db.articles.filter(a => a.id !== id);
    db.article_versions = db.article_versions.filter(v => v.article_id !== id);
    persist();
    logOperation('system', '系统用户', 'delete_permanent', 'article', id, `永久删除文章: ${article.title}`);
  } else {
    article.deleted_at = new Date().toISOString();
    article.updated_at = new Date().toISOString();
    persist();
    logOperation('system', '系统用户', 'delete', 'article', id, `删除文章到回收站: ${article.title}`);
  }

  res.json({ success: true });
});

router.post('/:id/restore', (req: Request, res: Response) => {
  const db = getDb();
  const { id } = req.params;
  const article = db.articles.find(a => a.id === id && a.deleted_at);
  
  if (!article) {
    return res.status(404).json({ error: '文章不在回收站中' });
  }

  article.deleted_at = undefined;
  article.updated_at = new Date().toISOString();
  persist();
  logOperation('system', '系统用户', 'restore', 'article', id, `从回收站恢复文章: ${article.title}`);

  res.json({ success: true });
});

export default router;
