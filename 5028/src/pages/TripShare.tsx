import { useState, useMemo, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Link, ImageIcon, Copy, Check } from "lucide-react";
import DayTag from "@/components/DayTag";
import DurationBadge from "@/components/DurationBadge";
import { mockAttractions } from "@/data/mockData";
import { useAppStore } from "@/store/useAppStore";

function getAttraction(id: string) {
  return mockAttractions.find((a) => a.id === id);
}

export default function TripShare() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const trips = useAppStore((s) => s.trips);
  const generateShareId = useAppStore((s) => s.generateShareId);
  const trip = trips.find((t) => t.id === id);

  const [copied, setCopied] = useState(false);
  const posterRef = useRef<HTMLDivElement>(null);

  const sortedDays = useMemo(
    () => [...(trip?.days ?? [])].sort((a, b) => a.order - b.order),
    [trip?.days]
  );

  const totalAttractions = useMemo(
    () => sortedDays.reduce((sum, d) => sum + d.attractions.length, 0),
    [sortedDays]
  );

  const shareLink = useMemo(() => {
    if (!trip?.shareId) return "";
    return `${window.location.origin}/share/${trip.shareId}`;
  }, [trip?.shareId]);

  const dateRange = useMemo(() => {
    if (sortedDays.length === 0) return "";
    const first = new Date(sortedDays[0].date);
    const last = new Date(sortedDays[sortedDays.length - 1].date);
    const fmt = (d: Date) => `${d.getMonth() + 1}月${d.getDate()}日`;
    return `${fmt(first)} - ${fmt(last)}`;
  }, [sortedDays]);

  const handleGenerateLink = useCallback(() => {
    if (!id) return;
    generateShareId(id);
  }, [id, generateShareId]);

  const handleCopy = useCallback(async () => {
    if (!shareLink) return;
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const input = document.createElement("input");
      input.value = shareLink;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [shareLink]);

  const handleDownloadPoster = useCallback(async () => {
    if (!posterRef.current) return;
    const html2canvas = (await import("html2canvas")).default;
    const canvas = await html2canvas(posterRef.current, {
      scale: 2,
      useCORS: true,
      backgroundColor: null,
    });
    const link = document.createElement("a");
    link.download = `${trip?.title ?? "行程海报"}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }, [trip?.title]);

  if (!trip) {
    return (
      <div className="max-w-lg mx-auto flex items-center justify-center h-screen">
        <p className="text-ocean-400">行程不存在</p>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto pb-8">
      <div className="px-4 pt-12 flex items-center">
        <button onClick={() => navigate(-1)}>
          <ArrowLeft size={24} className="text-ocean-600" />
        </button>
        <h1 className="font-serif text-lg font-semibold text-ocean-800 flex-1 text-center truncate mx-2">
          分享行程
        </h1>
        <div className="w-6" />
      </div>

      <div className="px-4 mt-4">
        <div className="card-base p-4">
          <img
            src={trip.coverImage}
            alt={trip.title}
            className="h-32 w-full rounded-lg object-cover mb-3"
          />
          <h2 className="font-serif text-xl font-bold text-ocean-800">{trip.title}</h2>
          <div className="flex items-center gap-2 mt-2">
            <DayTag
              dayNumber={0}
              date=""
              active={false}
            />
            <span className="text-xs text-ocean-500 bg-ocean-50 rounded-full px-2.5 py-1">
              {sortedDays.length}天 · {totalAttractions}个景点
            </span>
          </div>
          <div className="mt-3 space-y-1.5">
            {sortedDays.map((day, idx) => {
              const sorted = [...day.attractions].sort((a, b) => a.order - b.order);
              const names = sorted.map((ta) => getAttraction(ta.attractionId)?.name ?? "").filter(Boolean);
              return (
                <p key={day.id} className="text-xs text-ocean-500">
                  第{idx + 1}天{names.length > 0 ? ` - ${names.join("→")}` : ""}
                </p>
              );
            })}
          </div>
        </div>
      </div>

      <div className="px-4 mt-6">
        <h2 className="section-title">分享方式</h2>

        <div className="card-base p-4 mt-3">
          <div className="flex items-center gap-2 mb-3">
            <Link size={18} className="text-coral-500" />
            <span className="font-serif font-semibold text-ocean-800">分享链接</span>
          </div>
          {trip.shareId ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={shareLink}
                className="input-base text-xs flex-1"
              />
              <button
                onClick={handleCopy}
                className="btn-outline px-3 py-2 text-xs flex items-center gap-1 flex-shrink-0"
              >
                {copied ? (
                  <>
                    <Check size={14} />
                    已复制
                  </>
                ) : (
                  <>
                    <Copy size={14} />
                    复制
                  </>
                )}
              </button>
            </div>
          ) : (
            <button onClick={handleGenerateLink} className="btn-primary w-full text-sm">
              生成链接
            </button>
          )}
          {copied && (
            <p className="text-teal-500 text-xs mt-2">链接已复制到剪贴板</p>
          )}
        </div>

        <div className="card-base p-4 mt-3">
          <div className="flex items-center gap-2 mb-3">
            <ImageIcon size={18} className="text-coral-500" />
            <span className="font-serif font-semibold text-ocean-800">行程海报</span>
          </div>

          <div
            ref={posterRef}
            className="bg-gradient-to-b from-ocean-500 to-ocean-700 rounded-xl p-6 text-white"
          >
            <p className="font-serif text-lg opacity-90">途迹</p>
            <h3 className="font-serif text-2xl font-bold mt-2">{trip.title}</h3>
            <p className="text-sm mt-1 opacity-80">
              {sortedDays.length}天 · {dateRange}
            </p>
            <div className="mt-4 space-y-2">
              {sortedDays.map((day, idx) => {
                const sorted = [...day.attractions].sort((a, b) => a.order - b.order);
                return sorted.map((ta) => {
                  const attr = getAttraction(ta.attractionId);
                  if (!attr) return null;
                  return (
                    <div key={ta.id} className="flex items-center justify-between text-sm">
                      <span className="opacity-90">{idx + 1}. {attr.name}</span>
                      <DurationBadge minutes={ta.duration} />
                    </div>
                  );
                });
              })}
            </div>
          </div>

          <button
            onClick={handleDownloadPoster}
            className="btn-primary w-full mt-3 text-sm"
          >
            下载海报
          </button>
        </div>
      </div>

      <p className="text-center text-xs text-ocean-300 mt-6">
        朋友打开链接后可以查看完整行程并保存到自己的收藏夹
      </p>
    </div>
  );
}
