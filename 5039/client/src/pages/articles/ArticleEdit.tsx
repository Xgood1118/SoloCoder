import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  articlesApi,
  categoriesApi,
  tagsApi,
  templatesApi,
  approvalsApi,
} from '../../api';
import { Category, Tag, Template, ArticleVersion, Article } from '../../types';

const statusLabels: Record<string, string> = {
  draft: '草稿',
  pending_approval: '待审批',
  published: '已发布',
  archived: '已归档',
};

export default function ArticleEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = id === 'new';

  const [formData, setFormData] = useState({
    title: '',
    content: '',
    excerpt: '',
    cover_image: '',
    category_id: '',
    template_id: '',
    language: 'zh-CN',
    tags: [] as string[],
  });

  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [versions, setVersions] = useState<ArticleVersion[]>([]);
  const [showVersions, setShowVersions] = useState(false);
  const [articleStatus, setArticleStatus] = useState('draft');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [languageVersions, setLanguageVersions] = useState<Article[]>([]);
  const [showLanguageVersions, setShowLanguageVersions] = useState(false);
  const [articleMasterId, setArticleMasterId] = useState<string | undefined>();
  const [allArticles, setAllArticles] = useState<Article[]>([]);

  useEffect(() => {
    loadOptions();
    if (!isNew && id) {
      loadArticle(id);
    } else {
      setLoading(false);
    }
  }, [id, isNew]);

  const loadOptions = async () => {
    try {
      const [catRes, tagRes, tempRes, articlesRes] = await Promise.all([
        categoriesApi.getList(),
        tagsApi.getList(),
        templatesApi.getList(),
        articlesApi.getList({ page_size: 1000 }),
      ]);
      setCategories(catRes.data);
      setTags(tagRes.data);
      setTemplates(tempRes.data);
      setAllArticles(articlesRes.data.data || []);
    } catch (error) {
      console.error('加载选项失败:', error);
    }
  };

  const loadArticle = async (articleId: string) => {
    try {
      const res = await articlesApi.get(articleId);
      const article = res.data;
      setFormData({
        title: article.title,
        content: article.content || '',
        excerpt: article.excerpt || '',
        cover_image: article.cover_image || '',
        category_id: article.category_id || '',
        template_id: article.template_id || '',
        language: article.language,
        tags: (article.tags || []).map((t: Tag) => t.id),
      });
      setArticleStatus(article.status);
      setArticleMasterId(article.master_id);

      const verRes = await articlesApi.getVersions(articleId);
      setVersions(verRes.data);

      const masterId = article.master_id || article.id;
      const relatedVersions = allArticles.filter(
        (a) => (a.master_id === masterId || a.id === masterId) && a.id !== articleId
      );
      setLanguageVersions(relatedVersions);
    } catch (error) {
      console.error('加载文章失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      alert('请输入文章标题');
      return;
    }

    setSaving(true);
    try {
      if (isNew) {
        const res = await articlesApi.create(formData);
        navigate(`/articles/${res.data.id}`);
      } else if (id) {
        await articlesApi.update(id, formData);
        alert('保存成功');
        loadArticle(id);
      }
    } catch (error) {
      console.error('保存失败:', error);
      alert('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!id) return;
    if (confirm('确定要发布这篇文章吗?')) {
      try {
        await articlesApi.publish(id);
        alert('发布成功');
        loadArticle(id);
      } catch (error) {
        console.error('发布失败:', error);
        alert('发布失败');
      }
    }
  };

  const handleSubmitApproval = async () => {
    if (!id) return;
    const note = prompt('请输入审批备注(可选):');
    try {
      await approvalsApi.create({ article_id: id, request_note: note });
      alert('已提交审批');
      loadArticle(id);
    } catch (error) {
      console.error('提交审批失败:', error);
      alert('提交审批失败');
    }
  };

  const handleRestoreVersion = async (versionId: string) => {
    if (!id) return;
    if (confirm('确定要回滚到此版本吗?')) {
      try {
        await articlesApi.restoreVersion(id, versionId);
        alert('回滚成功');
        loadArticle(id);
      } catch (error) {
        console.error('回滚失败:', error);
        alert('回滚失败');
      }
    }
  };

  const toggleTag = (tagId: string) => {
    setFormData((prev) => ({
      ...prev,
      tags: prev.tags.includes(tagId)
        ? prev.tags.filter((t) => t !== tagId)
        : [...prev.tags, tagId],
    }));
  };

  const handleCreateLanguageVersion = async (targetLanguage: string) => {
    if (!id) return;
    try {
      const masterId = articleMasterId || id;
      const newArticle = {
        ...formData,
        title: `${formData.title} (${targetLanguage})`,
        language: targetLanguage,
        master_id: masterId,
        tags: formData.tags,
      };
      const res = await articlesApi.create(newArticle);
      if (confirm(`已创建${targetLanguage}版本，是否跳转到编辑页面？`)) {
        navigate(`/articles/${res.data.id}`);
      } else {
        loadArticle(id);
      }
    } catch (error) {
      console.error('创建语言版本失败:', error);
      alert('创建失败');
    }
  };

  if (loading) {
    return <div className="text-center py-10">加载中...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">
          {isNew ? '新建文章' : '编辑文章'}
        </h1>
        <div className="flex items-center gap-3">
          {!isNew && (
            <span className={`px-3 py-1 text-sm rounded-full status-${articleStatus}`}>
              {statusLabels[articleStatus]}
            </span>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                文章标题 *
              </label>
              <input
                type="text"
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="请输入文章标题"
              />
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                文章摘要
              </label>
              <textarea
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={3}
                value={formData.excerpt}
                onChange={(e) => setFormData({ ...formData, excerpt: e.target.value })}
                placeholder="请输入文章摘要"
              />
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                文章内容
              </label>
              <textarea
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={15}
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                placeholder="请输入文章内容（支持HTML）"
              />
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h3 className="text-sm font-medium text-gray-700 mb-4">发布设置</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">语言</label>
                  <select
                    className="w-full px-3 py-2 border rounded-lg"
                    value={formData.language}
                    onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                  >
                    <option value="zh-CN">简体中文</option>
                    <option value="en">English</option>
                    <option value="ja">日本語</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-gray-600 mb-1">分类</label>
                  <select
                    className="w-full px-3 py-2 border rounded-lg"
                    value={formData.category_id}
                    onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                  >
                    <option value="">选择分类</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-gray-600 mb-1">模板</label>
                  <select
                    className="w-full px-3 py-2 border rounded-lg"
                    value={formData.template_id}
                    onChange={(e) => setFormData({ ...formData, template_id: e.target.value })}
                  >
                    <option value="">选择模板</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h3 className="text-sm font-medium text-gray-700 mb-4">标签</h3>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleTag(tag.id)}
                    className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                      formData.tags.includes(tag.id)
                        ? 'bg-blue-500 text-white border-blue-500'
                        : 'bg-white text-gray-700 hover:border-blue-500'
                    }`}
                  >
                    {tag.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h3 className="text-sm font-medium text-gray-700 mb-4">封面图片</h3>
              <input
                type="text"
                className="w-full px-3 py-2 border rounded-lg text-sm"
                value={formData.cover_image}
                onChange={(e) => setFormData({ ...formData, cover_image: e.target.value })}
                placeholder="输入图片URL"
              />
            </div>

            {!isNew && (
              <div className="bg-white p-6 rounded-lg shadow-sm">
                <button
                  type="button"
                  onClick={() => setShowVersions(!showVersions)}
                  className="w-full text-left text-sm font-medium text-gray-700 mb-2 flex items-center justify-between"
                >
                  <span>版本历史 ({versions.length})</span>
                  <span>{showVersions ? '▲' : '▼'}</span>
                </button>
                {showVersions && versions.length > 0 && (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {versions.map((v) => (
                      <div
                        key={v.id}
                        className="p-2 bg-gray-50 rounded text-sm flex items-center justify-between"
                      >
                        <div>
                          <div className="font-medium">v{v.version_number}</div>
                          <div className="text-gray-500 text-xs">
                            {new Date(v.created_at).toLocaleString()}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRestoreVersion(v.id)}
                          className="text-blue-600 hover:text-blue-800 text-xs"
                        >
                          回滚
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {!isNew && (
              <div className="bg-white p-6 rounded-lg shadow-sm">
                <button
                  type="button"
                  onClick={() => setShowLanguageVersions(!showLanguageVersions)}
                  className="w-full text-left text-sm font-medium text-gray-700 mb-2 flex items-center justify-between"
                >
                  <span>多语言版本 ({languageVersions.length})</span>
                  <span>{showLanguageVersions ? '▲' : '▼'}</span>
                </button>
                {showLanguageVersions && (
                  <div className="space-y-3">
                    {languageVersions.length > 0 ? (
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {languageVersions.map((a) => (
                          <div
                            key={a.id}
                            className="p-2 bg-gray-50 rounded text-sm flex items-center justify-between"
                          >
                            <div>
                              <div className="font-medium text-gray-800">{a.title}</div>
                              <div className="text-gray-500 text-xs">
                                {a.language} · {statusLabels[a.status]}
                              </div>
                            </div>
                            <Link
                              to={`/articles/${a.id}`}
                              className="text-blue-600 hover:text-blue-800 text-xs"
                            >
                              编辑
                            </Link>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500 mb-3">暂无其他语言版本</div>
                    )}
                    <div className="pt-3 border-t">
                      <div className="text-sm text-gray-600 mb-2">创建新版本</div>
                      <div className="flex flex-wrap gap-2">
                        {formData.language !== 'en' && (
                          <button
                            type="button"
                            onClick={() => handleCreateLanguageVersion('en')}
                            className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded"
                          >
                            English
                          </button>
                        )}
                        {formData.language !== 'zh-CN' && (
                          <button
                            type="button"
                            onClick={() => handleCreateLanguageVersion('zh-CN')}
                            className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded"
                          >
                            简体中文
                          </button>
                        )}
                        {formData.language !== 'ja' && (
                          <button
                            type="button"
                            onClick={() => handleCreateLanguageVersion('ja')}
                            className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded"
                          >
                            日本語
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-3">
              <button
                type="submit"
                disabled={saving}
                className="w-full py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
              >
                {saving ? '保存中...' : '保存草稿'}
              </button>

              {!isNew && articleStatus === 'draft' && (
                <>
                  <button
                    type="button"
                    onClick={handleSubmitApproval}
                    className="w-full py-3 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600"
                  >
                    提交审批
                  </button>
                  <button
                    type="button"
                    onClick={handlePublish}
                    className="w-full py-3 bg-green-500 text-white rounded-lg hover:bg-green-600"
                  >
                    直接发布
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
