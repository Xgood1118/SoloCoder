import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, BookOpen, Shield, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import AdminKnowledge from '@/components/AdminKnowledge';
import AdminSensitiveWords from '@/components/AdminSensitiveWords';
import AdminUsers from '@/components/AdminUsers';

const tabs = [
  { key: 'knowledge', label: '知识库管理', icon: BookOpen },
  { key: 'sensitive', label: '敏感词管理', icon: Shield },
  { key: 'users', label: '用户管理', icon: Users },
] as const;

type TabKey = typeof tabs[number]['key'];

export default function Admin() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabKey>('knowledge');

  return (
    <div className="flex h-screen flex-col bg-dark-900">
      <div className="flex items-center gap-4 border-b border-dark-600 bg-dark-800 px-6 py-4">
        <button onClick={() => navigate('/')} className="text-light-300 transition-colors hover:text-light-100">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-semibold text-light-100">管理后台</h1>
      </div>

      <div className="flex gap-1 border-b border-dark-600 bg-dark-800 px-6">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm transition-colors',
              activeTab === tab.key
                ? 'border-primary text-primary'
                : 'border-transparent text-light-300 hover:text-light-100'
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'knowledge' && <AdminKnowledge />}
        {activeTab === 'sensitive' && <AdminSensitiveWords />}
        {activeTab === 'users' && <AdminUsers />}
      </div>
    </div>
  );
}
