"use client";

import { Schedule } from "@/lib/types";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const TIME_LABELS = [
  "08:00 AM",
  "08:30 AM",
  "09:00 AM",
  "09:30 AM",
  "10:00 AM",
  "10:30 AM",
  "11:00 AM",
  "11:30 AM",
  "12:00 PM",
  "12:30 PM",
  "01:00 PM",
  "01:30 PM",
  "02:00 PM",
  "02:30 PM",
  "03:00 PM",
  "03:30 PM",
  "04:00 PM",
];

const SLOT_HEIGHT_PX = 56;
const TIME_COLUMN_WIDTH_PX = 110;
const DAY_COLUMN_MIN_WIDTH_PX = 240;
const CARD_GAP_PX = 8;
const DAY_HEIGHT_PX = (TIME_LABELS.length - 1) * SLOT_HEIGHT_PX;

const CLASS_TYPE_COLORS: Record<string, string> = {
  Lecture:
    "bg-blue-50 border-blue-300 text-blue-900 dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-100",
  Tutorial:
    "bg-green-50 border-green-300 text-green-900 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-100",
  Workshop:
    "bg-purple-50 border-purple-300 text-purple-900 dark:bg-violet-950/30 dark:border-violet-800 dark:text-violet-100",
};

type PositionedSchedule = {
  schedule: Schedule;
  top: number;
  height: number;
  column: number;
  columns: number;
};

function timeToIndex(time: string): number {
  return TIME_LABELS.indexOf(time);
}

function getPositionedSchedules(daySchedules: Schedule[]): PositionedSchedule[] {
  const items = daySchedules
    .map((schedule) => ({
      schedule,
      start: timeToIndex(schedule.startTime),
      end: timeToIndex(schedule.endTime),
    }))
    .filter((item) => item.start >= 0 && item.end > item.start)
    .sort((left, right) => left.start - right.start || left.end - right.end);

  const positioned: PositionedSchedule[] = [];
  let active: Array<(typeof items)[number] & { column: number }> = [];
  let cluster: Array<(typeof items)[number] & { column: number }> = [];
  let clusterColumns = 1;

  const flushCluster = () => {
    if (cluster.length === 0) {
      return;
    }

    for (const item of cluster) {
      positioned.push({
        schedule: item.schedule,
        top: item.start * SLOT_HEIGHT_PX,
        height: (item.end - item.start) * SLOT_HEIGHT_PX,
        column: item.column,
        columns: clusterColumns,
      });
    }

    cluster = [];
    clusterColumns = 1;
  };

  for (const item of items) {
    active = active.filter((entry) => entry.end > item.start);

    if (active.length === 0) {
      flushCluster();
    }

    const usedColumns = new Set(active.map((entry) => entry.column));
    let column = 0;
    while (usedColumns.has(column)) {
      column += 1;
    }

    const positionedItem = { ...item, column };
    active.push(positionedItem);
    cluster.push(positionedItem);
    clusterColumns = Math.max(clusterColumns, active.length, column + 1);
  }

  flushCluster();
  return positioned;
}

function getCardStyle(item: PositionedSchedule) {
  const width = `calc((100% - ${(item.columns + 1) * CARD_GAP_PX}px) / ${item.columns})`;
  const left = `calc(${CARD_GAP_PX}px + ${item.column} * (${width} + ${CARD_GAP_PX}px))`;

  return {
    top: `${item.top + CARD_GAP_PX}px`,
    left,
    width,
    height: `${Math.max(item.height - CARD_GAP_PX * 2, SLOT_HEIGHT_PX - CARD_GAP_PX * 2)}px`,
  };
}

function TimeAxis() {
  return (
    <div
      className="relative border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900"
      style={{ height: `${DAY_HEIGHT_PX}px` }}
    >
      {TIME_LABELS.map((time, index) => (
        <div
          key={time}
          className="absolute inset-x-0"
          style={{ top: `${index * SLOT_HEIGHT_PX}px` }}
        >
          <div
            className="px-6 text-xs font-mono text-gray-500 dark:text-gray-400"
            style={{
              transform:
                index === 0
                  ? "translateY(0)"
                  : index === TIME_LABELS.length - 1
                    ? "translateY(-100%)"
                    : "translateY(-50%)",
            }}
          >
            {time}
          </div>
        </div>
      ))}
    </div>
  );
}

function DayColumn({ day, schedules }: { day: string; schedules: Schedule[] }) {
  const positioned = getPositionedSchedules(schedules);

  return (
    <div
      className="relative border-r border-gray-200 dark:border-gray-800 last:border-r-0"
      style={{ height: `${DAY_HEIGHT_PX}px` }}
    >


      {positioned.map((item) => (
        <div key={item.schedule.id} className="absolute z-10" style={getCardStyle(item)}>
          <div
            className={`flex h-full flex-col overflow-hidden rounded-lg border px-2.5 py-2 text-xs shadow-sm ${CLASS_TYPE_COLORS[item.schedule.classType] || "bg-gray-50 border-gray-300 text-gray-900 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"}`}
          >
            <div className="font-bold text-sm leading-tight tracking-tight">
              {item.schedule.moduleCode}
            </div>
            <div className="mt-0.5 truncate text-[11px] opacity-80">
              {item.schedule.moduleTitle}
            </div>
            <div className="mt-1 text-[11px] leading-snug">{item.schedule.instructor}</div>
            <div className="text-[11px] leading-snug opacity-75">
              {item.schedule.room} | {item.schedule.group}
            </div>
            <div className="mt-auto pt-1 text-[11px] opacity-75">
              {item.schedule.startTime} - {item.schedule.endTime}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

interface TimetableViewProps {
  schedules: Schedule[];
}

export default function TimetableView({ schedules }: TimetableViewProps) {
  if (schedules.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        <p className="text-lg font-medium">No schedules to display</p>
        <p className="text-sm">Try adjusting your filters</p>
      </div>
    );
  }

  const groupedByDay = Object.fromEntries(
    DAYS.map((day) => [day, schedules.filter((schedule) => schedule.day === day)]),
  ) as Record<string, Schedule[]>;

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
      <div className="overflow-x-auto">
        <div
          className="min-w-max"
          style={{
            minWidth: `${TIME_COLUMN_WIDTH_PX + DAYS.length * DAY_COLUMN_MIN_WIDTH_PX}px`,
          }}
        >
          <div
            className="grid border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/80"
            style={{
              gridTemplateColumns: `${TIME_COLUMN_WIDTH_PX}px repeat(${DAYS.length}, minmax(${DAY_COLUMN_MIN_WIDTH_PX}px, 1fr))`,
            }}
          >
            <div className="px-6 py-4 text-left text-xs font-semibold uppercase text-gray-600 dark:text-gray-300 border-r border-gray-200 dark:border-gray-800">
              Time
            </div>
            {DAYS.map((day) => (
              <div
                key={day}
                className="px-4 py-4 text-center text-xs font-semibold uppercase text-gray-600 dark:text-gray-300 border-r border-gray-200 dark:border-gray-800 last:border-r-0"
              >
                {day}
              </div>
            ))}
          </div>

          <div
            className="grid"
            style={{
              gridTemplateColumns: `${TIME_COLUMN_WIDTH_PX}px repeat(${DAYS.length}, minmax(${DAY_COLUMN_MIN_WIDTH_PX}px, 1fr))`,
            }}
          >
            <TimeAxis />
            {DAYS.map((day) => (
              <DayColumn key={day} day={day} schedules={groupedByDay[day]} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
