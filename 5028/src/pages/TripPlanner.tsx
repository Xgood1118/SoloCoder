import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  horizontalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowLeft, Share2, MoreVertical, GripVertical, X, Plus, Search, Car, Footprints, FileDown, CalendarDays } from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import DurationBadge from "@/components/DurationBadge";
import { mockAttractions } from "@/data/mockData";
import { useAppStore } from "@/store/useAppStore";
import type { TripAttraction } from "@/types";

function getAttraction(id: string) {
  return mockAttractions.find((a) => a.id === id);
}

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function estimateTransport(distanceKm: number): { mode: string; minutes: number } {
  if (distanceKm < 2) {
    return { mode: "walk", minutes: Math.round((distanceKm / 5) * 60) };
  }
  return { mode: "drive", minutes: Math.round((distanceKm / 30) * 60) };
}

function SortableItem({
  ta,
  onRemove,
}: {
  ta: TripAttraction;
  onRemove: (attractionId: string) => void;
}) {
  const attraction = getAttraction(ta.attractionId);
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: ta.attractionId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  if (!attraction) return null;

  return (
    <div ref={setNodeRef} style={style} className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className="w-3 h-3 bg-teal-500 rounded-full flex-shrink-0 mt-4" />
        <div className="w-0.5 flex-1 bg-teal-500" />
      </div>
      <div className="card-base p-3 flex-1 flex items-center gap-2 mb-2">
        <button ref={setActivatorNodeRef} {...attributes} {...listeners} className="touch-none">
          <GripVertical size={16} className="text-ocean-300" />
        </button>
        <img
          src={attraction.images[0]}
          alt={attraction.name}
          className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
        />
        <div className="flex-1 min-w-0">
          <p className="font-serif font-medium text-sm text-ocean-800 truncate">{attraction.name}</p>
          <DurationBadge minutes={ta.duration} />
        </div>
        <button
          onClick={() => onRemove(ta.attractionId)}
          className="p-1"
        >
          <X size={16} className="text-ocean-300" />
        </button>
      </div>
    </div>
  );
}

function SortableDayTag({
  day,
  dayNumber,
  active,
  onClick,
}: {
  day: { id: string; date: string };
  dayNumber: number;
  active: boolean;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: `day-${day.id}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} className="cursor-grab active:cursor-grabbing">
      <button
        onClick={onClick}
        {...attributes}
        {...listeners}
        className={
          `inline-flex flex-col items-center rounded-xl px-4 py-2 text-center transition-all duration-200 touch-none ${
            active ? "bg-coral-500 text-white" : "bg-ocean-50 text-ocean-600"
          }`
        }
      >
        <span className="text-xs font-medium">第{dayNumber}天</span>
        <span className="text-xs opacity-75">
          {new Date(day.date).getMonth() + 1}/{new Date(day.date).getDate()}
        </span>
      </button>
    </div>
  );
}

export default function TripPlanner() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const trips = useAppStore((s) => s.trips);
  const removeAttractionFromDay = useAppStore((s) => s.removeAttractionFromDay);
  const reorderAttractionsInDay = useAppStore((s) => s.reorderAttractionsInDay);
  const addAttractionToDay = useAppStore((s) => s.addAttractionToDay);
  const reorderDays = useAppStore((s) => s.reorderDays);

  const trip = trips.find((t) => t.id === id);
  const sortedDays = useMemo(
    () => [...(trip?.days ?? [])].sort((a, b) => a.order - b.order),
    [trip?.days]
  );

  const [activeDayIdx, setActiveDayIdx] = useState(0);
  const activeDay = sortedDays[activeDayIdx];

  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [showExportMenu, setShowExportMenu] = useState(false);

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  const sortedAttractions = useMemo(
    () => [...(activeDay?.attractions ?? [])].sort((a, b) => a.order - b.order),
    [activeDay?.attractions]
  );

  const totalDuration = useMemo(
    () => sortedAttractions.reduce((sum, a) => sum + a.duration, 0),
    [sortedAttractions]
  );

  const transportSegments = useMemo(() => {
    const segments: { mode: string; minutes: number }[] = [];
    for (let i = 0; i < sortedAttractions.length - 1; i++) {
      const curr = getAttraction(sortedAttractions[i].attractionId);
      const next = getAttraction(sortedAttractions[i + 1].attractionId);
      if (curr && next) {
        const dist = haversineDistance(curr.latitude, curr.longitude, next.latitude, next.longitude);
        segments.push(estimateTransport(dist));
      }
    }
    return segments;
  }, [sortedAttractions]);

  const totalTransportMinutes = useMemo(
    () => transportSegments.reduce((sum, s) => sum + s.minutes, 0),
    [transportSegments]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id || !trip) return;

      const activeId = active.id as string;
      const overId = over.id as string;

      if (activeId.startsWith("day-")) {
        if (!overId.startsWith("day-")) return;
        const dayIds = sortedDays.map((d) => `day-${d.id}`);
        const oldIndex = dayIds.indexOf(activeId);
        const newIndex = dayIds.indexOf(overId);
        if (oldIndex === -1 || newIndex === -1) return;
        const reordered = arrayMove(dayIds, oldIndex, newIndex).map((id) => id.replace("day-", ""));
        reorderDays(trip.id, reordered);
        if (activeDayIdx === oldIndex) {
          setActiveDayIdx(newIndex);
        } else if (oldIndex < activeDayIdx && newIndex >= activeDayIdx) {
          setActiveDayIdx(activeDayIdx - 1);
        } else if (oldIndex > activeDayIdx && newIndex <= activeDayIdx) {
          setActiveDayIdx(activeDayIdx + 1);
        }
      } else {
        if (!activeDay) return;
        const ids = sortedAttractions.map((a) => a.attractionId);
        const oldIndex = ids.indexOf(activeId);
        const newIndex = ids.indexOf(overId);
        if (oldIndex === -1 || newIndex === -1) return;
        const reordered = arrayMove(ids, oldIndex, newIndex);
        reorderAttractionsInDay(trip.id, activeDay.id, reordered);
      }
    },
    [trip, activeDay, sortedAttractions, sortedDays, activeDayIdx, reorderAttractionsInDay, reorderDays]
  );

  const handleRemove = useCallback(
    (attractionId: string) => {
      if (!trip || !activeDay) return;
      removeAttractionFromDay(trip.id, activeDay.id, attractionId);
    },
    [trip, activeDay, removeAttractionFromDay]
  );

  const handleAddAttraction = useCallback(
    (attractionId: string) => {
      if (!trip || !activeDay) return;
      const attraction = getAttraction(attractionId);
      if (!attraction) return;
      addAttractionToDay(trip.id, activeDay.id, attractionId, attraction.suggestedDuration);
      setShowAddModal(false);
      setSearchQuery("");
    },
    [trip, activeDay, addAttractionToDay]
  );

  useEffect(() => {
    if (!mapRef.current || !activeDay) return;
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }
    const map = L.map(mapRef.current, { zoomControl: false, attributionControl: false });
    mapInstanceRef.current = map;

    const points = sortedAttractions
      .map((ta) => getAttraction(ta.attractionId))
      .filter(Boolean) as { latitude: number; longitude: number; name: string }[];

    if (points.length > 0) {
      const latlngs: L.LatLngExpression[] = points.map((p) => [p.latitude, p.longitude]);
      const bounds = L.latLngBounds(latlngs as L.LatLngExpression[]);
      map.fitBounds(bounds, { padding: [20, 20] });

      points.forEach((p) => {
        L.circleMarker([p.latitude, p.longitude], {
          radius: 6,
          fillColor: "#FF6B35",
          color: "#fff",
          weight: 2,
          fillOpacity: 1,
        }).addTo(map);
      });

      if (points.length > 1) {
        L.polyline(latlngs, { color: "#1B9AAA", weight: 3, opacity: 0.8 }).addTo(map);
      }
    } else {
      map.setView([35.86, 104.19], 4);
    }

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [activeDay, sortedAttractions]);

  const filteredAttractions = useMemo(() => {
    const dayAttractionIds = new Set(sortedAttractions.map((a) => a.attractionId));
    return mockAttractions.filter(
      (a) =>
        !dayAttractionIds.has(a.id) &&
        (searchQuery.trim() === "" || a.name.includes(searchQuery.trim()) || a.city.includes(searchQuery.trim()))
    );
  }, [sortedAttractions, searchQuery]);

  const handleExportCalendar = useCallback(() => {
    if (!trip || !activeDay) return;
    const lines: string[] = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//TripTrail//CN"];
    sortedAttractions.forEach((ta) => {
      const attr = getAttraction(ta.attractionId);
      if (!attr) return;
      const dateStr = activeDay.date.replace(/-/g, "");
      const startHour = 9;
      const endMinutes = startHour * 60 + ta.duration;
      const endHour = Math.floor(endMinutes / 60);
      const endMin = endMinutes % 60;
      const pad = (n: number) => n.toString().padStart(2, "0");
      lines.push(
        "BEGIN:VEVENT",
        `DTSTART:${dateStr}T${pad(startHour)}0000`,
        `DTEND:${dateStr}T${pad(endHour)}${pad(endMin)}00`,
        `SUMMARY:${attr.name}`,
        "DESCRIPTION:行程规划",
        "END:VEVENT"
      );
    });
    lines.push("END:VCALENDAR");
    const blob = new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${trip.title}-${activeDay.date}.ics`;
    a.click();
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  }, [trip, activeDay, sortedAttractions]);

  const handleExportPDF = useCallback(async () => {
    if (!trip) return;
    const html2canvas = (await import("html2canvas")).default;
    const jsPDF = (await import("jspdf")).default;
    const el = document.getElementById("trip-content");
    if (!el) return;
    const canvas = await html2canvas(el, { scale: 2, useCORS: true });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");
    const pdfW = pdf.internal.pageSize.getWidth();
    const pdfH = (canvas.height * pdfW) / canvas.width;
    pdf.addImage(imgData, "PNG", 0, 0, pdfW, pdfH);
    pdf.save(`${trip.title}.pdf`);
    setShowExportMenu(false);
  }, [trip]);

  if (!trip) {
    return (
      <div className="max-w-lg mx-auto flex items-center justify-center h-screen">
        <p className="text-ocean-400">行程不存在</p>
      </div>
    );
  }

  const progressPercent = Math.min((totalDuration / 480) * 100, 100);
  const isOverTime = totalDuration > 480;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <div className="max-w-lg mx-auto pb-32">
        <div className="px-4 pt-12 flex items-center">
          <button onClick={() => navigate("/profile")}>
            <ArrowLeft size={24} className="text-ocean-600" />
          </button>
          <h1 className="font-serif text-lg font-semibold text-ocean-800 flex-1 text-center truncate mx-2">
            {trip.title}
          </h1>
          <button onClick={() => navigate(`/trip/${trip.id}/share`)} className="p-1">
            <Share2 size={20} className="text-ocean-600" />
          </button>
          <button className="p-1 ml-1">
            <MoreVertical size={20} className="text-ocean-400" />
          </button>
        </div>

        <SortableContext
          items={sortedDays.map((d) => `day-${d.id}`)}
          strategy={horizontalListSortingStrategy}
        >
          <div className="flex gap-2 overflow-x-auto hide-scrollbar px-4 mt-4">
            {sortedDays.map((day, idx) => (
              <SortableDayTag
                key={day.id}
                day={day}
                dayNumber={idx + 1}
                active={idx === activeDayIdx}
                onClick={() => setActiveDayIdx(idx)}
              />
            ))}
          </div>
        </SortableContext>

        <div id="trip-content" className="px-4 mt-4">
          {sortedAttractions.length > 0 && (
            <SortableContext
              items={sortedAttractions.map((a) => a.attractionId)}
              strategy={verticalListSortingStrategy}
            >
              {sortedAttractions.map((ta, idx) => (
                <div key={ta.attractionId}>
                  <SortableItem
                    ta={ta}
                    onRemove={handleRemove}
                  />
                  {idx < sortedAttractions.length - 1 && transportSegments[idx] && (
                    <div className="flex gap-3">
                      <div className="w-0.5 bg-teal-500" />
                      <div className="flex items-center gap-1 py-1 text-xs text-teal-500 mb-1">
                        {transportSegments[idx].mode === "walk" ? (
                          <Footprints size={12} />
                        ) : (
                          <Car size={12} />
                        )}
                        <span>
                          {transportSegments[idx].mode === "walk" ? "步行" : "驾车"}
                          {transportSegments[idx].minutes}分钟
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </SortableContext>
        )}

        {sortedAttractions.length > 0 && (
          <div className="flex">
            <div className="w-0.5 bg-teal-500" />
            <div className="w-3 h-3 bg-teal-500 rounded-full flex-shrink-0 -ml-[5px] mt-0" />
          </div>
        )}

        <button
          onClick={() => setShowAddModal(true)}
          className="btn-outline w-full mt-4 flex items-center justify-center gap-1"
        >
          <Plus size={16} />
          添加景点
        </button>
      </div>

      <div ref={mapRef} className="mt-4 mx-4 h-48 rounded-xl overflow-hidden bg-sand-100" />

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-sand-200 p-4 z-50">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 flex-1">
              <div className="bg-ocean-100 rounded-full h-2 flex-1">
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${isOverTime ? "bg-coral-500" : "bg-teal-500"}`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span className="text-xs text-ocean-500 whitespace-nowrap">
                {totalDuration}分钟 / 8小时
              </span>
            </div>
            <div className="relative ml-2">
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="btn-outline text-sm px-3 py-1.5 flex items-center gap-1"
              >
                <FileDown size={14} />
                导出
              </button>
              {showExportMenu && (
                <div className="absolute right-0 bottom-full mb-1 bg-white shadow-float rounded-xl py-1 min-w-[140px] z-10">
                  <button
                    onClick={handleExportCalendar}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm text-ocean-700 w-full hover:bg-sand-50"
                  >
                    <CalendarDays size={16} className="text-teal-500" />
                    导出日历
                  </button>
                  <button
                    onClick={handleExportPDF}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm text-ocean-700 w-full hover:bg-sand-50"
                  >
                    <FileDown size={16} className="text-teal-500" />
                    导出PDF
                  </button>
                </div>
              )}
            </div>
          </div>
          {isOverTime && (
            <p className="text-coral-500 text-xs">当天行程已超过8小时，建议精简安排</p>
          )}
          {totalTransportMinutes > 0 && (
            <p className="text-ocean-400 text-xs mt-0.5">
              预计交通时间约{totalTransportMinutes}分钟
            </p>
          )}
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 z-[60] flex items-end justify-center">
          <div className="bg-white rounded-t-2xl w-full max-w-lg max-h-[70vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-sand-200">
              <h3 className="font-serif text-lg font-semibold text-ocean-800">添加景点</h3>
              <button onClick={() => { setShowAddModal(false); setSearchQuery(""); }}>
                <X size={20} className="text-ocean-400" />
              </button>
            </div>
            <div className="px-4 pt-3">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ocean-300" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="搜索景点"
                  className="input-base pl-9"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
              {filteredAttractions.length === 0 ? (
                <p className="text-center text-ocean-400 text-sm py-8">没有找到可添加的景点</p>
              ) : (
                filteredAttractions.map((attr) => (
                  <button
                    key={attr.id}
                    onClick={() => handleAddAttraction(attr.id)}
                    className="card-base p-3 flex items-center gap-3 w-full"
                  >
                    <img
                      src={attr.images[0]}
                      alt={attr.name}
                      className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-sm font-medium text-ocean-800 truncate">{attr.name}</p>
                      <p className="text-xs text-ocean-400">{attr.city} · {Math.floor(attr.suggestedDuration / 60)}小时</p>
                    </div>
                    <Plus size={16} className="text-teal-500 flex-shrink-0" />
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
    </DndContext>
  );
}
