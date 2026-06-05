import React, { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { useMonitorStore } from '../store/useMonitorStore';
import type { DataPoint, DownsampleInterval } from '../types';

const PLAYBACK_SPEEDS = [1, 2, 5, 10];
const DOWNSAMPLE_OPTIONS: { value: DownsampleInterval | null; label: string }[] = [
  { value: null, label: '原始数据' },
  { value: '1m', label: '1分钟' },
  { value: '5m', label: '5分钟' },
  { value: '1h', label: '1小时' },
  { value: '1d', label: '1天' },
];

export const PlaybackControls: React.FC = () => {
  const isPlaybackMode = useMonitorStore((state) => state.isPlaybackMode);
  const playbackSpeed = useMonitorStore((state) => state.playbackSpeed);
  const isPlaying = useMonitorStore((state) => state.isPlaying);
  const selectedMetric = useMonitorStore((state) => state.selectedMetric);

  const setPlaybackMode = useMonitorStore((state) => state.setPlaybackMode);
  const setPlaybackRange = useMonitorStore((state) => state.setPlaybackRange);
  const setPlaybackSpeed = useMonitorStore((state) => state.setPlaybackSpeed);
  const setPlaying = useMonitorStore((state) => state.setPlaying);
  const addDataPoints = useMonitorStore((state) => state.addDataPoints);
  const clearData = useMonitorStore((state) => state.clearData);

  const [startDate, setStartDate] = useState<string>(
    format(Date.now() - 3600000, "yyyy-MM-dd'T'HH:mm")
  );
  const [endDate, setEndDate] = useState<string>(
    format(Date.now(), "yyyy-MM-dd'T'HH:mm")
  );
  const [downsample, setDownsample] = useState<DownsampleInterval | null>('1m');
  const [currentPosition, setCurrentPosition] = useState<number>(0);
  const [playbackData, setPlaybackData] = useState<DataPoint[]>([]);
  const [loading, setLoading] = useState(false);

  const loadHistoricalData = useCallback(async () => {
    setLoading(true);
    try {
      const start = new Date(startDate).getTime();
      const end = new Date(endDate).getTime();

      const params = new URLSearchParams({
        metricName: selectedMetric,
        startTime: start.toString(),
        endTime: end.toString(),
        aggregationType: 'avg',
      });
      if (downsample) {
        params.append('downsample', downsample);
      }

      const response = await fetch(`/api/historical?${params}`);
      const data = await response.json();

      setPlaybackData(data.data);
      setPlaybackRange(start, end);
      setCurrentPosition(0);
      clearData();
    } catch (error) {
      console.error('Error loading historical data:', error);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, selectedMetric, downsample, setPlaybackRange, clearData]);

  useEffect(() => {
    if (!isPlaybackMode || !isPlaying || playbackData.length === 0) return;

    const interval = setInterval(() => {
      setCurrentPosition((prev) => {
        const next = Math.min(prev + playbackSpeed, playbackData.length);
        const pointsToAdd = playbackData.slice(prev, next);
        if (pointsToAdd.length > 0) {
          const aggregatedPoints: DataPoint[] = pointsToAdd.map((p) => ({
            ...p,
            metricName: selectedMetric,
          }));
          addDataPoints(aggregatedPoints);
        }
        if (next >= playbackData.length) {
          setPlaying(false);
        }
        return next;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [isPlaybackMode, isPlaying, playbackSpeed, playbackData, selectedMetric, addDataPoints, setPlaying]);

  const handleTogglePlayback = () => {
    if (!isPlaybackMode) {
      setPlaybackMode(true);
      loadHistoricalData();
    } else {
      setPlaybackMode(false);
      setPlaying(false);
      setPlaybackData([]);
    }
  };

  const handlePlayPause = () => {
    if (currentPosition >= playbackData.length) {
      setCurrentPosition(0);
      clearData();
    }
    setPlaying(!isPlaying);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const position = parseInt(e.target.value, 10);
    setCurrentPosition(position);
    clearData();
    const pointsToAdd = playbackData.slice(0, position);
    if (pointsToAdd.length > 0) {
      addDataPoints(
        pointsToAdd.map((p) => ({
          ...p,
          metricName: selectedMetric,
        }))
      );
    }
  };

  const progress = playbackData.length > 0 ? (currentPosition / playbackData.length) * 100 : 0;

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">历史回放</h3>
        <button
          onClick={handleTogglePlayback}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            isPlaybackMode
              ? 'bg-gray-200 text-gray-800 hover:bg-gray-300'
              : 'bg-blue-500 text-white hover:bg-blue-600'
          }`}
        >
          {isPlaybackMode ? '返回实时' : '历史回放'}
        </button>
      </div>

      {isPlaybackMode && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                开始时间
              </label>
              <input
                type="datetime-local"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
                disabled={isPlaying}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                结束时间
              </label>
              <input
                type="datetime-local"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
                disabled={isPlaying}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                降采样
              </label>
              <select
                value={downsample || ''}
                onChange={(e) =>
                  setDownsample((e.target.value as DownsampleInterval) || null)
                }
                className="w-full px-3 py-2 border rounded-lg"
                disabled={isPlaying}
              >
                {DOWNSAMPLE_OPTIONS.map((opt) => (
                  <option key={opt.label} value={opt.value || ''}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                播放速度
              </label>
              <div className="flex gap-1">
                {PLAYBACK_SPEEDS.map((speed) => (
                  <button
                    key={speed}
                    onClick={() => setPlaybackSpeed(speed)}
                    className={`flex-1 py-2 rounded text-sm font-medium transition-colors ${
                      playbackSpeed === speed
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 hover:bg-gray-200'
                    }`}
                    disabled={isPlaying}
                  >
                    {speed}x
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button
            onClick={loadHistoricalData}
            disabled={isPlaying || loading}
            className="w-full py-2 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {loading ? '加载中...' : '加载数据'}
          </button>

          <div className="flex items-center gap-4">
            <button
              onClick={handlePlayPause}
              disabled={playbackData.length === 0}
              className="px-6 py-2 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 transition-colors disabled:opacity-50"
            >
              {isPlaying ? '⏸ 暂停' : '▶ 播放'}
            </button>
            <div className="flex-1">
              <input
                type="range"
                min="0"
                max={playbackData.length}
                value={currentPosition}
                onChange={handleSeek}
                className="w-full"
                disabled={isPlaying}
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>{progress.toFixed(1)}%</span>
                <span>{currentPosition} / {playbackData.length} 点</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
