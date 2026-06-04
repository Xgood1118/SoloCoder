import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Heart, Plus, Pencil, Trash2 } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import EmptyState from "@/components/EmptyState";
import { mockAttractions } from "@/data/mockData";
import { useAppStore } from "@/store/useAppStore";

export default function Favorites() {
  const navigate = useNavigate();
  const [activeGroup, setActiveGroup] = useState("全部");
  const [editModal, setEditModal] = useState<{ id: string; note: string; group: string } | null>(null);
  const [newGroupModal, setNewGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");

  const favorites = useAppStore((s) => s.favorites);
  const getGroups = useAppStore((s) => s.getGroups);
  const removeFavorite = useAppStore((s) => s.removeFavorite);
  const updateFavorite = useAppStore((s) => s.updateFavorite);

  const groups = getGroups();
  const filteredFavorites =
    activeGroup === "全部" ? favorites : favorites.filter((f) => f.group === activeGroup);

  const getAttraction = (attractionId: string) =>
    mockAttractions.find((a) => a.id === attractionId);

  const handleEditSave = () => {
    if (!editModal) return;
    updateFavorite(editModal.id, editModal.note, editModal.group);
    setEditModal(null);
  };

  const handleCreateGroup = () => {
    if (!newGroupName.trim()) return;
    setNewGroupModal(false);
    setNewGroupName("");
  };

  return (
    <div className="max-w-lg mx-auto pb-20">
      <div className="pt-12 px-4">
        <h1 className="font-serif text-2xl font-bold text-ocean-800">我的收藏</h1>
      </div>

      <div className="flex gap-2 overflow-x-auto hide-scrollbar px-4 mt-4 items-center">
        <button
          onClick={() => setActiveGroup("全部")}
          className={`flex-shrink-0 rounded-full px-4 py-1.5 text-sm transition-colors duration-200 ${
            activeGroup === "全部" ? "bg-coral-500 text-white" : "bg-ocean-50 text-ocean-600"
          }`}
        >
          全部
        </button>
        {groups.map((group) => (
          <button
            key={group}
            onClick={() => setActiveGroup(group)}
            className={`flex-shrink-0 rounded-full px-4 py-1.5 text-sm transition-colors duration-200 ${
              activeGroup === group ? "bg-coral-500 text-white" : "bg-ocean-50 text-ocean-600"
            }`}
          >
            {group}
          </button>
        ))}
        <button
          onClick={() => setNewGroupModal(true)}
          className="flex-shrink-0 flex items-center gap-1 text-coral-500 text-sm px-2 py-1.5"
        >
          <Plus size={14} />
          <span>新建分组</span>
        </button>
      </div>

      {filteredFavorites.length === 0 ? (
        <EmptyState
          icon={<Heart size={40} />}
          title="还没有收藏"
          description="浏览景点时点击收藏按钮添加"
        />
      ) : (
        <div className="px-4 mt-4 space-y-3">
          {filteredFavorites.map((fav) => {
            const attraction = getAttraction(fav.attractionId);
            if (!attraction) return null;
            return (
              <div
                key={fav.id}
                className="card-base flex p-3"
                onClick={() => navigate(`/attraction/${attraction.id}`)}
              >
                <img
                  src={attraction.images[0]}
                  alt={attraction.name}
                  className="w-20 h-16 rounded-lg object-cover"
                />
                <div className="ml-3 flex-1 min-w-0">
                  <p className="font-serif font-semibold text-ocean-800">{attraction.name}</p>
                  {fav.note && (
                    <p className="text-xs text-ocean-500 truncate mt-0.5">{fav.note}</p>
                  )}
                  <span className="inline-block bg-ocean-50 text-ocean-600 text-xs rounded-full px-2 py-0.5 mt-1">
                    {fav.group}
                  </span>
                </div>
                <div className="flex flex-col justify-center gap-2 ml-2" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => setEditModal({ id: fav.id, note: fav.note, group: fav.group })}
                    className="text-ocean-400 hover:text-ocean-600"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => removeFavorite(fav.id)}
                    className="text-red-400 hover:text-red-600"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <BottomNav />

      {editModal && (
        <div className="fixed inset-0 bg-black/40 z-[60] flex items-end justify-center">
          <div className="bg-white rounded-t-2xl w-full max-w-lg p-5">
            <h3 className="font-serif text-lg font-semibold text-ocean-800">编辑备注</h3>
            <div className="mt-4">
              <label className="text-sm text-ocean-600">备注</label>
              <textarea
                value={editModal.note}
                onChange={(e) => setEditModal({ ...editModal, note: e.target.value })}
                className="input-base mt-1 resize-none"
                rows={3}
              />
            </div>
            <div className="mt-3">
              <label className="text-sm text-ocean-600">分组</label>
              <input
                type="text"
                value={editModal.group}
                onChange={(e) => setEditModal({ ...editModal, group: e.target.value })}
                className="input-base mt-1"
              />
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setEditModal(null)} className="btn-outline flex-1">
                取消
              </button>
              <button onClick={handleEditSave} className="btn-primary flex-1">
                确认
              </button>
            </div>
          </div>
        </div>
      )}

      {newGroupModal && (
        <div className="fixed inset-0 bg-black/40 z-[60] flex items-end justify-center">
          <div className="bg-white rounded-t-2xl w-full max-w-lg p-5">
            <h3 className="font-serif text-lg font-semibold text-ocean-800">新建分组</h3>
            <div className="mt-4">
              <label className="text-sm text-ocean-600">分组名称</label>
              <input
                type="text"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="输入分组名称"
                className="input-base mt-1"
              />
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => { setNewGroupModal(false); setNewGroupName(""); }} className="btn-outline flex-1">
                取消
              </button>
              <button onClick={handleCreateGroup} className="btn-primary flex-1">
                创建
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
