import { useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import BottomNav from "@/components/BottomNav";
import SearchBar from "@/components/SearchBar";
import AttractionCard from "@/components/AttractionCard";
import { mockAttractions } from "@/data/mockData";
import type { CategoryType } from "@/types";
import { CATEGORY_LABELS } from "@/types";

const categories: (CategoryType | "all")[] = ["all", "nature", "culture", "food", "shopping"];

export default function Explore() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const cityParam = searchParams.get("city") || "";
  const [keyword, setKeyword] = useState("");
  const [activeCategory, setActiveCategory] = useState<CategoryType | "all">("all");

  const filteredAttractions = useMemo(() => {
    return mockAttractions.filter((a) => {
      const matchSearch = !keyword || a.name.includes(keyword) || a.city.includes(keyword);
      const matchCategory = activeCategory === "all" || a.category === activeCategory;
      const matchCity = !cityParam || a.city === cityParam;
      return matchSearch && matchCategory && matchCity;
    });
  }, [keyword, activeCategory, cityParam]);

  return (
    <div className="max-w-lg mx-auto pb-20">
      <div className="pt-12 px-4">
        <h1 className="font-serif text-2xl font-bold text-ocean-800">探索景点</h1>
        <div className="mt-3">
          <SearchBar
            value={keyword}
            onChange={setKeyword}
            placeholder="搜索景点、城市..."
          />
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto hide-scrollbar px-4 mt-4">
        {categories.map((cat) => {
          const label = cat === "all" ? "全部" : CATEGORY_LABELS[cat];
          const active = activeCategory === cat;
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`flex-shrink-0 rounded-full px-4 py-1.5 text-sm transition-colors duration-200 ${
                active ? "bg-coral-500 text-white" : "bg-ocean-50 text-ocean-600"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 px-4 mt-4 md:grid-cols-2">
        {filteredAttractions.map((attraction) => (
          <AttractionCard
            key={attraction.id}
            attraction={attraction}
            onClick={() => navigate(`/attraction/${attraction.id}`)}
          />
        ))}
      </div>

      {filteredAttractions.length === 0 && (
        <div className="text-center py-16 text-ocean-400">没有找到匹配的景点</div>
      )}

      <BottomNav />
    </div>
  );
}
