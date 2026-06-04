import type { NutritionSummary } from '@/types';

interface NutritionRingProps {
  nutrition: NutritionSummary;
}

const CX = 100;
const CY = 100;
const OUTER_R = 85;
const INNER_R = 58;

function polarToXY(r: number, angle: number) {
  return { x: CX + r * Math.cos(angle), y: CY - r * Math.sin(angle) };
}

function arcPath(start: number, end: number) {
  const os = polarToXY(OUTER_R, start);
  const oe = polarToXY(OUTER_R, end);
  const ie = polarToXY(INNER_R, end);
  const innerStart = polarToXY(INNER_R, start);
  const large = start - end > Math.PI ? 1 : 0;
  return [
    `M${os.x} ${os.y}`,
    `A${OUTER_R} ${OUTER_R} 0 ${large} 1 ${oe.x} ${oe.y}`,
    `L${ie.x} ${ie.y}`,
    `A${INNER_R} ${INNER_R} 0 ${large} 0 ${innerStart.x} ${innerStart.y}`,
    'Z',
  ].join(' ');
}

export default function NutritionRing({ nutrition }: NutritionRingProps) {
  const total = nutrition.calories + nutrition.protein + nutrition.fat + nutrition.carbs;

  const segments = [
    { value: nutrition.calories, color: '#E8722A', label: '热量', unit: 'kcal' },
    { value: nutrition.protein, color: '#FFC078', label: '蛋白质', unit: 'g' },
    { value: nutrition.fat, color: '#F5EDE3', label: '脂肪', unit: 'g' },
    { value: nutrition.carbs, color: '#7EBF8E', label: '碳水', unit: 'g' },
  ];

  let angle = Math.PI;
  const arcs = segments
    .filter(s => s.value > 0)
    .map(seg => {
      const prop = seg.value / total;
      const start = angle;
      const end = angle - prop * Math.PI;
      angle = end;
      return { ...seg, d: arcPath(start, end) };
    });

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 108" className="w-full max-w-[240px]">
        {total > 0 &&
          arcs.map((a, i) => (
            <path key={i} d={a.d} fill={a.color} />
          ))}
        {total === 0 && (
          <path
            d={arcPath(Math.PI, 0)}
            fill="#F5EDE3"
            opacity={0.4}
          />
        )}
        <text
          x={CX}
          y={CY - (OUTER_R + INNER_R) * 0.28}
          textAnchor="middle"
          fill="#3D2B1F"
          fontSize="22"
          fontWeight="700"
        >
          {nutrition.calories}
        </text>
        <text
          x={CX}
          y={CY - (OUTER_R + INNER_R) * 0.28 + 16}
          textAnchor="middle"
          fill="#8B7355"
          fontSize="11"
        >
          千卡
        </text>
      </svg>
      <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2">
        {segments.map(item => (
          <div key={item.label} className="flex items-center gap-2 text-sm">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-warm-muted">{item.label}</span>
            <span className="font-medium text-warm-brown">
              {item.value}
              {item.unit}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
