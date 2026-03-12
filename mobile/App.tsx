import AsyncStorage from "@react-native-async-storage/async-storage";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
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
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import {
  changePassword,
  getAnnouncements,
  getApiBaseUrl,
  getMe,
  getSchedules,
  login,
  register,
} from "./src/api";
import type { Announcement, AuthResponse, AuthUser, Schedule } from "./src/types";

const TOKEN_STORAGE_KEY = "scheduler.mobile.token";
const DAYS = ["All", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const CLASS_TYPE_FILTERS = ["All", "Lecture", "Tutorial", "Workshop"] as const;
const DAY_ORDER = DAYS.slice(1);

type AuthMode = "login" | "register";
type ClassTypeFilter = (typeof CLASS_TYPE_FILTERS)[number];

type AccentTheme = {
  softBackground: string;
  softBorder: string;
  softText: string;
  solidBackground: string;
  solidText: string;
};

function sortSchedules(items: Schedule[]): Schedule[] {
  return [...items].sort((left, right) => {
    const leftDay = DAY_ORDER.indexOf(left.day);
    const rightDay = DAY_ORDER.indexOf(right.day);

    if (leftDay !== rightDay) {
      return leftDay - rightDay;
    }

    return left.startTime.localeCompare(right.startTime);
  });
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

function filterSchedules(items: Schedule[], search: string): Schedule[] {
  const query = search.trim().toLowerCase();
  if (!query) {
    return sortSchedules(items);
  }

  return sortSchedules(
    items.filter((item) =>
      [
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
        .includes(query),
    ),
  );
}

function getClassTheme(classType: string): AccentTheme {
  switch (classType) {
    case "Lecture":
      return {
        softBackground: "#eff6ff",
        softBorder: "#bfdbfe",
        softText: "#1d4ed8",
        solidBackground: "#2563eb",
        solidText: "#ffffff",
      };
    case "Tutorial":
      return {
        softBackground: "#ecfdf5",
        softBorder: "#bbf7d0",
        softText: "#15803d",
        solidBackground: "#16a34a",
        solidText: "#ffffff",
      };
    case "Workshop":
      return {
        softBackground: "#faf5ff",
        softBorder: "#e9d5ff",
        softText: "#7e22ce",
        solidBackground: "#9333ea",
        solidText: "#ffffff",
      };
    default:
      return {
        softBackground: "#f3f4f6",
        softBorder: "#d1d5db",
        softText: "#4b5563",
        solidBackground: "#6b7280",
        solidText: "#ffffff",
      };
  }
}

function getAnnouncementTheme(type: Announcement["type"]) {
  switch (type) {
    case "urgent":
      return {
        background: "#fef2f2",
        border: "#fecaca",
        accent: "#dc2626",
      };
    case "warning":
      return {
        background: "#fffbeb",
        border: "#fde68a",
        accent: "#d97706",
      };
    default:
      return {
        background: "#eff6ff",
        border: "#bfdbfe",
        accent: "#2563eb",
      };
  }
}

function formatRole(role: AuthUser["role"]) {
  if (role === "admin") return "admin";
  if (role === "instructor") return "instructor";
  return "viewer";
}

function getClassTypeLabel(value: ClassTypeFilter) {
  if (value === "All") {
    return "All classes";
  }

  return `${value}s`;
}

function AuthScreen({
  mode,
  loading,
  error,
  username,
  password,
  onModeChange,
  onUsernameChange,
  onPasswordChange,
  onSubmit,
}: {
  mode: AuthMode;
  loading: boolean;
  error: string | null;
  username: string;
  password: string;
  onModeChange: (mode: AuthMode) => void;
  onUsernameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <SafeAreaView style={styles.authSafeArea} edges={["top", "bottom", "left", "right"]}>
      <KeyboardAvoidingView
        style={styles.authRoot}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <StatusBar style="dark" />
        <ScrollView contentContainerStyle={styles.authScroll}>
          <View style={styles.authHero}>
            <Text style={styles.authEyebrow}>Schedule Manager</Text>
            <Text style={styles.authTitle}>Built for the week, not the spreadsheet.</Text>
            <Text style={styles.authSubtitle}>
              London Metropolitan University · Spring 2026
            </Text>
          </View>

          <View style={styles.authPanel}>
            <View style={styles.authModeSwitch}>
              <Pressable
                onPress={() => onModeChange("login")}
                style={[styles.authModeButton, mode === "login" ? styles.authModeButtonActive : null]}
              >
                <Text
                  style={[
                    styles.authModeButtonText,
                    mode === "login" ? styles.authModeButtonTextActive : null,
                  ]}
                >
                  Sign In
                </Text>
              </Pressable>
              <Pressable
                onPress={() => onModeChange("register")}
                style={[
                  styles.authModeButton,
                  mode === "register" ? styles.authModeButtonActive : null,
                ]}
              >
                <Text
                  style={[
                    styles.authModeButtonText,
                    mode === "register" ? styles.authModeButtonTextActive : null,
                  ]}
                >
                  Create Account
                </Text>
              </Pressable>
            </View>

            {error ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <View style={styles.fieldStack}>
              <View>
                <Text style={styles.fieldLabel}>Username</Text>
                <TextInput
                  value={username}
                  onChangeText={onUsernameChange}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={styles.input}
                  placeholder="Enter your username"
                  placeholderTextColor="#94a3b8"
                />
              </View>

              <View>
                <Text style={styles.fieldLabel}>Password</Text>
                <TextInput
                  value={password}
                  onChangeText={onPasswordChange}
                  autoCapitalize="none"
                  autoCorrect={false}
                  secureTextEntry
                  style={styles.input}
                  placeholder="Enter your password"
                  placeholderTextColor="#94a3b8"
                />
              </View>
            </View>

            <Pressable onPress={onSubmit} disabled={loading} style={styles.primaryButton}>
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.primaryButtonText}>
                  {mode === "login" ? "Continue" : "Create Account"}
                </Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
    <SafeAreaView style={styles.authSafeArea} edges={["top", "bottom", "left", "right"]}>
      <KeyboardAvoidingView
        style={styles.authRoot}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <StatusBar style="dark" />
        <ScrollView contentContainerStyle={styles.authScroll}>
          <View style={styles.authHero}>
            <Text style={styles.authEyebrow}>Security Update</Text>
            <Text style={styles.authTitle}>Change your password to unlock the schedule.</Text>
            <Text style={styles.authSubtitle}>This account requires a password reset first.</Text>
          </View>

          <View style={styles.authPanel}>
            {error ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <View style={styles.fieldStack}>
              <View>
                <Text style={styles.fieldLabel}>Current password</Text>
                <TextInput
                  value={currentPassword}
                  onChangeText={onCurrentPasswordChange}
                  autoCapitalize="none"
                  autoCorrect={false}
                  secureTextEntry
                  style={styles.input}
                  placeholder="Current password"
                  placeholderTextColor="#94a3b8"
                />
              </View>

              <View>
                <Text style={styles.fieldLabel}>New password</Text>
                <TextInput
                  value={newPassword}
                  onChangeText={onNewPasswordChange}
                  autoCapitalize="none"
                  autoCorrect={false}
                  secureTextEntry
                  style={styles.input}
                  placeholder="New password"
                  placeholderTextColor="#94a3b8"
                />
              </View>

              <View>
                <Text style={styles.fieldLabel}>Confirm new password</Text>
                <TextInput
                  value={confirmPassword}
                  onChangeText={onConfirmPasswordChange}
                  autoCapitalize="none"
                  autoCorrect={false}
                  secureTextEntry
                  style={styles.input}
                  placeholder="Confirm new password"
                  placeholderTextColor="#94a3b8"
                />
              </View>
            </View>

            <Pressable onPress={onSubmit} disabled={loading} style={styles.primaryButton}>
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.primaryButtonText}>Save Password</Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function TopBar({
  user,
  resultCount,
  onLogout,
}: {
  user: AuthUser;
  resultCount: number;
  onLogout: () => void;
}) {
  const isInstructor = user.role === "instructor" && Boolean(user.instructorName);

  return (
    <View style={styles.topBar}>
      <View style={styles.topBarRow}>
        <View style={styles.topBarCopy}>
          <Text style={styles.topBarEyebrow}>Schedule Manager</Text>
          <Text style={styles.topBarTitle}>
            {isInstructor ? "Your teaching week" : "Your schedule, organized"}
          </Text>
          <Text style={styles.topBarSubtitle}>
            {isInstructor && user.instructorName
              ? `${user.instructorName} · ${resultCount} classes in view`
              : `${resultCount} classes in view`}
          </Text>
        </View>

        <Pressable onPress={onLogout} style={styles.logoutButton}>
          <Text style={styles.logoutButtonText}>Logout</Text>
        </Pressable>
      </View>

      <View style={styles.metaRow}>
        <View style={styles.identityChip}>
          <Text style={styles.identityChipText}>{user.username}</Text>
          <View style={styles.identityDot} />
          <Text style={styles.identityChipRole}>{formatRole(user.role)}</Text>
        </View>
      </View>
    </View>
  );
}

function AnnouncementStrip({ announcement }: { announcement: Announcement }) {
  const theme = getAnnouncementTheme(announcement.type);

  return (
    <View
      style={[
        styles.announcementStrip,
        {
          backgroundColor: theme.background,
          borderColor: theme.border,
        },
      ]}
    >
      <View style={[styles.announcementAccent, { backgroundColor: theme.accent }]} />
      <View style={styles.announcementContent}>
        <Text style={styles.announcementLabel}>{announcement.title}</Text>
        <Text style={styles.announcementText}>{announcement.message}</Text>
      </View>
    </View>
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
    <View style={styles.moduleSection}>
      <Text style={styles.sectionEyebrow}>Module Focus</Text>
      <View style={styles.moduleWrap}>
        {modules.map((module) => (
          <View key={module.code} style={styles.moduleChip}>
            <Text style={styles.moduleCode}>{module.code}</Text>
            <Text style={styles.moduleText}>{module.title}</Text>
            <Text style={styles.moduleCount}>
              {schedules.filter((schedule) => schedule.moduleCode === module.code).length}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function ScheduleRow({
  schedule,
  showDay,
}: {
  schedule: Schedule;
  showDay?: boolean;
}) {
  const theme = getClassTheme(schedule.classType);
  const displaySection = getDisplaySection(schedule);

  return (
    <View style={styles.scheduleRow}>
      <View style={styles.scheduleRail}>
        {showDay ? <Text style={styles.scheduleDayTag}>{schedule.day}</Text> : null}
        <Text style={styles.scheduleStart}>{schedule.startTime}</Text>
        <Text style={styles.scheduleEnd}>{schedule.endTime}</Text>
      </View>

      <View
        style={[
          styles.scheduleSurface,
          {
            backgroundColor: theme.softBackground,
            borderColor: theme.softBorder,
          },
        ]}
      >
        <View style={styles.scheduleSurfaceTop}>
          <View style={styles.scheduleTitleWrap}>
            <Text style={styles.scheduleCode}>{schedule.moduleCode}</Text>
            <Text style={styles.scheduleTitle}>{schedule.moduleTitle}</Text>
          </View>
          <View style={[styles.classBadge, { backgroundColor: theme.solidBackground }]}>
            <Text style={[styles.classBadgeText, { color: theme.solidText }]}>
              {schedule.classType}
            </Text>
          </View>
        </View>

        <Text style={[styles.scheduleMetaPrimary, { color: theme.softText }]}>
          {schedule.room} · {schedule.instructor}
        </Text>
        <Text style={styles.scheduleMetaSecondary}>
          {schedule.program} · Year {schedule.year} · {displaySection}
        </Text>
        <Text style={styles.scheduleMetaSecondary}>Group {schedule.group}</Text>
      </View>
    </View>
  );
}

function AgendaView({ schedules }: { schedules: Schedule[] }) {
  return (
    <View style={styles.listStack}>
      {schedules.map((schedule) => (
        <ScheduleRow key={schedule.id} schedule={schedule} showDay />
      ))}
    </View>
  );
}

export default function App() {
  const [bootstrapping, setBootstrapping] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
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

  const [selectedDay, setSelectedDay] = useState("All");
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

    const filter: { day?: string; instructor?: string; classType?: string } = {};
    if (selectedDay !== "All") {
      filter.day = selectedDay;
    }
    if (selectedClassType !== "All") {
      filter.classType = selectedClassType;
    }
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
  }, [token, user, selectedDay, selectedClassType, instructorScope]);

  const visibleSchedules = filterSchedules(schedules, search);
  const isInstructor = user?.role === "instructor" && Boolean(user.instructorName);
  const moduleSummaries = Array.from(
    new Map(
      visibleSchedules.map((schedule) => [
        schedule.moduleCode,
        { code: schedule.moduleCode, title: schedule.moduleTitle },
      ]),
    ).values(),
  );

  if (!apiBaseUrl) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.centeredScreen} edges={["top", "bottom", "left", "right"]}>
          <StatusBar style="dark" />
          <View style={styles.setupCard}>
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
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingLabel}>Checking saved session...</Text>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  if (!user) {
    return (
      <SafeAreaProvider>
        <AuthScreen
          mode={authMode}
          loading={authLoading}
          error={authError}
          username={username}
          password={password}
          onModeChange={(nextMode) => {
            setAuthMode(nextMode);
            setAuthError(null);
          }}
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
              const response =
                authMode === "login"
                  ? await login(username.trim(), password)
                  : await register(username.trim(), password);
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
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void loadDashboardData(true)} />
          }
        >
          <TopBar
            user={user}
            resultCount={visibleSchedules.length}
            onLogout={() => void clearSession()}
          />

          {announcements.length > 0 ? (
            <View style={styles.announcementStack}>
              {announcements.map((announcement) => (
                <AnnouncementStrip key={announcement.id} announcement={announcement} />
              ))}
            </View>
          ) : null}

          <View style={styles.controlBlock}>
            <Text style={styles.sectionEyebrow}>Filters</Text>
            <TextInput
              value={search}
              onChangeText={setSearch}
              style={styles.searchInput}
              placeholder="Search by module, room, instructor, or section"
              placeholderTextColor="#94a3b8"
            />

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.dayChipRow}
            >
              {DAYS.map((day) => (
                <Pressable
                  key={day}
                  onPress={() => setSelectedDay(day)}
                  style={[styles.dayChip, selectedDay === day ? styles.dayChipActive : null]}
                >
                  <Text style={[styles.dayChipText, selectedDay === day ? styles.dayChipTextActive : null]}>
                    {day}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.classTypeChipRow}
            >
              {CLASS_TYPE_FILTERS.map((classType) => (
                <Pressable
                  key={classType}
                  onPress={() => setSelectedClassType(classType)}
                  style={[
                    styles.classTypeChip,
                    selectedClassType === classType ? styles.classTypeChipActive : null,
                  ]}
                >
                  <Text
                    style={[
                      styles.classTypeChipText,
                      selectedClassType === classType ? styles.classTypeChipTextActive : null,
                    ]}
                  >
                    {classType === "All" ? "All" : classType}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          {isInstructor ? <ModuleRibbon modules={moduleSummaries} schedules={visibleSchedules} /> : null}

          <View style={styles.resultHeader}>
            <View style={styles.resultHeaderCopy}>
              <Text style={styles.resultHeaderTitle}>{getClassTypeLabel(selectedClassType)}</Text>
              <Text style={styles.resultHeaderSubtitle}>
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
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No schedules found</Text>
              <Text style={styles.emptyBody}>Try a different day or adjust the search.</Text>
            </View>
          ) : (
            <AgendaView schedules={visibleSchedules} />
          )}
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  authSafeArea: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  appRoot: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 32,
    gap: 20,
  },
  centeredScreen: {
    flex: 1,
    backgroundColor: "#f8fafc",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 14,
  },
  loadingLabel: {
    color: "#64748b",
    fontSize: 15,
  },
  setupCard: {
    width: "100%",
    backgroundColor: "#ffffff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 20,
    gap: 10,
  },
  setupTitle: {
    color: "#0f172a",
    fontSize: 22,
    fontWeight: "700",
  },
  setupBody: {
    color: "#475569",
    lineHeight: 20,
  },
  setupCode: {
    backgroundColor: "#eff6ff",
    color: "#1d4ed8",
    padding: 12,
    borderRadius: 12,
    overflow: "hidden",
  },
  authRoot: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  authScroll: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 28,
    gap: 20,
  },
  authHero: {
    gap: 10,
  },
  authEyebrow: {
    color: "#2563eb",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  authTitle: {
    color: "#0f172a",
    fontSize: 30,
    fontWeight: "800",
    lineHeight: 36,
  },
  authSubtitle: {
    color: "#64748b",
    fontSize: 15,
    lineHeight: 22,
  },
  authPanel: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 20,
    gap: 16,
  },
  authModeSwitch: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
    borderRadius: 14,
    padding: 4,
  },
  authModeButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 10,
  },
  authModeButtonActive: {
    backgroundColor: "#ffffff",
  },
  authModeButtonText: {
    color: "#64748b",
    fontWeight: "600",
    fontSize: 14,
  },
  authModeButtonTextActive: {
    color: "#0f172a",
  },
  fieldStack: {
    gap: 14,
  },
  fieldLabel: {
    color: "#334155",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 6,
  },
  input: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
    color: "#0f172a",
  },
  primaryButton: {
    backgroundColor: "#0f172a",
    minHeight: 50,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
  errorBanner: {
    backgroundColor: "#fff1f2",
    borderWidth: 1,
    borderColor: "#fecdd3",
    borderRadius: 14,
    padding: 12,
  },
  errorText: {
    color: "#be123c",
    fontSize: 14,
    lineHeight: 20,
  },
  topBar: {
    gap: 16,
  },
  topBarRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  topBarCopy: {
    flex: 1,
    gap: 6,
  },
  topBarEyebrow: {
    color: "#2563eb",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  topBarTitle: {
    color: "#0f172a",
    fontSize: 28,
    fontWeight: "800",
    lineHeight: 32,
  },
  topBarSubtitle: {
    color: "#64748b",
    fontSize: 15,
    lineHeight: 22,
  },
  logoutButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  logoutButtonText: {
    color: "#dc2626",
    fontWeight: "700",
    fontSize: 13,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  identityChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignSelf: "flex-start",
  },
  identityChipText: {
    color: "#0f172a",
    fontWeight: "600",
    fontSize: 13,
  },
  identityDot: {
    width: 4,
    height: 4,
    borderRadius: 999,
    backgroundColor: "#94a3b8",
  },
  identityChipRole: {
    color: "#64748b",
    fontSize: 13,
    fontWeight: "600",
  },
  announcementStack: {
    gap: 10,
  },
  announcementStrip: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: 16,
    overflow: "hidden",
  },
  announcementAccent: {
    width: 6,
  },
  announcementContent: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
  },
  announcementLabel: {
    color: "#0f172a",
    fontSize: 14,
    fontWeight: "700",
  },
  announcementText: {
    color: "#475569",
    fontSize: 14,
    lineHeight: 20,
  },
  controlBlock: {
    gap: 12,
  },
  sectionEyebrow: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  searchInput: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: "#0f172a",
  },
  dayChipRow: {
    gap: 8,
    paddingRight: 8,
  },
  classTypeChipRow: {
    gap: 8,
    paddingRight: 8,
  },
  dayChip: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  dayChipActive: {
    backgroundColor: "#2563eb",
    borderColor: "#2563eb",
  },
  dayChipText: {
    color: "#475569",
    fontSize: 13,
    fontWeight: "700",
  },
  dayChipTextActive: {
    color: "#ffffff",
  },
  classTypeChip: {
    backgroundColor: "#e2e8f0",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  classTypeChipActive: {
    backgroundColor: "#0f172a",
  },
  classTypeChipText: {
    color: "#475569",
    fontSize: 13,
    fontWeight: "700",
  },
  classTypeChipTextActive: {
    color: "#ffffff",
  },
  moduleSection: {
    gap: 12,
  },
  moduleWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  moduleChip: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#dbeafe",
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 3,
  },
  moduleCode: {
    color: "#2563eb",
    fontSize: 12,
    fontWeight: "800",
  },
  moduleText: {
    color: "#334155",
    fontSize: 13,
    lineHeight: 18,
    maxWidth: 220,
  },
  moduleCount: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "700",
  },
  resultHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 12,
  },
  resultHeaderCopy: {
    flex: 1,
    gap: 4,
  },
  resultHeaderTitle: {
    color: "#0f172a",
    fontSize: 20,
    fontWeight: "800",
  },
  resultHeaderSubtitle: {
    color: "#64748b",
    fontSize: 14,
  },
  refreshButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  refreshButtonText: {
    color: "#0f172a",
    fontSize: 13,
    fontWeight: "700",
  },
  emptyState: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 18,
    padding: 18,
    gap: 4,
  },
  emptyTitle: {
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "700",
  },
  emptyBody: {
    color: "#64748b",
    lineHeight: 20,
  },
  listStack: {
    gap: 14,
  },
  scheduleRow: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 12,
  },
  scheduleRail: {
    width: 84,
    paddingTop: 4,
    gap: 3,
  },
  scheduleDayTag: {
    color: "#2563eb",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  scheduleStart: {
    color: "#0f172a",
    fontSize: 15,
    fontWeight: "800",
  },
  scheduleEnd: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "600",
  },
  scheduleSurface: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    gap: 8,
  },
  scheduleSurfaceTop: {
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
    color: "#0f172a",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  scheduleTitle: {
    color: "#334155",
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 20,
  },
  classBadge: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
  },
  classBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  scheduleMetaPrimary: {
    fontSize: 13,
    fontWeight: "700",
  },
  scheduleMetaSecondary: {
    color: "#475569",
    fontSize: 13,
    lineHeight: 18,
  },
});
