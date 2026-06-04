import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Heart } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import { mockCities, mockFeaturedTrips } from "@/data/mockData";

export default function Home() {
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState("");

  const handleSearch = () => {
    if (keyword.trim()) {
      navigate(`/explore?q=${encodeURIComponent(keyword.trim())}`);
    } else {
      navigate("/explore");
    }
  };

  return (
    <div className="max-w-lg mx-auto pb-20">
      <div className="bg-gradient-to-b from-ocean-500 to-ocean-700 pt-12 pb-8 px-4 text-white">
        <h1 className="font-serif text-3xl font-bold">途迹</h1>
        <p className="text-ocean-100 text-sm mt-1">规划你的下一段旅程</p>
        <div className="mt-4 relative flex items-center">
          <Search size={18} className="absolute left-3.5 text-white/60 pointer-events-none" />
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="搜索景点、城市..."
            className="w-full bg-white/20 border-0 rounded-xl px-4 py-3 pl-10 text-sm text-white placeholder:text-white/60 focus:ring-2 focus:ring-white/40 focus:bg-white/30 transition-all duration-200 outline-none"
          />
        </div>
      </div>

      <div className="px-4 mt-6">
        <div className="flex items-center justify-between">
          <h2 className="section-title">热门目的地</h2>
          <button onClick={() => navigate("/explore")} className="text-coral-500 text-sm">
            查看全部
          </button>
        </div>
        <div className="flex gap-4 overflow-x-auto hide-scrollbar mt-3">
          {mockCities.map((city) => (
            <button
              key={city.name}
              onClick={() => navigate(`/explore?city=${city.name}`)}
              className="w-40 flex-shrink-0 h-52 rounded-2xl overflow-hidden relative"
            >
              <img
                src={city.image}
                alt={city.name}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <div className="absolute bottom-3 left-3 text-white">
                <p className="font-serif font-semibold text-lg">{city.name}</p>
                <p className="text-xs text-white/80">{city.count}个景点</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 mt-8">
        <h2 className="section-title">精选行程</h2>
        <div className="mt-3">
          {mockFeaturedTrips.map((trip) => (
            <div key={trip.id} className="card-base p-4 mb-4">
              <div className="flex gap-3">
                <img
                  src={trip.cover}
                  alt={trip.title}
                  className="w-24 h-20 rounded-lg object-cover flex-shrink-0"
                />
                <div className="flex flex-col justify-between min-w-0">
                  <h3 className="font-serif font-semibold text-ocean-800 truncate">
                    {trip.title}
                  </h3>
                  <span className="self-start bg-coral-50 text-coral-500 text-xs rounded-full px-2 py-0.5">
                    {trip.days}天
                  </span>
                  <div className="flex items-center gap-1 text-sm text-ocean-400">
                    <span>{trip.author}</span>
                    <span className="mx-1">·</span>
                    <Heart size={14} className="text-coral-400" />
                    <span>{trip.likes}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
