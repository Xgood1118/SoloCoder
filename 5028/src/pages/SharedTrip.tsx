import { useParams, useNavigate } from "react-router-dom";
import { useAppStore } from "@/store/useAppStore";
import { mockAttractions } from "@/data/mockData";
import { ArrowLeft, BookmarkPlus } from "lucide-react";
import DurationBadge from "@/components/DurationBadge";
import EmptyState from "@/components/EmptyState";
import { useEffect, useState } from "react";

export default function SharedTrip() {
  const { shareId } = useParams<{ shareId: string }>();
  const navigate = useNavigate();
  const { getTripByShareId, addFavorite } = useAppStore();
  const trip = getTripByShareId(shareId || "");

  const [saved, setSaved] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  if (!trip) {
    return (
      <div className="max-w-lg mx-auto min-h-screen">
        <div className="px-4 pt-12 flex items-center">
          <button onClick={() => navigate("/")} className="p-2 -ml-2">
            <ArrowLeft className="w-5 h-5 text-ocean-500" />
          </button>
        </div>
        <EmptyState
          icon={<BookmarkPlus className="w-12 h-12 text-ocean-200" />}
          title="行程不存在或链接已失效"
          description="请确认分享链接是否正确"
          actionLabel="返回首页"
          onAction={() => navigate("/")}
        />
      </div>
    );
  }

  const getAttraction = (id: string) => mockAttractions.find((a) => a.id === id);

  const handleSaveAll = () => {
    trip.days.forEach((day) => {
      day.attractions.forEach((ta) => {
        const existing = useAppStore.getState().getFavoriteByAttraction(ta.attractionId);
        if (!existing) {
          addFavorite(ta.attractionId, `来自行程：${trip.title}`, "默认收藏");
        }
      });
    });
    setSaved(true);
  };

  return (
    <div className="max-w-lg mx-auto min-h-screen bg-sand-50 pb-8">
      <div className="relative h-48">
        <img
          src={trip.coverImage}
          alt={trip.title}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-ocean-900/40 to-ocean-900/80" />
        <div className="absolute top-12 left-4">
          <button onClick={() => navigate("/")} className="bg-white/20 rounded-full p-2">
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
        </div>
        <div className="absolute bottom-4 left-4 right-4">
          <h1 className="font-serif text-2xl font-bold text-white">{trip.title}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="bg-coral-500 text-white text-xs px-2 py-0.5 rounded-full">
              {trip.days.length}天行程
            </span>
          </div>
        </div>
      </div>

      <div className="px-4 mt-4 space-y-4">
        {trip.days
          .sort((a, b) => a.order - b.order)
          .map((day, idx) => (
            <div key={day.id} className="card-base p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="bg-teal-500 text-white text-xs px-2 py-0.5 rounded-full">
                  第{idx + 1}天
                </span>
                <span className="text-xs text-ocean-400">{day.date}</span>
              </div>
              <div className="space-y-2">
                {day.attractions
                  .sort((a, b) => a.order - b.order)
                  .map((ta) => {
                    const attraction = getAttraction(ta.attractionId);
                    if (!attraction) return null;
                    return (
                      <div key={ta.id} className="flex items-center gap-3 p-2 rounded-lg bg-sand-50">
                        <img
                          src={attraction.images[0]}
                          alt={attraction.name}
                          className="w-12 h-12 rounded-lg object-cover"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-serif font-medium text-sm truncate">
                            {attraction.name}
                          </p>
                          <DurationBadge minutes={ta.duration} />
                        </div>
                      </div>
                    );
                  })}
                {day.attractions.length === 0 && (
                  <p className="text-xs text-ocean-300 text-center py-2">暂无景点安排</p>
                )}
              </div>
            </div>
          ))}
      </div>

      <div className="px-4 mt-6">
        <button
          onClick={handleSaveAll}
          disabled={saved}
          className={`w-full py-3 rounded-full font-medium transition-all duration-200 flex items-center justify-center gap-2 ${
            saved
              ? "bg-teal-500 text-white"
              : "btn-primary"
          }`}
        >
          <BookmarkPlus className="w-4 h-4" />
          {saved ? "已保存到收藏夹" : "保存行程到我的收藏"}
        </button>
      </div>
    </div>
  );
}
