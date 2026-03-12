import twilio from "twilio";

import { ApiError } from "../errors";
import { Schedule } from "../entities";
import { getDistinctInstructors, getDistinctPrograms, getDistinctRooms, findAllSchedules } from "./schedules";
import { getRepositories } from "./repositories";

type TelegramUpdate = {
  message?: {
    text?: string;
    chat?: { id: number };
    from?: { id: number };
  };
};

export async function handleWhatsAppMessage(from: string, body: string): Promise<string> {
  const message = body.trim().toLowerCase();

  if (message === "help" || message === "hi" || message === "hello") {
    return getWhatsAppHelpMessage();
  }

  if (message === "today") {
    return getTodaySchedule();
  }

  if (message.startsWith("day ")) {
    const day = parseDay(message.slice(4).trim());
    if (!day) {
      return "Invalid day. Use: Sunday, Monday, Tuesday, Wednesday, Thursday, Friday, Saturday";
    }
    return getScheduleByDay(day);
  }

  if (message.startsWith("instructor ")) {
    const rest = body.trim().slice(11).trim();
    const { name, day } = extractNameAndDay(rest);
    return getScheduleByInstructor(name, day);
  }

  if (message.startsWith("room ")) {
    const rest = body.trim().slice(5).trim();
    const { name, day } = extractNameAndDay(rest);
    return getScheduleByRoom(name, day);
  }

  if (message.startsWith("program ")) {
    const rest = body.trim().slice(8).trim();
    const { name, day } = extractNameAndDay(rest);
    return getScheduleByProgram(name, day);
  }

  if (message === "instructors") {
    return listInstructors();
  }

  if (message === "rooms") {
    return listRooms();
  }

  if (message === "programs") {
    return listPrograms();
  }

  return getWhatsAppHelpMessage();
}

export function getWhatsAppTwiML(reply: string) {
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(reply)}</Message></Response>`;
}

export function validateTwilioSignature(
  url: string,
  params: Record<string, string>,
  signature: string,
) {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) {
    return false;
  }

  return twilio.validateRequest(authToken, signature, url, params);
}

export async function sendWhatsAppReply(to: string, message: string) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_WHATSAPP_FROM;

  if (!accountSid || !authToken || !fromNumber) {
    return;
  }

  const client = twilio(accountSid, authToken);
  const chunks = splitMessage(message, 1500);

  for (const chunk of chunks) {
    await client.messages.create({
      from: `whatsapp:${fromNumber}`,
      to,
      body: chunk,
    });
  }
}

export async function handleTelegramWebhook(update: TelegramUpdate, secretHeader: string | null) {
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!expectedSecret) {
    throw new ApiError(503, "TELEGRAM_WEBHOOK_SECRET is not configured");
  }
  if (secretHeader !== expectedSecret) {
    throw new ApiError(403, "Forbidden");
  }

  const text = update.message?.text?.trim();
  const chatId = update.message?.chat?.id;
  const telegramUserId = update.message?.from?.id ?? chatId;

  if (!text || !chatId || !telegramUserId) {
    return { ok: true };
  }

  const reply = await handleTelegramMessage(String(telegramUserId), text);
  await sendTelegramLongMessage(chatId, reply);

  return { ok: true };
}

async function handleTelegramMessage(telegramUserId: string, message: string) {
  const normalized = message.trim();
  const lower = normalized.toLowerCase();

  if (lower === "/start" || lower === "/help") {
    return getTelegramHelpMessage();
  }

  if (lower.startsWith("/setinstructor")) {
    const input = normalized.replace(/^\/setinstructor\s*/i, "").trim();
    if (!input) {
      return "Usage: /setinstructor Sujan Subedi";
    }

    await upsertTelegramPreference(telegramUserId, input);
    return `✅ Saved! I'll remember *${input}* as your instructor.\nNow /today and /day will show only their schedule.`;
  }

  if (lower === "/clear") {
    await clearTelegramPreference(telegramUserId);
    return "✅ Preferences cleared. /today will now show the full schedule.";
  }

  if (lower.startsWith("/today")) {
    const query = normalized.replace(/^\/today\s*/i, "").trim();
    const savedInstructor = await getSavedInstructor(telegramUserId);
    const day = getTodayName();
    return getFilteredTelegramSchedule(day, query || savedInstructor || undefined);
  }

  if (lower.startsWith("/day")) {
    const input = normalized.replace(/^\/day\s*/i, "").trim();
    if (!input) {
      return "Usage: /day monday or /day monday sujan subedi";
    }

    const words = input.split(/\s+/);
    const day = parseDay(words[0]);
    if (!day) {
      return "Invalid day. Try: sun, mon, tue, wed, thu, fri, sat";
    }

    const query = words.slice(1).join(" ").trim();
    const savedInstructor = await getSavedInstructor(telegramUserId);
    return getFilteredTelegramSchedule(day, query || savedInstructor || undefined);
  }

  return getTelegramHelpMessage();
}

async function getSavedInstructor(telegramUserId: string) {
  const { telegramPreferenceRepo } = await getRepositories();
  const pref = await telegramPreferenceRepo.findOne({ where: { telegramUserId } });
  return pref?.instructor || null;
}

async function upsertTelegramPreference(telegramUserId: string, instructor: string) {
  const { telegramPreferenceRepo } = await getRepositories();
  const existing = await telegramPreferenceRepo.findOne({ where: { telegramUserId } });
  if (existing) {
    existing.instructor = instructor;
    await telegramPreferenceRepo.save(existing);
    return existing;
  }

  return telegramPreferenceRepo.save(
    telegramPreferenceRepo.create({
      telegramUserId,
      instructor,
    }),
  );
}

async function clearTelegramPreference(telegramUserId: string) {
  const { telegramPreferenceRepo } = await getRepositories();
  const existing = await telegramPreferenceRepo.findOne({ where: { telegramUserId } });
  if (existing) {
    existing.instructor = null;
    await telegramPreferenceRepo.save(existing);
  }
}

async function sendTelegramLongMessage(chatId: number, text: string) {
  const chunks = splitMessage(text, 4000);

  for (const chunk of chunks) {
    try {
      await sendTelegramMessage(chatId, chunk, "Markdown");
    } catch {
      await sendTelegramMessage(chatId, chunk);
    }
  }
}

async function sendTelegramMessage(chatId: number, text: string, parseMode?: "Markdown") {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new ApiError(503, "TELEGRAM_BOT_TOKEN is not configured");
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      ...(parseMode ? { parse_mode: parseMode } : {}),
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || "Telegram send failed");
  }
}

function getTelegramHelpMessage() {
  return [
    "📅 *Schedule Bot*",
    "",
    "/today - Today's schedule",
    "/today sujan subedi - Today by instructor",
    "/today L3C7 - Today by section",
    "/day monday - Schedule for a day",
    "/day friday L3C3 - Day + section",
    "/setinstructor Name - Save default filter",
    "/clear - Reset saved filter",
    "/help - Show commands",
  ].join("\n");
}

async function getFilteredTelegramSchedule(day: string, query?: string) {
  const schedules = await findAllSchedules({ day });
  if (schedules.length === 0) {
    return `No classes scheduled for ${day}.`;
  }

  if (!query) {
    return `📅 *${day}'s Schedule*\n\n${formatTelegramSchedules(schedules)}`;
  }

  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  const filtered = schedules.filter((schedule) => tokens.every((token) => tokenMatches(schedule, token)));

  if (filtered.length === 0) {
    return `📭 No classes found for "${query}" on ${day}.`;
  }

  const sorted = filtered.sort((left, right) => timeToMinutes(left.startTime) - timeToMinutes(right.startTime));
  const header = `📅 *${day} — ${query}* (${sorted.length} results)`;

  if (sorted.length > 8) {
    return `${header}\n💡 _Narrow down: /today ${query} C1_\n\n${formatCompactSchedules(sorted)}`;
  }

  return `${header}\n\n${formatTelegramSchedules(sorted)}`;
}

function tokenMatches(schedule: Schedule, token: string) {
  const sectionParts = token.match(/^l(\d+)([a-z]\d+)$/i);
  if (sectionParts) {
    const yearPrefix = `l${sectionParts[1]}`.toLowerCase();
    const groupId = sectionParts[2].toLowerCase();

    if (schedule.section.toLowerCase() === token) {
      return true;
    }

    if (
      schedule.section.toLowerCase().startsWith(yearPrefix) &&
      schedule.group.toLowerCase().split("+").some((group: string) => group.trim() === groupId)
    ) {
      return true;
    }

    return false;
  }

  if (schedule.group.toLowerCase().split("+").some((group: string) => group.trim() === token)) {
    return true;
  }

  return (
    schedule.instructor.toLowerCase().includes(token) ||
    schedule.room.toLowerCase().includes(token) ||
    schedule.program.toLowerCase().includes(token) ||
    schedule.moduleCode.toLowerCase().includes(token) ||
    schedule.moduleTitle.toLowerCase().includes(token)
  );
}

function formatTelegramSchedules(schedules: Schedule[]) {
  const sorted = [...schedules].sort(
    (left, right) => timeToMinutes(left.startTime) - timeToMinutes(right.startTime),
  );
  const lines: string[] = [];

  for (const schedule of sorted) {
    lines.push(
      `  ⏰ ${schedule.startTime} - ${schedule.endTime}`,
      `  📖 ${schedule.moduleCode} - ${schedule.moduleTitle}`,
      `  👤 ${schedule.instructor}`,
      `  🏫 ${schedule.room} | ${schedule.program} ${schedule.section}`,
      `  📝 ${schedule.classType} | Group: ${schedule.group}`,
      "",
    );
  }

  return lines.join("\n");
}

function formatCompactSchedules(schedules: Schedule[]) {
  return schedules
    .map(
      (schedule) =>
        `⏰ ${schedule.startTime}-${schedule.endTime} | ${schedule.moduleCode} | ${schedule.instructor} | ${schedule.room} | Grp: ${schedule.group}`,
    )
    .join("\n");
}

function getWhatsAppHelpMessage() {
  return [
    "📅 *Schedule Bot Commands*",
    "",
    "*today* - Today's schedule",
    "*day <name>* - Schedule for a day (e.g. day monday)",
    "*instructor <name>* - Schedule by instructor",
    "*instructor <name> <day>* - Instructor on a specific day",
    "*room <name>* - Schedule by room",
    "*room <name> <day>* - Room on a specific day",
    "*program <name>* - Schedule by program",
    "*program <name> <day>* - Program on a specific day",
    "*instructors* - List all instructors",
    "*rooms* - List all rooms",
    "*programs* - List all programs",
    "*help* - Show this help message",
  ].join("\n");
}

async function getTodaySchedule() {
  return getScheduleByDay(getTodayName());
}

async function getScheduleByDay(day: string) {
  const schedules = await findAllSchedules({ day });
  if (schedules.length === 0) {
    return `No classes scheduled for ${day}.`;
  }
  return `📅 *${day}'s Schedule*\n\n${formatWhatsAppSchedules(schedules)}`;
}

async function getScheduleByInstructor(name: string, day?: string) {
  const schedules = await findAllSchedules({
    instructor: name,
    ...(day ? { day } : {}),
  });
  const label = day ? `${name} on ${day}` : name;
  if (schedules.length === 0) {
    return `No schedules found for instructor "${label}".`;
  }
  return `👨‍🏫 *Schedule for ${label}*\n\n${formatWhatsAppSchedules(schedules)}`;
}

async function getScheduleByRoom(name: string, day?: string) {
  const schedules = await findAllSchedules({
    room: name,
    ...(day ? { day } : {}),
  });
  const label = day ? `${name} on ${day}` : name;
  if (schedules.length === 0) {
    return `No schedules found for room "${label}".`;
  }
  return `🏫 *Schedule for Room ${label}*\n\n${formatWhatsAppSchedules(schedules)}`;
}

async function getScheduleByProgram(name: string, day?: string) {
  const schedules = await findAllSchedules({
    program: name,
    ...(day ? { day } : {}),
  });
  const label = day ? `${name} on ${day}` : name;
  if (schedules.length === 0) {
    return `No schedules found for program "${label}".`;
  }
  return `📚 *Schedule for ${label}*\n\n${formatWhatsAppSchedules(schedules)}`;
}

async function listInstructors() {
  const instructors = await getDistinctInstructors();
  if (instructors.length === 0) {
    return "No instructors found.";
  }
  return `👨‍🏫 *Instructors*\n\n${instructors.map((name, index) => `${index + 1}. ${name}`).join("\n")}`;
}

async function listRooms() {
  const rooms = await getDistinctRooms();
  if (rooms.length === 0) {
    return "No rooms found.";
  }
  return `🏫 *Rooms*\n\n${rooms.map((name, index) => `${index + 1}. ${name}`).join("\n")}`;
}

async function listPrograms() {
  const programs = await getDistinctPrograms();
  if (programs.length === 0) {
    return "No programs found.";
  }
  return `📚 *Programs*\n\n${programs.map((name, index) => `${index + 1}. ${name}`).join("\n")}`;
}

function formatWhatsAppSchedules(schedules: Schedule[]) {
  const grouped = new Map<string, Schedule[]>();
  for (const schedule of schedules) {
    const list = grouped.get(schedule.day) || [];
    list.push(schedule);
    grouped.set(schedule.day, list);
  }

  const lines: string[] = [];
  for (const [day, items] of grouped.entries()) {
    lines.push(`*${day}*`);
    for (const schedule of items) {
      lines.push(
        `  ⏰ ${schedule.startTime} - ${schedule.endTime}`,
        `  📖 ${schedule.moduleCode} - ${schedule.moduleTitle}`,
        `  👤 ${schedule.instructor}`,
        `  🏫 ${schedule.room} | ${schedule.program} ${schedule.section}`,
        `  📝 ${schedule.classType} | Group: ${schedule.group}`,
        "",
      );
    }
  }

  return lines.join("\n");
}

function extractNameAndDay(input: string) {
  const days = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sun",
    "mon",
    "tue",
    "wed",
    "thu",
    "fri",
    "sat",
  ];
  const words = input.split(/\s+/);
  const lastWord = words[words.length - 1]?.toLowerCase();

  if (words.length > 1 && days.includes(lastWord)) {
    const day = parseDay(lastWord);
    return {
      name: words.slice(0, -1).join(" "),
      day: day || undefined,
    };
  }

  return { name: input };
}

function getTodayName() {
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return days[new Date().getDay()];
}

function parseDay(input: string): string | null {
  const days: Record<string, string> = {
    sun: "Sunday",
    sunday: "Sunday",
    mon: "Monday",
    monday: "Monday",
    tue: "Tuesday",
    tuesday: "Tuesday",
    wed: "Wednesday",
    wednesday: "Wednesday",
    thu: "Thursday",
    thursday: "Thursday",
    fri: "Friday",
    friday: "Friday",
    sat: "Saturday",
    saturday: "Saturday",
  };

  return days[input.toLowerCase()] || null;
}

function timeToMinutes(time: string) {
  const match = time.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) {
    return 0;
  }

  let hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2], 10);
  const period = match[3].toUpperCase();
  if (period === "PM" && hours !== 12) {
    hours += 12;
  }
  if (period === "AM" && hours === 12) {
    hours = 0;
  }
  return hours * 60 + minutes;
}

function splitMessage(message: string, maxLength: number) {
  if (message.length <= maxLength) {
    return [message];
  }

  const chunks: string[] = [];
  const lines = message.split("\n");
  let current = "";

  for (const line of lines) {
    if (current.length + line.length + 1 > maxLength) {
      if (current) {
        chunks.push(current);
      }
      current = line;
    } else {
      current = current ? `${current}\n${line}` : line;
    }
  }

  if (current) {
    chunks.push(current);
  }

  return chunks;
}

function escapeXml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
