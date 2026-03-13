import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { type ReactNode, useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import {
  changePassword,
  getAnnouncements,
  getApiBaseUrl,
  getMe,
  getSchedules,
  login,
} from "./src/api";
import { getAnnouncementTheme, getClassTheme, getRoleGradient, palette, radii, shadows } from "./src/theme";
import type { Announcement, AuthResponse, AuthUser, Schedule } from "./src/types";

const TOKEN_STORAGE_KEY = "scheduler.mobile.token";
const DAYS = ["All", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] as const;
const CLASS_TYPE_FILTERS = ["All", "Lecture", "Tutorial", "Workshop"] as const;
const DAY_ORDER = DAYS.slice(1);

type ClassTypeFilter = (typeof CLASS_TYPE_FILTERS)[number];

function parseTimeToMinutes(value: string): number | null {
  const normalized = value.trim();
  const match = normalized.match(/^(\d{1,2}):(\d{2})(?:\s*([AP]M))?$/i);
  if (!match) {
    return null;
  }

  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const meridiem = match[3]?.toUpperCase();

  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return null;
  }

  if (meridiem === "PM" && hours < 12) {
    hours += 12;
  } else if (meridiem === "AM" && hours === 12) {
    hours = 0;
  }

  return hours * 60 + minutes;
}

function getDisplaySection(schedule: Schedule): string {
  if (!schedule.group.includes("+")) {
    return schedule.section;
  }

  const sectionMatch = schedule.section.match(/^(L\d+)([A-Z]\d+)$/i);
  if (!sectionMatch) {
    return schedule.section;
  }

  const yearPrefix = sectionMatch[1].toUpperCase();
  const sections = schedule.group
    .split("+")
    .map((token) => token.trim())
    .filter(Boolean)
    .map((token) => {
      if (/^L\d+[A-Z]\d+$/i.test(token)) {
        return token.toUpperCase();
      }

      if (/^[A-Z]\d+$/i.test(token)) {
        return `${yearPrefix}${token.toUpperCase()}`;
      }

      return token.toUpperCase();
    });

  return Array.from(new Set(sections)).join("+") || schedule.section;
}

function sortSchedules(items: Schedule[]): Schedule[] {
  return [...items].sort((left, right) => {
    const leftDay = DAY_ORDER.indexOf(left.day as (typeof DAY_ORDER)[number]);
    const rightDay = DAY_ORDER.indexOf(right.day as (typeof DAY_ORDER)[number]);

    if (leftDay !== rightDay) {
      return leftDay - rightDay;
    }

    const leftStart = parseTimeToMinutes(left.startTime) ?? 0;
    const rightStart = parseTimeToMinutes(right.startTime) ?? 0;
    return leftStart - rightStart;
  });
}

function filterSchedules(
  items: Schedule[],
  search: string,
  selectedDay: string,
  selectedClassType: ClassTypeFilter,
): Schedule[] {
  const query = search.trim().toLowerCase();

  return sortSchedules(
    items.filter((item) => {
      if (selectedDay !== "All" && item.day !== selectedDay) {
        return false;
      }

      if (selectedClassType !== "All" && item.classType !== selectedClassType) {
        return false;
      }

      if (!query) {
        return true;
      }

      return [
        item.day,
        item.moduleCode,
        item.moduleTitle,
        item.instructor,
        item.room,
        item.program,
        item.section,
        getDisplaySection(item),
        item.classType,
        item.group,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    }),
  );
}

function getTodayScheduleDay(now: Date): string | null {
  const day = now.toLocaleDateString("en-US", { weekday: "long" });
  return DAY_ORDER.includes(day as (typeof DAY_ORDER)[number]) ? day : null;
}

function getGreeting(now: Date): string {
  const hour = now.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function getFriendlyDate(now: Date): string {
  return now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function getScheduleMomentum(items: Schedule[], now: Date) {
  const today = getTodayScheduleDay(now);
  const todayIndex = today ? DAY_ORDER.indexOf(today as (typeof DAY_ORDER)[number]) : -1;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  let current: Schedule | null = null;
  const upcoming: Array<{ schedule: Schedule; deltaDays: number; startMinutes: number }> = [];

  for (const schedule of items) {
    const dayIndex = DAY_ORDER.indexOf(schedule.day as (typeof DAY_ORDER)[number]);
    const startMinutes = parseTimeToMinutes(schedule.startTime);
    const endMinutes = parseTimeToMinutes(schedule.endTime);

    if (dayIndex === -1 || startMinutes === null || endMinutes === null) {
      continue;
    }

    const deltaDays =
      todayIndex === -1 ? dayIndex + 1 : (dayIndex - todayIndex + DAY_ORDER.length) % DAY_ORDER.length;

    if (deltaDays === 0 && startMinutes <= nowMinutes && nowMinutes < endMinutes) {
      if (!current || (parseTimeToMinutes(current.startTime) ?? 0) < startMinutes) {
        current = schedule;
      }
      continue;
    }

    if (deltaDays === 0 && startMinutes <= nowMinutes) {
      continue;
    }

    upcoming.push({ schedule, deltaDays, startMinutes });
  }

  upcoming.sort((left, right) => {
    if (left.deltaDays !== right.deltaDays) {
      return left.deltaDays - right.deltaDays;
    }

    return left.startMinutes - right.startMinutes;
  });

  return {
    current,
    next: upcoming[0]?.schedule ?? null,
  };
}

function getHeroFocus(schedule: Schedule | null, kind: "current" | "next" | "idle", now: Date) {
  if (!schedule) {
    return {
      badge: "Clear runway",
      title: "No class in progress",
      detail: "Use search or day filters to review the full week.",
      caption: "Your schedule is quiet right now.",
      theme: getClassTheme("default"),
    };
  }

  const theme = getClassTheme(schedule.classType);
  const today = getTodayScheduleDay(now);
  const dayLabel = schedule.day === today ? "Today" : schedule.day;
  const timeLabel = `${schedule.startTime} - ${schedule.endTime}`;

  if (kind === "current") {
    return {
      badge: "On now",
      title: `${schedule.moduleCode} in ${schedule.room}`,
      detail: `${schedule.moduleTitle} · ${timeLabel}`,
      caption: `${dayLabel} · ${schedule.classType} with ${schedule.instructor}`,
      theme,
    };
  }

  return {
    badge: "Next class",
    title: `${schedule.moduleCode} starts at ${schedule.startTime}`,
    detail: `${schedule.moduleTitle} · ${schedule.room}`,
    caption: `${dayLabel} · ${schedule.classType} with ${schedule.instructor}`,
    theme,
  };
}

function formatRole(role: AuthUser["role"]) {
  if (role === "admin") return "Admin";
  if (role === "instructor") return "Instructor";
  return "Viewer";
}

function getClassTypeLabel(value: ClassTypeFilter) {
  if (value === "All") {
    return "All classes";
  }

  return `${value}s`;
}

function AuthShell({
  eyebrow,
  title,
  subtitle,
  panelTitle,
  panelSubtitle,
  footerNote,
  error,
  loading,
  buttonLabel,
  onSubmit,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  panelTitle: string;
  panelSubtitle: string;
  footerNote: string;
  error: string | null;
  loading: boolean;
  buttonLabel: string;
  onSubmit: () => void;
  children: ReactNode;
}) {
  const { width } = useWindowDimensions();
  const isWide = width >= 860;
  const contentWidth = Math.min(width - 24, 1040);

  return (
    <SafeAreaView style={styles.authSafeArea} edges={["top", "bottom", "left", "right"]}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        style={styles.authRoot}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.authBackdrop}>
          <View style={styles.authGlowTop} />
          <View style={styles.authGlowBottom} />
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.authScroll, { paddingHorizontal: 12 }]}
        >
          <View
            style={[
              styles.authFrame,
              {
                width: contentWidth,
                flexDirection: isWide ? "row" : "column",
              },
            ]}
          >
            <LinearGradient
              colors={["#081f54", "#2458d3", "#6bb2ff"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[
                styles.authHeroCard,
                shadows.hero,
                {
                  minHeight: isWide ? 560 : 360,
                  width: isWide ? contentWidth * 0.54 : "100%",
                },
              ]}
            >
              <View style={styles.authHeroOrbLarge} />
              <View style={styles.authHeroOrbSmall} />

              <Text style={styles.authHeroEyebrow}>{eyebrow}</Text>
              <Text style={styles.authHeroTitle}>{title}</Text>
              <Text style={styles.authHeroSubtitle}>{subtitle}</Text>

              <View style={styles.authStatGrid}>
                <View style={styles.authStatCard}>
                  <Text style={styles.authStatLabel}>Live visibility</Text>
                  <Text style={styles.authStatValue}>Weekly view</Text>
                  <Text style={styles.authStatMeta}>Track today, next class, and filters in one place.</Text>
                </View>
                <View style={styles.authStatCard}>
                  <Text style={styles.authStatLabel}>Admin managed</Text>
                  <Text style={styles.authStatValue}>No signup</Text>
                  <Text style={styles.authStatMeta}>Accounts are provisioned internally for staff and admins.</Text>
                </View>
                <View style={styles.authStatCard}>
                  <Text style={styles.authStatLabel}>Mobile ready</Text>
                  <Text style={styles.authStatValue}>Responsive</Text>
                  <Text style={styles.authStatMeta}>Optimized for compact phones and tablet portrait layouts.</Text>
                </View>
              </View>
            </LinearGradient>

            <View style={[styles.authPanel, shadows.card, { width: isWide ? contentWidth * 0.46 - 18 : "100%" }]}>
              <View style={styles.authPanelHeader}>
                <Text style={styles.authPanelTitle}>{panelTitle}</Text>
                <Text style={styles.authPanelSubtitle}>{panelSubtitle}</Text>
              </View>

              {error ? (
                <View style={styles.errorBanner}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <View style={styles.fieldStack}>{children}</View>

              <Pressable onPress={onSubmit} disabled={loading} style={styles.primaryButton}>
                {loading ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.primaryButtonText}>{buttonLabel}</Text>
                )}
              </Pressable>

              <View style={styles.authFootnote}>
                <Text style={styles.authFootnoteText}>{footerNote}</Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function AuthScreen({
  loading,
  error,
  username,
  password,
  onUsernameChange,
  onPasswordChange,
  onSubmit,
}: {
  loading: boolean;
  error: string | null;
  username: string;
  password: string;
  onUsernameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <AuthShell
      eyebrow="Schedule Manager"
      title="Keep the academic week in motion."
      subtitle="Monitor teaching activity, announcements, and the next room switch without digging through spreadsheets."
      panelTitle="Sign in"
      panelSubtitle="Use your administrator-issued credentials to access the mobile schedule dashboard."
      footerNote="Need an account or a reset? Contact an administrator from the web dashboard."
      error={error}
      loading={loading}
      buttonLabel="Sign In"
      onSubmit={onSubmit}
    >
      <View>
        <Text style={styles.fieldLabel}>Username</Text>
        <TextInput
          value={username}
          onChangeText={onUsernameChange}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username"
          style={styles.input}
          placeholder="Enter your username"
          placeholderTextColor={palette.subtle}
        />
      </View>

      <View>
        <Text style={styles.fieldLabel}>Password</Text>
        <TextInput
          value={password}
          onChangeText={onPasswordChange}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="current-password"
          secureTextEntry
          style={styles.input}
          placeholder="Enter your password"
          placeholderTextColor={palette.subtle}
        />
      </View>
    </AuthShell>
  );
}

function ChangePasswordScreen({
  loading,
  error,
  currentPassword,
  newPassword,
  confirmPassword,
  onCurrentPasswordChange,
  onNewPasswordChange,
  onConfirmPasswordChange,
  onSubmit,
}: {
  loading: boolean;
  error: string | null;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
  onCurrentPasswordChange: (value: string) => void;
  onNewPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <AuthShell
      eyebrow="Security update"
      title="Protect the week before you enter it."
      subtitle="Your account requires a password change before the mobile dashboard unlocks."
      panelTitle="Change password"
      panelSubtitle="Choose a new password for this account. You will use it for future sign-ins."
      footerNote="The new password is applied immediately after this update succeeds."
      error={error}
      loading={loading}
      buttonLabel="Save Password"
      onSubmit={onSubmit}
    >
      <View>
        <Text style={styles.fieldLabel}>Current password</Text>
        <TextInput
          value={currentPassword}
          onChangeText={onCurrentPasswordChange}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="current-password"
          secureTextEntry
          style={styles.input}
          placeholder="Current password"
          placeholderTextColor={palette.subtle}
        />
      </View>

      <View>
        <Text style={styles.fieldLabel}>New password</Text>
        <TextInput
          value={newPassword}
          onChangeText={onNewPasswordChange}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="password-new"
          secureTextEntry
          style={styles.input}
          placeholder="New password"
          placeholderTextColor={palette.subtle}
        />
      </View>

      <View>
        <Text style={styles.fieldLabel}>Confirm new password</Text>
        <TextInput
          value={confirmPassword}
          onChangeText={onConfirmPasswordChange}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="password-new"
          secureTextEntry
          style={styles.input}
          placeholder="Confirm new password"
          placeholderTextColor={palette.subtle}
        />
      </View>
    </AuthShell>
  );
}

function HeroBanner({
  user,
  visibleCount,
  todayCount,
  currentSchedule,
  nextSchedule,
  onLogout,
}: {
  user: AuthUser;
  visibleCount: number;
  todayCount: number;
  currentSchedule: Schedule | null;
  nextSchedule: Schedule | null;
  onLogout: () => void;
}) {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const now = new Date();
  const focus = currentSchedule
    ? getHeroFocus(currentSchedule, "current", now)
    : nextSchedule
      ? getHeroFocus(nextSchedule, "next", now)
      : getHeroFocus(null, "idle", now);

  return (
    <LinearGradient
      colors={getRoleGradient(user.role)}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.heroCard, shadows.hero]}
    >
      <View style={styles.heroGlowLarge} />
      <View style={styles.heroGlowSmall} />

      <View
        style={[
          styles.heroHeader,
          {
            flexDirection: isTablet ? "row" : "column",
            alignItems: isTablet ? "center" : "flex-start",
          },
        ]}
      >
        <View style={styles.heroCopy}>
          <Text style={styles.heroEyebrow}>Schedule Manager</Text>
          <Text style={styles.heroTitle}>{getGreeting(now)}</Text>
          <Text style={styles.heroSubtitle}>{getFriendlyDate(now)}</Text>
        </View>

        <Pressable onPress={onLogout} style={styles.heroLogoutButton}>
          <Text style={styles.heroLogoutText}>Logout</Text>
        </Pressable>
      </View>

      <View style={styles.identityRow}>
        <View style={styles.identityChip}>
          <Text style={styles.identityPrimary}>{user.username}</Text>
          <View style={styles.identityDot} />
          <Text style={styles.identitySecondary}>{formatRole(user.role)}</Text>
        </View>
        {user.role === "instructor" && user.instructorName ? (
          <View style={styles.identityChip}>
            <Text style={styles.identityPrimary}>{user.instructorName}</Text>
          </View>
        ) : null}
      </View>

      <View
        style={[
          styles.heroBody,
          {
            flexDirection: isTablet ? "row" : "column",
          },
        ]}
      >
        <View style={styles.heroSummaryColumn}>
          <Text style={styles.heroLead}>
            {user.role === "instructor"
              ? "Your weekly teaching view stays focused on the next room, module, and update."
              : "Track the live academic week with responsive filters and a clearer daily focus."}
          </Text>

          <View style={styles.heroStatsRow}>
            <View style={styles.heroStatPill}>
              <Text style={styles.heroStatLabel}>In view</Text>
              <Text style={styles.heroStatValue}>{visibleCount}</Text>
            </View>
            <View style={styles.heroStatPill}>
              <Text style={styles.heroStatLabel}>Today</Text>
              <Text style={styles.heroStatValue}>{todayCount}</Text>
            </View>
          </View>
        </View>

        <View
          style={[
            styles.focusCard,
            {
              borderColor: focus.theme.softBorder,
              backgroundColor: "rgba(255,255,255,0.16)",
            },
          ]}
        >
          <View style={[styles.focusBadge, { backgroundColor: focus.theme.softBackground }]}>
            <Text style={[styles.focusBadgeText, { color: focus.theme.softText }]}>{focus.badge}</Text>
          </View>
          <Text style={styles.focusTitle}>{focus.title}</Text>
          <Text style={styles.focusDetail}>{focus.detail}</Text>
          <Text style={styles.focusCaption}>{focus.caption}</Text>
        </View>
      </View>
    </LinearGradient>
  );
}

function MetricCard({
  title,
  value,
  detail,
  width,
}: {
  title: string;
  value: string;
  detail: string;
  width: number;
}) {
  return (
    <View style={[styles.metricCard, shadows.card, { width }]}>
      <Text style={styles.metricTitle}>{title}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricDetail}>{detail}</Text>
    </View>
  );
}

function AnnouncementCard({ announcement }: { announcement: Announcement }) {
  const theme = getAnnouncementTheme(announcement.type);

  return (
    <View
      style={[
        styles.announcementCard,
        shadows.card,
        {
          borderColor: theme.border,
          backgroundColor: theme.background,
        },
      ]}
    >
      <View style={[styles.announcementAccent, { backgroundColor: theme.accent }]} />
      <View style={styles.announcementContent}>
        <Text style={styles.announcementTitle}>{announcement.title}</Text>
        <Text style={styles.announcementText}>{announcement.message}</Text>
      </View>
    </View>
  );
}

function FilterChip({
  label,
  selected,
  onPress,
  tone = "default",
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  tone?: "default" | "dark";
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.filterChip,
        tone === "dark" ? styles.filterChipDark : null,
        selected ? (tone === "dark" ? styles.filterChipDarkActive : styles.filterChipActive) : null,
      ]}
    >
      <Text
        style={[
          styles.filterChipText,
          tone === "dark" ? styles.filterChipTextDark : null,
          selected ? styles.filterChipTextActive : null,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function ModuleRibbon({
  modules,
  schedules,
}: {
  modules: { code: string; title: string }[];
  schedules: Schedule[];
}) {
  if (modules.length === 0) {
    return null;
  }

  return (
    <View style={styles.sectionBlock}>
      <Text style={styles.sectionEyebrow}>Module focus</Text>
      <View style={styles.moduleWrap}>
        {modules.map((module) => (
          <View key={module.code} style={[styles.moduleChip, shadows.card]}>
            <Text style={styles.moduleCode}>{module.code}</Text>
            <Text style={styles.moduleText} numberOfLines={2}>
              {module.title}
            </Text>
            <Text style={styles.moduleCount}>
              {schedules.filter((schedule) => schedule.moduleCode === module.code).length} classes
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function ScheduleCard({ schedule }: { schedule: Schedule }) {
  const theme = getClassTheme(schedule.classType);
  const displaySection = getDisplaySection(schedule);

  return (
    <View style={[styles.scheduleCard, shadows.card]}>
      <LinearGradient colors={theme.gradient} style={styles.scheduleRail}>
        <Text style={styles.scheduleDay}>{schedule.day}</Text>
        <Text style={styles.scheduleStart}>{schedule.startTime}</Text>
        <Text style={styles.scheduleEnd}>{schedule.endTime}</Text>
      </LinearGradient>

      <View
        style={[
          styles.scheduleBody,
          {
            backgroundColor: theme.softBackground,
            borderColor: theme.softBorder,
          },
        ]}
      >
        <View style={styles.scheduleHeader}>
          <View style={styles.scheduleTitleWrap}>
            <Text style={styles.scheduleCode}>{schedule.moduleCode}</Text>
            <Text style={styles.scheduleTitle}>{schedule.moduleTitle}</Text>
          </View>
          <View style={[styles.scheduleBadge, { backgroundColor: theme.solidBackground }]}>
            <Text style={[styles.scheduleBadgeText, { color: theme.solidText }]}>{schedule.classType}</Text>
          </View>
        </View>

        <Text style={[styles.scheduleLinePrimary, { color: theme.softText }]}>
          {schedule.room} · {schedule.instructor}
        </Text>
        <Text style={styles.scheduleLineSecondary}>
          {schedule.program} · Year {schedule.year} · {displaySection}
        </Text>
        <Text style={styles.scheduleLineSecondary}>Group {schedule.group}</Text>
      </View>
    </View>
  );
}

export default function App() {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const contentWidth = Math.min(width - 32, 980);
  const summaryColumns = isTablet ? 4 : 2;
  const summaryCardWidth = (contentWidth - 12 * (summaryColumns - 1)) / summaryColumns;

  const [bootstrapping, setBootstrapping] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  const [selectedDay, setSelectedDay] = useState<string>("All");
  const [selectedClassType, setSelectedClassType] = useState<ClassTypeFilter>("All");
  const [search, setSearch] = useState("");

  const apiBaseUrl = getApiBaseUrl();
  const instructorScope =
    user?.role === "instructor" && user.instructorName ? user.instructorName : null;

  async function restoreSession() {
    const savedToken = await AsyncStorage.getItem(TOKEN_STORAGE_KEY);
    if (!savedToken) {
      setBootstrapping(false);
      return;
    }

    try {
      const me = await getMe(savedToken);
      if (!me) {
        await AsyncStorage.removeItem(TOKEN_STORAGE_KEY);
        setToken(null);
        setUser(null);
      } else {
        setToken(savedToken);
        setUser(me);
      }
    } catch {
      await AsyncStorage.removeItem(TOKEN_STORAGE_KEY);
      setToken(null);
      setUser(null);
    } finally {
      setBootstrapping(false);
    }
  }

  async function persistSession(response: AuthResponse) {
    await AsyncStorage.setItem(TOKEN_STORAGE_KEY, response.accessToken);
    setToken(response.accessToken);
    setUser(response.user);
  }

  async function clearSession() {
    await AsyncStorage.removeItem(TOKEN_STORAGE_KEY);
    setToken(null);
    setUser(null);
    setSchedules([]);
    setAnnouncements([]);
    setSearch("");
    setSelectedDay("All");
    setSelectedClassType("All");
    setPassword("");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  }

  async function loadDashboardData(showRefreshState = false) {
    if (!token) {
      return;
    }

    if (showRefreshState) {
      setRefreshing(true);
    }

    const filter: { instructor?: string } = {};
    if (instructorScope) {
      filter.instructor = instructorScope;
    }

    try {
      const [scheduleData, announcementData] = await Promise.all([
        getSchedules(token, filter),
        getAnnouncements(token),
      ]);

      setSchedules(scheduleData);
      setAnnouncements(announcementData.filter((item) => item.active));
      setScheduleError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load data";
      setScheduleError(message);
    } finally {
      if (showRefreshState) {
        setRefreshing(false);
      }
    }
  }

  useEffect(() => {
    void restoreSession();
  }, []);

  useEffect(() => {
    if (!token || !user || user.mustChangePassword) {
      return;
    }

    void loadDashboardData();
  }, [token, user, instructorScope]);

  const visibleSchedules = filterSchedules(schedules, search, selectedDay, selectedClassType);
  const isInstructor = user?.role === "instructor" && Boolean(user.instructorName);
  const todayDay = getTodayScheduleDay(new Date());
  const todaySchedules = todayDay ? schedules.filter((schedule) => schedule.day === todayDay) : [];
  const momentum = getScheduleMomentum(schedules, new Date());
  const moduleSummaries = Array.from(
    new Map(
      visibleSchedules.map((schedule) => [
        schedule.moduleCode,
        { code: schedule.moduleCode, title: schedule.moduleTitle },
      ]),
    ).values(),
  );
  const uniqueModules = new Set(visibleSchedules.map((schedule) => schedule.moduleCode)).size;
  const activeFilterCount =
    (selectedDay !== "All" ? 1 : 0) +
    (selectedClassType !== "All" ? 1 : 0) +
    (search.trim() ? 1 : 0);

  if (!apiBaseUrl) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.centeredScreen} edges={["top", "bottom", "left", "right"]}>
          <StatusBar style="dark" />
          <View style={[styles.setupCard, shadows.card]}>
            <Text style={styles.setupTitle}>Missing API configuration</Text>
            <Text style={styles.setupBody}>
              Add `EXPO_PUBLIC_API_BASE_URL` to `mobile/.env` and point it to your deployed Next.js app.
            </Text>
            <Text style={styles.setupCode}>
              EXPO_PUBLIC_API_BASE_URL=https://your-vercel-app.vercel.app
            </Text>
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  if (bootstrapping) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.centeredScreen} edges={["top", "bottom", "left", "right"]}>
          <StatusBar style="dark" />
          <ActivityIndicator size="large" color={palette.accent} />
          <Text style={styles.loadingLabel}>Checking saved session...</Text>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  if (!user) {
    return (
      <SafeAreaProvider>
        <AuthScreen
          loading={authLoading}
          error={authError}
          username={username}
          password={password}
          onUsernameChange={setUsername}
          onPasswordChange={setPassword}
          onSubmit={async () => {
            if (!username.trim() || !password.trim()) {
              setAuthError("Username and password are required.");
              return;
            }

            setAuthLoading(true);
            setAuthError(null);
            try {
              const response = await login(username.trim(), password);
              await persistSession(response);
              setPassword("");
            } catch (error) {
              setAuthError(error instanceof Error ? error.message : "Authentication failed");
            } finally {
              setAuthLoading(false);
            }
          }}
        />
      </SafeAreaProvider>
    );
  }

  if (user.mustChangePassword) {
    return (
      <SafeAreaProvider>
        <ChangePasswordScreen
          loading={passwordLoading}
          error={passwordError}
          currentPassword={currentPassword}
          newPassword={newPassword}
          confirmPassword={confirmPassword}
          onCurrentPasswordChange={setCurrentPassword}
          onNewPasswordChange={setNewPassword}
          onConfirmPasswordChange={setConfirmPassword}
          onSubmit={async () => {
            if (!currentPassword || !newPassword || !confirmPassword) {
              setPasswordError("All password fields are required.");
              return;
            }
            if (newPassword !== confirmPassword) {
              setPasswordError("New passwords do not match.");
              return;
            }

            setPasswordLoading(true);
            setPasswordError(null);
            try {
              const response = await changePassword(token as string, currentPassword, newPassword);
              await persistSession(response);
              setCurrentPassword("");
              setNewPassword("");
              setConfirmPassword("");
            } catch (error) {
              setPasswordError(error instanceof Error ? error.message : "Password update failed");
            } finally {
              setPasswordLoading(false);
            }
          }}
        />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.appRoot} edges={["top", "bottom", "left", "right"]}>
        <StatusBar style="dark" />
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingHorizontal: 16 }]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void loadDashboardData(true)} />
          }
        >
          <View style={[styles.contentWrap, { width: contentWidth }]}>
            <HeroBanner
              user={user}
              visibleCount={visibleSchedules.length}
              todayCount={todaySchedules.length}
              currentSchedule={momentum.current}
              nextSchedule={momentum.next}
              onLogout={() => void clearSession()}
            />

            <View style={styles.summaryGrid}>
              <MetricCard
                title="Classes in view"
                value={String(visibleSchedules.length)}
                detail={activeFilterCount > 0 ? `${activeFilterCount} active filter${activeFilterCount > 1 ? "s" : ""}` : "Showing the full week"}
                width={summaryCardWidth}
              />
              <MetricCard
                title="Today"
                value={String(todaySchedules.length)}
                detail={todayDay ? `${todayDay}'s schedule` : "Weekend"}
                width={summaryCardWidth}
              />
              <MetricCard
                title="Modules"
                value={String(uniqueModules)}
                detail="Unique modules in the current result set"
                width={summaryCardWidth}
              />
              <MetricCard
                title="Updates"
                value={String(announcements.length)}
                detail={announcements.length === 1 ? "Active announcement" : "Active announcements"}
                width={summaryCardWidth}
              />
            </View>

            {announcements.length > 0 ? (
              <View style={styles.sectionBlock}>
                <Text style={styles.sectionEyebrow}>Announcements</Text>
                <View style={styles.announcementStack}>
                  {announcements.map((announcement) => (
                    <AnnouncementCard key={announcement.id} announcement={announcement} />
                  ))}
                </View>
              </View>
            ) : null}

            <View style={[styles.controlCard, shadows.card]}>
              <Text style={styles.sectionEyebrow}>Filters</Text>
              <TextInput
                value={search}
                onChangeText={setSearch}
                style={styles.searchInput}
                placeholder="Search module, room, instructor, or section"
                placeholderTextColor={palette.subtle}
              />

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {DAYS.map((day) => (
                  <FilterChip
                    key={day}
                    label={day}
                    selected={selectedDay === day}
                    onPress={() => setSelectedDay(day)}
                  />
                ))}
              </ScrollView>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {CLASS_TYPE_FILTERS.map((classType) => (
                  <FilterChip
                    key={classType}
                    label={classType === "All" ? "All classes" : classType}
                    selected={selectedClassType === classType}
                    onPress={() => setSelectedClassType(classType)}
                    tone="dark"
                  />
                ))}
              </ScrollView>
            </View>

            {isInstructor ? <ModuleRibbon modules={moduleSummaries} schedules={visibleSchedules} /> : null}

            <View style={styles.resultsHeader}>
              <View style={styles.resultsCopy}>
                <Text style={styles.resultsTitle}>{getClassTypeLabel(selectedClassType)}</Text>
                <Text style={styles.resultsSubtitle}>
                  {visibleSchedules.length} classes
                  {selectedDay !== "All" ? ` · ${selectedDay}` : ""}
                </Text>
              </View>

              <Pressable onPress={() => void loadDashboardData(true)} style={styles.refreshButton}>
                <Text style={styles.refreshButtonText}>Refresh</Text>
              </Pressable>
            </View>

            {scheduleError ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{scheduleError}</Text>
              </View>
            ) : null}

            {visibleSchedules.length === 0 ? (
              <View style={[styles.emptyState, shadows.card]}>
                <Text style={styles.emptyTitle}>No schedules found</Text>
                <Text style={styles.emptyBody}>
                  Try a different day, remove one of the filters, or clear the search query.
                </Text>
              </View>
            ) : (
              <View style={styles.scheduleStack}>
                {visibleSchedules.map((schedule) => (
                  <ScheduleCard key={schedule.id} schedule={schedule} />
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  authSafeArea: {
    flex: 1,
    backgroundColor: "#081a40",
  },
  authRoot: {
    flex: 1,
    backgroundColor: "#081a40",
  },
  authBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#081a40",
  },
  authGlowTop: {
    position: "absolute",
    width: 320,
    height: 320,
    borderRadius: 999,
    backgroundColor: "rgba(84, 158, 255, 0.22)",
    top: -120,
    right: -60,
  },
  authGlowBottom: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 999,
    backgroundColor: "rgba(78, 235, 197, 0.14)",
    bottom: -100,
    left: -40,
  },
  authScroll: {
    flexGrow: 1,
    justifyContent: "center",
    paddingVertical: 24,
  },
  authFrame: {
    alignSelf: "center",
    gap: 18,
  },
  authHeroCard: {
    borderRadius: radii.xl,
    overflow: "hidden",
    padding: 28,
    justifyContent: "space-between",
    gap: 22,
  },
  authHeroOrbLarge: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.14)",
    top: -80,
    right: -50,
  },
  authHeroOrbSmall: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.12)",
    bottom: 20,
    left: -20,
  },
  authHeroEyebrow: {
    color: "#dce8ff",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.3,
  },
  authHeroTitle: {
    color: "#ffffff",
    fontSize: 34,
    fontWeight: "800",
    lineHeight: 40,
    maxWidth: 420,
  },
  authHeroSubtitle: {
    color: "rgba(255,255,255,0.86)",
    fontSize: 16,
    lineHeight: 24,
    maxWidth: 460,
  },
  authStatGrid: {
    gap: 12,
  },
  authStatCard: {
    borderRadius: radii.md,
    padding: 16,
    backgroundColor: "rgba(255,255,255,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    gap: 4,
  },
  authStatLabel: {
    color: "rgba(255,255,255,0.76)",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  authStatValue: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "800",
  },
  authStatMeta: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 13,
    lineHeight: 18,
  },
  authPanel: {
    borderRadius: radii.xl,
    backgroundColor: palette.panel,
    padding: 24,
    gap: 18,
    justifyContent: "center",
  },
  authPanelHeader: {
    gap: 6,
  },
  authPanelTitle: {
    color: palette.ink,
    fontSize: 28,
    fontWeight: "800",
  },
  authPanelSubtitle: {
    color: palette.muted,
    fontSize: 15,
    lineHeight: 22,
  },
  authFootnote: {
    borderRadius: radii.md,
    padding: 14,
    backgroundColor: "#eef4fb",
  },
  authFootnoteText: {
    color: palette.body,
    fontSize: 13,
    lineHeight: 20,
  },
  appRoot: {
    flex: 1,
    backgroundColor: palette.page,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 14,
    paddingBottom: 32,
  },
  contentWrap: {
    alignSelf: "center",
    gap: 18,
  },
  centeredScreen: {
    flex: 1,
    backgroundColor: palette.page,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 14,
  },
  loadingLabel: {
    color: palette.muted,
    fontSize: 15,
  },
  setupCard: {
    width: "100%",
    backgroundColor: palette.panel,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: palette.line,
    padding: 20,
    gap: 10,
  },
  setupTitle: {
    color: palette.ink,
    fontSize: 22,
    fontWeight: "700",
  },
  setupBody: {
    color: palette.body,
    lineHeight: 20,
  },
  setupCode: {
    backgroundColor: "#e7efff",
    color: palette.accent,
    padding: 12,
    borderRadius: radii.sm,
    overflow: "hidden",
  },
  fieldStack: {
    gap: 14,
  },
  fieldLabel: {
    color: palette.body,
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 6,
  },
  input: {
    backgroundColor: "#f9fbfe",
    borderWidth: 1,
    borderColor: "#d6e1ee",
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
    color: palette.ink,
  },
  primaryButton: {
    backgroundColor: palette.ink,
    minHeight: 52,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
  },
  errorBanner: {
    backgroundColor: "#fff1f2",
    borderWidth: 1,
    borderColor: "#fecdd3",
    borderRadius: radii.md,
    padding: 12,
  },
  errorText: {
    color: "#be123c",
    fontSize: 14,
    lineHeight: 20,
  },
  heroCard: {
    borderRadius: radii.xl,
    overflow: "hidden",
    padding: 22,
    gap: 18,
  },
  heroGlowLarge: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 999,
    top: -80,
    right: -30,
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  heroGlowSmall: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 999,
    bottom: 20,
    left: -20,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  heroHeader: {
    justifyContent: "space-between",
    gap: 12,
  },
  heroCopy: {
    gap: 6,
  },
  heroEyebrow: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  heroTitle: {
    color: "#ffffff",
    fontSize: 34,
    fontWeight: "800",
    lineHeight: 40,
  },
  heroSubtitle: {
    color: "rgba(255,255,255,0.84)",
    fontSize: 15,
    lineHeight: 21,
  },
  heroLogoutButton: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: radii.pill,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  heroLogoutText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800",
  },
  identityRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  identityChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radii.pill,
    backgroundColor: "rgba(255,255,255,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  identityPrimary: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
  identitySecondary: {
    color: "rgba(255,255,255,0.76)",
    fontSize: 13,
    fontWeight: "700",
  },
  identityDot: {
    width: 4,
    height: 4,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.56)",
  },
  heroBody: {
    gap: 14,
  },
  heroSummaryColumn: {
    flex: 1,
    gap: 14,
  },
  heroLead: {
    color: "#ffffff",
    fontSize: 16,
    lineHeight: 24,
    maxWidth: 460,
  },
  heroStatsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  heroStatPill: {
    minWidth: 120,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: radii.md,
    backgroundColor: "rgba(255,255,255,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    gap: 2,
  },
  heroStatLabel: {
    color: "rgba(255,255,255,0.74)",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  heroStatValue: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "800",
  },
  focusCard: {
    flex: 1,
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: 16,
    gap: 8,
  },
  focusBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: radii.pill,
  },
  focusBadgeText: {
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  focusTitle: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "800",
    lineHeight: 26,
  },
  focusDetail: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 21,
  },
  focusCaption: {
    color: "rgba(255,255,255,0.76)",
    fontSize: 13,
    lineHeight: 18,
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  metricCard: {
    borderRadius: radii.lg,
    backgroundColor: palette.panel,
    borderWidth: 1,
    borderColor: palette.line,
    padding: 16,
    gap: 6,
  },
  metricTitle: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  metricValue: {
    color: palette.ink,
    fontSize: 28,
    fontWeight: "800",
  },
  metricDetail: {
    color: palette.body,
    fontSize: 13,
    lineHeight: 18,
  },
  sectionBlock: {
    gap: 12,
  },
  sectionEyebrow: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.1,
  },
  announcementStack: {
    gap: 10,
  },
  announcementCard: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: radii.lg,
    overflow: "hidden",
  },
  announcementAccent: {
    width: 8,
  },
  announcementContent: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
  },
  announcementTitle: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: "800",
  },
  announcementText: {
    color: palette.body,
    fontSize: 14,
    lineHeight: 20,
  },
  controlCard: {
    borderRadius: radii.lg,
    backgroundColor: palette.panel,
    borderWidth: 1,
    borderColor: palette.line,
    padding: 16,
    gap: 12,
  },
  searchInput: {
    backgroundColor: "#f9fbfe",
    borderWidth: 1,
    borderColor: "#d6e1ee",
    borderRadius: radii.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: palette.ink,
  },
  chipRow: {
    gap: 8,
    paddingRight: 8,
  },
  filterChip: {
    borderRadius: radii.pill,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#edf2f8",
    borderWidth: 1,
    borderColor: "#dae3ee",
  },
  filterChipDark: {
    backgroundColor: "#f3f7fb",
  },
  filterChipActive: {
    backgroundColor: palette.accent,
    borderColor: palette.accent,
  },
  filterChipDarkActive: {
    backgroundColor: palette.ink,
    borderColor: palette.ink,
  },
  filterChipText: {
    color: palette.body,
    fontSize: 13,
    fontWeight: "800",
  },
  filterChipTextDark: {
    color: palette.ink,
  },
  filterChipTextActive: {
    color: "#ffffff",
  },
  moduleWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  moduleChip: {
    minWidth: 150,
    maxWidth: 240,
    borderRadius: radii.md,
    backgroundColor: palette.panel,
    borderWidth: 1,
    borderColor: "#d4e4ff",
    padding: 14,
    gap: 4,
  },
  moduleCode: {
    color: palette.accent,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  moduleText: {
    color: palette.body,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
  },
  moduleCount: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: "700",
  },
  resultsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 12,
  },
  resultsCopy: {
    flex: 1,
    gap: 4,
  },
  resultsTitle: {
    color: palette.ink,
    fontSize: 24,
    fontWeight: "800",
  },
  resultsSubtitle: {
    color: palette.muted,
    fontSize: 14,
  },
  refreshButton: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: radii.pill,
    backgroundColor: palette.panel,
    borderWidth: 1,
    borderColor: palette.line,
  },
  refreshButtonText: {
    color: palette.ink,
    fontSize: 13,
    fontWeight: "800",
  },
  emptyState: {
    borderRadius: radii.lg,
    backgroundColor: palette.panel,
    borderWidth: 1,
    borderColor: palette.line,
    padding: 18,
    gap: 6,
  },
  emptyTitle: {
    color: palette.ink,
    fontSize: 17,
    fontWeight: "800",
  },
  emptyBody: {
    color: palette.muted,
    lineHeight: 20,
  },
  scheduleStack: {
    gap: 14,
  },
  scheduleCard: {
    borderRadius: radii.lg,
    overflow: "hidden",
    backgroundColor: palette.panel,
  },
  scheduleRail: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 2,
  },
  scheduleDay: {
    color: "rgba(255,255,255,0.74)",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.9,
  },
  scheduleStart: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "800",
  },
  scheduleEnd: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 13,
    fontWeight: "700",
  },
  scheduleBody: {
    borderTopWidth: 1,
    padding: 16,
    gap: 8,
  },
  scheduleHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  scheduleTitleWrap: {
    flex: 1,
    gap: 3,
  },
  scheduleCode: {
    color: palette.ink,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  scheduleTitle: {
    color: palette.body,
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 22,
  },
  scheduleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radii.pill,
  },
  scheduleBadgeText: {
    fontSize: 12,
    fontWeight: "800",
  },
  scheduleLinePrimary: {
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
  },
  scheduleLineSecondary: {
    color: palette.body,
    fontSize: 14,
    lineHeight: 20,
  },
});
