import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Clock, Banknote, Timer, Sun, Heart, Plus, X, CalendarDays, Check } from "lucide-react";
import StarRating from "@/components/StarRating";
import { mockAttractions } from "@/data/mockData";
import { useAppStore } from "@/store/useAppStore";
import { CATEGORY_LABELS, SEASON_LABELS } from "@/types";

export default function AttractionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [currentImage, setCurrentImage] = useState(0);
  const [showFavModal, setShowFavModal] = useState(false);
  const [favNote, setFavNote] = useState("");
  const [favGroup, setFavGroup] = useState("默认收藏");
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewContent, setReviewContent] = useState("");
  const [showTripModal, setShowTripModal] = useState(false);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);

  const attraction = mockAttractions.find((a) => a.id === id);

  const getFavoriteByAttraction = useAppStore((s) => s.getFavoriteByAttraction);
  const addFavorite = useAppStore((s) => s.addFavorite);
  const removeFavorite = useAppStore((s) => s.removeFavorite);
  const getReviewsByAttraction = useAppStore((s) => s.getReviewsByAttraction);
  const addReview = useAppStore((s) => s.addReview);
  const trips = useAppStore((s) => s.trips);
  const addAttractionToDay = useAppStore((s) => s.addAttractionToDay);

  const favorite = attraction ? getFavoriteByAttraction(attraction.id) : undefined;
  const reviews = attraction ? getReviewsByAttraction(attraction.id) : [];

  const avgRating = useMemo(() => {
    if (reviews.length === 0) return attraction?.rating ?? 0;
    return reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
  }, [reviews, attraction]);

  if (!attraction) {
    return (
      <div className="max-w-lg mx-auto flex items-center justify-center h-screen">
        <p className="text-ocean-400">景点不存在</p>
      </div>
    );
  }

  const isFavorited = !!favorite;

  const handleToggleFavorite = () => {
    if (isFavorited) {
      removeFavorite(favorite.id);
    } else {
      setShowFavModal(true);
    }
  };

  const handleConfirmFavorite = () => {
    addFavorite(attraction.id, favNote, favGroup);
    setShowFavModal(false);
    setFavNote("");
    setFavGroup("默认收藏");
  };

  const handleSubmitReview = () => {
    if (reviewRating === 0 || !reviewContent.trim()) return;
    addReview(attraction.id, reviewRating, reviewContent.trim());
    setReviewRating(0);
    setReviewContent("");
  };

  const handleAddToTrip = () => {
    setShowTripModal(true);
    setSelectedTripId(null);
    setSelectedDayId(null);
  };

  const handleConfirmAddToTrip = () => {
    if (!selectedTripId || !selectedDayId || !attraction) return;
    addAttractionToDay(selectedTripId, selectedDayId, attraction.id, attraction.suggestedDuration);
    setShowTripModal(false);
    setSelectedTripId(null);
    setSelectedDayId(null);
  };

  const selectedTrip = trips.find((t) => t.id === selectedTripId);

  const formatDuration = (mins: number) => {
    if (mins < 60) return `${mins}分钟`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}小时${m}分钟` : `${h}小时`;
  };

  return (
    <div className="max-w-lg mx-auto pb-24">
      <div className="relative h-64">
        <img
          src={attraction.images[currentImage]}
          alt={attraction.name}
          className="w-full h-full object-cover"
        />
        <button
          onClick={() => navigate(-1)}
          className="absolute top-12 left-4 bg-white/20 rounded-full p-2"
        >
          <ArrowLeft size={20} className="text-white" />
        </button>
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
          {attraction.images.map((_, i) => (
            <span
              key={i}
              className={`w-2 h-2 rounded-full ${
                i === currentImage ? "bg-white" : "bg-white/50"
              }`}
            />
          ))}
        </div>
      </div>

      <div className="px-4 -mt-6 relative z-10">
        <div className="bg-white rounded-t-2xl p-4">
          <h1 className="font-serif text-2xl font-bold">{attraction.name}</h1>
          <div className="flex items-center gap-2 mt-2">
            <span className="inline-flex items-center bg-ocean-50 text-ocean-600 text-xs rounded-full px-2.5 py-0.5">
              {attraction.city}
            </span>
            <span className="inline-flex items-center bg-coral-50 text-coral-600 text-xs rounded-full px-2.5 py-0.5">
              {CATEGORY_LABELS[attraction.category]}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <StarRating rating={avgRating} />
            <span className="text-sm font-medium">{avgRating.toFixed(1)}</span>
            <span className="text-xs text-ocean-400">{reviews.length}条评论</span>
          </div>
          <p className="text-sm text-ocean-700 mt-3 leading-relaxed">
            {attraction.description}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="bg-sand-50 rounded-xl p-3">
            <Clock size={18} className="text-teal-500" />
            <p className="text-xs text-ocean-400 mt-1">开放时间</p>
            <p className="text-sm font-medium">{attraction.openHours}</p>
          </div>
          <div className="bg-sand-50 rounded-xl p-3">
            <Banknote size={18} className="text-teal-500" />
            <p className="text-xs text-ocean-400 mt-1">门票价格</p>
            <p className="text-sm font-medium">
              {attraction.ticketPrice === 0 ? "免费" : `¥${attraction.ticketPrice}`}
            </p>
          </div>
          <div className="bg-sand-50 rounded-xl p-3">
            <Timer size={18} className="text-teal-500" />
            <p className="text-xs text-ocean-400 mt-1">建议时长</p>
            <p className="text-sm font-medium">{formatDuration(attraction.suggestedDuration)}</p>
          </div>
          <div className="bg-sand-50 rounded-xl p-3">
            <Sun size={18} className="text-teal-500" />
            <p className="text-xs text-ocean-400 mt-1">最佳季节</p>
            <p className="text-sm font-medium">
              {attraction.bestSeason.map((s) => SEASON_LABELS[s]).join("、")}
            </p>
          </div>
        </div>

        <div className="mt-6">
          <div className="flex items-center justify-between">
            <h2 className="section-title">用户评价</h2>
            <span className="text-xs text-ocean-400">{reviews.length}条</span>
          </div>
          <div className="flex items-center gap-3 mt-3">
            <span className="text-3xl font-bold text-ocean-800">{avgRating.toFixed(1)}</span>
            <StarRating rating={avgRating} size={20} />
          </div>
          <div className="mt-4 space-y-3">
            {reviews.map((review) => (
              <div key={review.id} className="card-base p-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{review.userAvatar}</span>
                  <span className="text-sm font-medium">{review.userName}</span>
                  <StarRating rating={review.rating} size={12} />
                  <span className="text-xs text-ocean-400 ml-auto">{review.createdAt}</span>
                </div>
                <p className="text-sm text-ocean-700 mt-2 leading-relaxed">{review.content}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <h3 className="text-sm font-medium text-ocean-800 mb-2">发表评价</h3>
          <StarRating rating={reviewRating} size={24} interactive onChange={setReviewRating} />
          <textarea
            value={reviewContent}
            onChange={(e) => setReviewContent(e.target.value)}
            placeholder="分享你的游览体验..."
            className="input-base mt-2 resize-none"
            rows={3}
          />
          <button
            onClick={handleSubmitReview}
            disabled={reviewRating === 0 || !reviewContent.trim()}
            className="btn-primary w-full mt-2 disabled:opacity-50 disabled:pointer-events-none"
          >
            提交评价
          </button>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-sand-200 p-4 z-50">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <button onClick={handleToggleFavorite} className="flex flex-col items-center gap-0.5">
            <Heart
              size={24}
              className={isFavorited ? "text-coral-500" : "text-ocean-400"}
              fill={isFavorited ? "currentColor" : "none"}
            />
            <span className="text-xs text-ocean-400">收藏</span>
          </button>
          <button onClick={handleAddToTrip} className="btn-primary flex-1">添加到行程</button>
        </div>
      </div>

      {showFavModal && (
        <div className="fixed inset-0 bg-black/40 z-[60] flex items-end justify-center">
          <div className="bg-white rounded-t-2xl w-full max-w-lg p-5">
            <h3 className="font-serif text-lg font-semibold text-ocean-800">添加收藏</h3>
            <div className="mt-4">
              <label className="text-sm text-ocean-600">备注</label>
              <textarea
                value={favNote}
                onChange={(e) => setFavNote(e.target.value)}
                placeholder="为什么想去这个景点..."
                className="input-base mt-1 resize-none"
                rows={3}
              />
            </div>
            <div className="mt-3">
              <label className="text-sm text-ocean-600">分组</label>
              <input
                type="text"
                value={favGroup}
                onChange={(e) => setFavGroup(e.target.value)}
                className="input-base mt-1"
              />
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => {
                  setShowFavModal(false);
                  setFavNote("");
                  setFavGroup("默认收藏");
                }}
                className="btn-outline flex-1"
              >
                取消
              </button>
              <button onClick={handleConfirmFavorite} className="btn-primary flex-1">
                确认收藏
              </button>
            </div>
          </div>
        </div>
      )}

      {showTripModal && (
        <div className="fixed inset-0 bg-black/40 z-[60] flex items-end justify-center">
          <div className="bg-white rounded-t-2xl w-full max-w-lg max-h-[70vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-sand-200">
              <h3 className="font-serif text-lg font-semibold text-ocean-800">
                {selectedTripId ? "选择日期" : "选择行程"}
              </h3>
              <button
                onClick={() => {
                  if (selectedTripId) {
                    setSelectedTripId(null);
                    setSelectedDayId(null);
                  } else {
                    setShowTripModal(false);
                  }
                }}
              >
                {selectedTripId ? (
                  <ArrowLeft size={20} className="text-ocean-400" />
                ) : (
                  <X size={20} className="text-ocean-400" />
                )}
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {!selectedTripId ? (
                trips.length === 0 ? (
                  <div className="text-center py-10">
                    <CalendarDays size={48} className="mx-auto text-ocean-200 mb-3" />
                    <p className="text-ocean-400 text-sm">还没有行程</p>
                    <button
                      onClick={() => {
                        setShowTripModal(false);
                        navigate("/trip/new");
                      }}
                      className="btn-primary mt-4"
                    >
                      创建新行程
                    </button>
                  </div>
                ) : (
                  trips.map((trip) => (
                    <button
                      key={trip.id}
                      onClick={() => setSelectedTripId(trip.id)}
                      className="card-base p-3 flex items-center gap-3 w-full text-left"
                    >
                      <img
                        src={trip.coverImage}
                        alt={trip.title}
                        className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-serif font-medium text-ocean-800 truncate">{trip.title}</p>
                        <p className="text-xs text-ocean-400">{trip.days.length}天 · {trip.days.reduce((sum, d) => sum + d.attractions.length, 0)}个景点</p>
                      </div>
                      <Plus size={16} className="text-teal-500 flex-shrink-0" />
                    </button>
                  ))
                )
              ) : selectedTrip ? (
                selectedTrip.days
                  .sort((a, b) => a.order - b.order)
                  .map((day, idx) => (
                    <button
                      key={day.id}
                      onClick={() => setSelectedDayId(day.id)}
                      className={`card-base p-3 flex items-center gap-3 w-full text-left ${
                        selectedDayId === day.id ? "ring-2 ring-coral-400" : ""
                      }`}
                    >
                      <div className="w-12 h-12 rounded-lg bg-ocean-50 flex items-center justify-center flex-shrink-0">
                        <span className="font-serif text-lg font-bold text-ocean-600">{idx + 1}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-serif font-medium text-ocean-800">第{idx + 1}天</p>
                        <p className="text-xs text-ocean-400">{day.date} · {day.attractions.length}个景点</p>
                      </div>
                      {selectedDayId === day.id && (
                        <Check size={18} className="text-coral-500 flex-shrink-0" />
                      )}
                    </button>
                  ))
              ) : null}
            </div>
            {selectedTripId && (
              <div className="p-4 border-t border-sand-200">
                <button
                  onClick={handleConfirmAddToTrip}
                  disabled={!selectedDayId}
                  className="btn-primary w-full disabled:opacity-50 disabled:pointer-events-none"
                >
                  确认添加
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
