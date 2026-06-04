import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Map, Heart, MessageSquare, Settings, ChevronRight, Plus } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import EmptyState from "@/components/EmptyState";
import { mockAttractions } from "@/data/mockData";
import { useAppStore } from "@/store/useAppStore";

export default function Profile() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"trips" | "favorites" | "reviews">("trips");

  const trips = useAppStore((s) => s.trips);
  const favorites = useAppStore((s) => s.favorites);
  const reviews = useAppStore((s) => s.reviews);

  const myReviews = reviews.filter((r) => r.userId === "current");

  const menuItems = [
    { icon: <Map size={20} className="text-teal-500" />, label: "我的行程", action: () => setActiveTab("trips") },
    { icon: <Heart size={20} className="text-teal-500" />, label: "我的收藏", action: () => navigate("/favorites") },
    { icon: <MessageSquare size={20} className="text-teal-500" />, label: "我的评论", action: () => setActiveTab("reviews") },
    { icon: <Settings size={20} className="text-teal-500" />, label: "设置", action: () => alert("设置功能开发中") },
  ];

  const getAttraction = (id: string) => mockAttractions.find((a) => a.id === id);

  return (
    <div className="max-w-lg mx-auto pb-20">
      <div className="pt-12 pb-6 px-4 bg-gradient-to-b from-ocean-500 to-ocean-600 text-center">
        <div className="w-16 h-16 bg-coral-500 rounded-full flex items-center justify-center text-2xl text-white mx-auto">
          😊
        </div>
        <p className="text-white font-serif text-xl font-semibold mt-2">旅行者</p>
        <p className="text-ocean-100 text-sm">探索世界的每一个角落</p>
      </div>

      <div className="flex justify-around px-4 -mt-4">
        <div className="card-base flex-1 mx-1 p-3 text-center">
          <p className="font-serif text-2xl font-bold text-coral-500">{trips.length}</p>
          <p className="text-xs text-ocean-400">行程</p>
        </div>
        <div className="card-base flex-1 mx-1 p-3 text-center">
          <p className="font-serif text-2xl font-bold text-coral-500">{favorites.length}</p>
          <p className="text-xs text-ocean-400">收藏</p>
        </div>
        <div className="card-base flex-1 mx-1 p-3 text-center">
          <p className="font-serif text-2xl font-bold text-coral-500">{myReviews.length}</p>
          <p className="text-xs text-ocean-400">评论</p>
        </div>
      </div>

      <div className="px-4 mt-6">
        {menuItems.map((item) => (
          <button
            key={item.label}
            onClick={item.action}
            className="card-base flex items-center p-4 mb-2 w-full"
          >
            {item.icon}
            <span className="text-sm font-medium ml-3 flex-1 text-left">{item.label}</span>
            <ChevronRight size={18} className="text-ocean-300" />
          </button>
        ))}
      </div>

      {activeTab === "trips" && (
        <div className="px-4 mt-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="section-title">我的行程</h2>
            <button
              onClick={() => navigate("/trip/new")}
              className="flex items-center text-coral-500 text-sm"
            >
              <Plus size={16} className="mr-1" />
              新建
            </button>
          </div>

          {trips.length === 0 ? (
            <EmptyState
              icon={<Map size={40} />}
              title="还没有行程"
              description="点击新建开始规划你的旅程"
              actionLabel="创建行程"
              onAction={() => navigate("/trip/new")}
            />
          ) : (
            trips.map((trip) => (
              <div
                key={trip.id}
                className="card-base p-4 mb-3 flex cursor-pointer"
                onClick={() => navigate(`/trip/${trip.id}`)}
              >
                <img
                  src={trip.coverImage}
                  alt={trip.title}
                  className="w-20 h-16 rounded-lg object-cover"
                />
                <div className="ml-3 flex-1 min-w-0">
                  <p className="font-serif font-semibold text-ocean-800 truncate">{trip.title}</p>
                  <span className="inline-block bg-coral-50 text-coral-500 text-xs rounded-full px-2 py-0.5 mt-1">
                    {trip.days.length}天
                  </span>
                  <p className="text-xs text-ocean-400 mt-1">
                    {new Date(trip.createdAt).toLocaleDateString("zh-CN")}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === "reviews" && (
        <div className="px-4 mt-6">
          <h2 className="section-title mb-3">我的评论</h2>
          {myReviews.length === 0 ? (
            <EmptyState
              icon={<MessageSquare size={40} />}
              title="还没有评论"
              description="去过的景点可以留下你的评价"
            />
          ) : (
            myReviews.map((review) => {
              const attraction = getAttraction(review.attractionId);
              return (
                <div key={review.id} className="card-base p-4 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{review.userAvatar}</span>
                    <span className="text-sm font-medium text-ocean-800">{review.userName}</span>
                    <span className="text-xs text-ocean-400 ml-auto">{review.createdAt}</span>
                  </div>
                  {attraction && (
                    <p
                      className="text-xs text-coral-500 mt-1 cursor-pointer"
                      onClick={() => navigate(`/attraction/${attraction.id}`)}
                    >
                      {attraction.name}
                    </p>
                  )}
                  <div className="flex items-center gap-0.5 mt-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <span
                        key={i}
                        className={`text-xs ${i < review.rating ? "text-coral-500" : "text-ocean-200"}`}
                      >
                        ★
                      </span>
                    ))}
                  </div>
                  <p className="text-sm text-ocean-700 mt-1">{review.content}</p>
                </div>
              );
            })
          )}
        </div>
      )}

      <BottomNav />
    </div>
  );
}
