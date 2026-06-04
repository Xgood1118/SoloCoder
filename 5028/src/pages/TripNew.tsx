import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Minus, Plus } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";

export default function TripNew() {
  const navigate = useNavigate();
  const createTrip = useAppStore((s) => s.createTrip);

  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState("");
  const [days, setDays] = useState(3);

  const handleCreate = () => {
    if (!title.trim() || !startDate) return;
    const tripId = createTrip(title.trim(), startDate, days);
    navigate(`/trip/${tripId}`);
  };

  return (
    <div className="max-w-lg mx-auto">
      <div className="pt-12 px-4 flex items-center gap-3">
        <button onClick={() => navigate(-1)}>
          <ArrowLeft size={24} className="text-ocean-600" />
        </button>
        <h1 className="font-serif text-lg font-semibold text-ocean-800">创建行程</h1>
      </div>

      <div className="px-4 mt-6 space-y-4">
        <div>
          <label className="text-sm text-ocean-600 mb-1 block">行程名称</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="给行程取个名字"
            className="input-base"
          />
        </div>

        <div>
          <label className="text-sm text-ocean-600 mb-1 block">出发日期</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="input-base"
          />
        </div>

        <div>
          <label className="text-sm text-ocean-600 mb-1 block">天数</label>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setDays((d) => Math.max(1, d - 1))}
              className="w-10 h-10 rounded-xl bg-ocean-50 flex items-center justify-center text-ocean-600 active:bg-ocean-100"
            >
              <Minus size={18} />
            </button>
            <span className="text-2xl font-serif font-semibold text-ocean-800 w-8 text-center">
              {days}
            </span>
            <button
              onClick={() => setDays((d) => Math.min(7, d + 1))}
              className="w-10 h-10 rounded-xl bg-ocean-50 flex items-center justify-center text-ocean-600 active:bg-ocean-100"
            >
              <Plus size={18} />
            </button>
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-sand-200 z-50">
        <div className="max-w-lg mx-auto">
          <button
            onClick={handleCreate}
            disabled={!title.trim() || !startDate}
            className="btn-primary w-full disabled:opacity-50 disabled:pointer-events-none"
          >
            开始规划
          </button>
        </div>
      </div>
    </div>
  );
}
