export const IMPORT_SCHEDULE_QUEUE = "imports-schedule";
export const EMAIL_ALERT_QUEUE = "alerts-email";
export const REQUEST_EVALUATION_QUEUE = "requests-evaluation";
export const APPROVAL_NOTIFICATION_QUEUE = "approvals-notifications";

export const REDIS_CHANNELS = {
  import: "events:import",
  schedule: "events:schedule",
  rooms: "events:rooms",
  notifications: "events:notifications",
  analytics: "events:analytics",
  governance: "events:governance"
} as const;

export const CACHE_KEYS = {
  mySchedule: (userId: string, date: string) => `schedule:active:my:${userId}:${date}`,
  search: (hash: string) => `schedule:active:search:${hash}`,
  board: (scope: "all" | "mine", userId: string, date: string, hash: string) =>
    `schedule:active:board:${scope}:${userId}:${date}:${hash}`,
  roomAvailability: (date: string, start: string, end: string) =>
    `rooms:availability:${date}:${start}:${end}`,
  notifications: (userId: string) => `notifications:user:${userId}`
};
