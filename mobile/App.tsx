import { LinearGradient } from "expo-linear-gradient";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import { StatusBar } from "expo-status-bar";
import { type ReactNode, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
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
import {
  clearBiometricCredentials,
  clearRememberedLogin,
  clearSessionToken,
  getBiometricCredentials,
  getRememberedUsername as getStoredRememberedUsername,
  getSessionToken,
  isBiometricRememberEnabled,
  saveBiometricCredentials,
  setBiometricRememberEnabled,
  setRememberedUsername as persistRememberedUsername,
  setSessionToken,
} from "./src/auth-storage";
import { getAnnouncementTheme, getClassTheme, getRoleGradient, palette, radii, shadows } from "./src/theme";
import type { Announcement, AuthResponse, AuthUser, Schedule } from "./src/types";

const DAYS = ["All", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] as const;
const CLASS_TYPE_FILTERS = ["All", "Lecture", "Tutorial", "Workshop"] as const;
const DAY_ORDER = DAYS.slice(1);

type ClassTypeFilter = (typeof CLASS_TYPE_FILTERS)[number];
type BiometricSupport = {
  available: boolean;
  label: string;
};
type AuthFieldHelpers = {
  registerField: (fieldName: string) => { onLayout: (event: { nativeEvent: { layout: { y: number } } }) => void };
  focusField: (fieldName: string) => void;
  blurField: (fieldName: string) => void;
};

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

function getBiometricButtonLabel(types: LocalAuthentication.AuthenticationType[]): string {
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
    return Platform.OS === "ios" ? "Sign in with Face ID" : "Sign in with Face unlock";
  }

  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
    return Platform.OS === "ios" ? "Sign in with Touch ID" : "Sign in with Fingerprint";
  }

  if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
    return "Sign in with Iris";
  }

  return "Sign in with biometrics";
}

async function getBiometricSupport(): Promise<BiometricSupport> {
  try {
    const [hasHardware, isEnrolled, supportedTypes] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
      LocalAuthentication.supportedAuthenticationTypesAsync(),
    ]);

    if (!hasHardware || !isEnrolled || !SecureStore.canUseBiometricAuthentication()) {
      return {
        available: false,
        label: "Sign in with biometrics",
      };
    }

    return {
      available: true,
      label: getBiometricButtonLabel(supportedTypes),
    };
  } catch {
    return {
      available: false,
      label: "Sign in with biometrics",
    };
  }
}

function getBiometricPrompt(label: string) {
  const method = label.replace(/^Sign in with /, "");
  return `Use ${method} to unlock your saved sign-in details.`;
}

function isBiometricPromptCancelled(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes("cancel") ||
    message.includes("dismiss") ||
    message.includes("abort") ||
    message.includes("not authenticated")
  );
}

function isInvalidCredentialsMessage(message: string) {
  const normalized = message.toLowerCase();
  return normalized.includes("invalid credentials") || normalized.includes("unauthorized");
}

function AuthShell({
  eyebrow,
  title,
  subtitle,
  highlights,
  panelTitle,
  panelSubtitle,
  footerNote,
  error,
  loading,
  buttonLabel,
  onSubmit,
  footerAction,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  highlights: Array<{ label: string; value: string }>;
  panelTitle: string;
  panelSubtitle: string;
  footerNote: string;
  error: string | null;
  loading: boolean;
  buttonLabel: string;
  onSubmit: () => void;
  footerAction?: ReactNode;
  children: (helpers: AuthFieldHelpers) => ReactNode;
}) {
  const { width, height } = useWindowDimensions();
  const isWide = width >= 860;
  const contentWidth = isWide ? Math.min(width - 24, 840) : Math.min(width - 24, 520);
  const scrollRef = useRef<ScrollView | null>(null);
  const activeFieldRef = useRef<string | null>(null);
  const fieldOffsetsRef = useRef<Record<string, number>>({});

  function scrollToField(fieldName: string, animated = true) {
    const offsetY = fieldOffsetsRef.current[fieldName];
    if (typeof offsetY !== "number") {
      return;
    }

    scrollRef.current?.scrollTo({
      y: Math.max(0, offsetY - (isWide ? 36 : 112)),
      animated,
    });
  }

  useEffect(() => {
    const eventName = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const subscription = Keyboard.addListener(eventName, () => {
      if (!activeFieldRef.current) {
        return;
      }

      requestAnimationFrame(() => {
        if (activeFieldRef.current) {
          scrollToField(activeFieldRef.current);
        }
      });
    });

    return () => {
      subscription.remove();
    };
  }, [isWide]);

  const fieldHelpers: AuthFieldHelpers = {
    registerField: (fieldName) => ({
      onLayout: (event) => {
        fieldOffsetsRef.current[fieldName] = event.nativeEvent.layout.y;
      },
    }),
    focusField: (fieldName) => {
      activeFieldRef.current = fieldName;
      requestAnimationFrame(() => {
        scrollToField(fieldName);
      });
    },
    blurField: (fieldName) => {
      if (activeFieldRef.current === fieldName) {
        activeFieldRef.current = null;
      }
    },
  };

  const wideHero = (
    <LinearGradient
      colors={["#ffffff", "#eef4ff", "#dfeaff"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        styles.authHeroCard,
        shadows.card,
        {
          minHeight: 320,
          width: contentWidth * 0.44,
        },
      ]}
    >
      <View style={styles.authHeroOrbLarge} />
      <View style={styles.authHeroOrbSmall} />

      <View style={styles.authHeroTopRow}>
        <Text style={styles.authHeroEyebrow}>{eyebrow}</Text>
        <View style={styles.authHeroPill}>
          <Text style={styles.authHeroPillText}>Mobile</Text>
        </View>
      </View>
      <Text style={styles.authHeroTitle}>{title}</Text>
      <Text style={styles.authHeroSubtitle}>{subtitle}</Text>

      <View style={styles.authHighlightRow}>
        {highlights.map((item) => (
          <View key={item.label} style={styles.authHighlightCard}>
            <Text style={styles.authHighlightLabel}>{item.label}</Text>
            <Text style={styles.authHighlightValue}>{item.value}</Text>
          </View>
        ))}
      </View>
    </LinearGradient>
  );

  return (
    <SafeAreaView style={styles.authSafeArea} edges={["top", "bottom", "left", "right"]}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        style={styles.authRoot}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 12 : 0}
      >
        <View style={styles.authBackdrop}>
          <View style={styles.authGlowTop} />
          <View style={styles.authGlowBottom} />
        </View>

        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            styles.authScroll,
            {
              paddingHorizontal: 12,
              minHeight: isWide ? Math.max(height - 12, 0) : undefined,
              justifyContent: isWide ? "center" : "flex-start",
            },
          ]}
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
            {isWide ? wideHero : null}

            <View style={[styles.authPanel, shadows.card, { width: isWide ? contentWidth * 0.56 - 18 : "100%" }]}>
              {!isWide ? (
                <View style={styles.authCompactIntro}>
                  <Text style={styles.authCompactEyebrow}>{eyebrow}</Text>
                  <Text style={styles.authCompactTitle}>{title}</Text>
                  <Text style={styles.authCompactSubtitle}>{subtitle}</Text>
                  <View style={styles.authCompactHighlightRow}>
                    {highlights.map((item) => (
                      <View key={item.label} style={styles.authCompactHighlightChip}>
                        <Text style={styles.authCompactHighlightLabel}>{item.label}</Text>
                        <Text style={styles.authCompactHighlightValue}>{item.value}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}

              <View style={styles.authPanelHeader}>
                <Text style={styles.authPanelTitle}>{panelTitle}</Text>
                <Text style={styles.authPanelSubtitle}>{panelSubtitle}</Text>
              </View>

              {error ? (
                <View style={styles.errorBanner}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <View style={styles.fieldStack}>{children(fieldHelpers)}</View>

              <Pressable onPress={onSubmit} disabled={loading} style={[styles.primaryButton, loading && styles.buttonDisabled]}>
                {loading ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.primaryButtonText}>{buttonLabel}</Text>
                )}
              </Pressable>

              {footerAction}

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
  rememberDevice,
  biometricAvailable,
  biometricReady,
  biometricLoading,
  rememberedUsername,
  biometricLabel,
  onUsernameChange,
  onPasswordChange,
  onRememberDeviceChange,
  onBiometricSubmit,
  onSubmit,
}: {
  loading: boolean;
  error: string | null;
  username: string;
  password: string;
  rememberDevice: boolean;
  biometricAvailable: boolean;
  biometricReady: boolean;
  biometricLoading: boolean;
  rememberedUsername: string;
  biometricLabel: string;
  onUsernameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onRememberDeviceChange: (value: boolean) => void | Promise<void>;
  onBiometricSubmit: () => void | Promise<void>;
  onSubmit: () => void;
}) {
  const passwordRef = useRef<TextInput | null>(null);
  const biometricMethod = biometricLabel.replace(/^Sign in with /, "");

  return (
    <AuthShell
      eyebrow="Schedule Manager"
      title="Clean schedule access."
      subtitle="A simpler login built for small screens so the form stays usable while the keyboard is open."
      highlights={[
        { label: "Focus", value: "Weekly view" },
        { label: "Access", value: "Admin managed" },
      ]}
      panelTitle="Sign in"
      panelSubtitle="Use your assigned credentials to open the schedule dashboard."
      footerNote="Need an account or a reset? Contact an administrator from the web dashboard."
      error={error}
      loading={loading}
      buttonLabel="Sign In"
      onSubmit={onSubmit}
      footerAction={
        biometricReady ? (
          <View style={styles.authSecondaryAction}>
            {rememberedUsername ? (
              <Text style={styles.savedSigninLabel}>Saved for {rememberedUsername}</Text>
            ) : null}

            <Pressable
              onPress={onBiometricSubmit}
              disabled={biometricLoading}
              style={[styles.secondaryButton, biometricLoading && styles.buttonDisabled]}
            >
              {biometricLoading ? (
                <ActivityIndicator color={palette.accent} />
              ) : (
                <Text style={styles.secondaryButtonText}>{biometricLabel}</Text>
              )}
            </Pressable>
          </View>
        ) : null
      }
    >
      {({ registerField, focusField, blurField }) => (
        <>
          <View {...registerField("username")}>
            <Text style={styles.fieldLabel}>Username</Text>
            <TextInput
              value={username}
              onChangeText={onUsernameChange}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="username"
              returnKeyType="next"
              style={styles.input}
              placeholder="Enter your username"
              placeholderTextColor={palette.subtle}
              onFocus={() => focusField("username")}
              onBlur={() => blurField("username")}
              onSubmitEditing={() => passwordRef.current?.focus()}
            />
          </View>

          <View {...registerField("password")}>
            <Text style={styles.fieldLabel}>Password</Text>
            <TextInput
              ref={passwordRef}
              value={password}
              onChangeText={onPasswordChange}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="current-password"
              secureTextEntry
              returnKeyType="done"
              style={styles.input}
              placeholder="Enter your password"
              placeholderTextColor={palette.subtle}
              onFocus={() => focusField("password")}
              onBlur={() => blurField("password")}
              onSubmitEditing={() => void onSubmit()}
            />
          </View>

          {biometricAvailable ? (
            <Pressable
              onPress={() => void onRememberDeviceChange(!rememberDevice)}
              style={styles.rememberToggle}
            >
              <View style={[styles.rememberIndicator, rememberDevice && styles.rememberIndicatorActive]}>
                {rememberDevice ? <View style={styles.rememberIndicatorDot} /> : null}
              </View>

              <View style={styles.rememberCopy}>
                <Text style={styles.rememberTitle}>Remember this device</Text>
                <Text style={styles.rememberBody}>
                  Save your sign-in for {biometricMethod} after a successful password login.
                </Text>
              </View>
            </Pressable>
          ) : null}

          {rememberedUsername && !biometricReady ? (
            <Text style={styles.savedSigninHint}>
              Saved sign-in is not ready. Sign in with your password to set up {biometricMethod.toLowerCase()} again.
            </Text>
          ) : null}
        </>
      )}
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
  const newPasswordRef = useRef<TextInput | null>(null);
  const confirmPasswordRef = useRef<TextInput | null>(null);

  return (
    <AuthShell
      eyebrow="Security update"
      title="Finish the secure setup."
      subtitle="Update your password in a cleaner, scrollable form before entering the dashboard."
      highlights={[
        { label: "Step", value: "One-time reset" },
        { label: "Result", value: "Secure access" },
      ]}
      panelTitle="Change password"
      panelSubtitle="Choose a new password for this account. You will use it for future sign-ins."
      footerNote="The new password is applied immediately after this update succeeds."
      error={error}
      loading={loading}
      buttonLabel="Save Password"
      onSubmit={onSubmit}
    >
      {({ registerField, focusField, blurField }) => (
        <>
          <View {...registerField("currentPassword")}>
            <Text style={styles.fieldLabel}>Current password</Text>
            <TextInput
              value={currentPassword}
              onChangeText={onCurrentPasswordChange}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="current-password"
              secureTextEntry
              returnKeyType="next"
              style={styles.input}
              placeholder="Current password"
              placeholderTextColor={palette.subtle}
              onFocus={() => focusField("currentPassword")}
              onBlur={() => blurField("currentPassword")}
              onSubmitEditing={() => newPasswordRef.current?.focus()}
            />
          </View>

          <View {...registerField("newPassword")}>
            <Text style={styles.fieldLabel}>New password</Text>
            <TextInput
              ref={newPasswordRef}
              value={newPassword}
              onChangeText={onNewPasswordChange}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="password-new"
              secureTextEntry
              returnKeyType="next"
              style={styles.input}
              placeholder="New password"
              placeholderTextColor={palette.subtle}
              onFocus={() => focusField("newPassword")}
              onBlur={() => blurField("newPassword")}
              onSubmitEditing={() => confirmPasswordRef.current?.focus()}
            />
          </View>

          <View {...registerField("confirmPassword")}>
            <Text style={styles.fieldLabel}>Confirm new password</Text>
            <TextInput
              ref={confirmPasswordRef}
              value={confirmPassword}
              onChangeText={onConfirmPasswordChange}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="password-new"
              secureTextEntry
              returnKeyType="done"
              style={styles.input}
              placeholder="Confirm new password"
              placeholderTextColor={palette.subtle}
              onFocus={() => focusField("confirmPassword")}
              onBlur={() => blurField("confirmPassword")}
              onSubmitEditing={() => void onSubmit()}
            />
          </View>
        </>
      )}
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
  const [rememberDevice, setRememberDevice] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricReady, setBiometricReady] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [rememberedUsername, setRememberedUsername] = useState("");
  const [biometricLabel, setBiometricLabel] = useState("Sign in with biometrics");

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

  function resetSessionState() {
    setToken(null);
    setUser(null);
    setSchedules([]);
    setAnnouncements([]);
    setScheduleError(null);
    setSearch("");
    setSelectedDay("All");
    setSelectedClassType("All");
    setPassword("");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  }

  async function disableBiometricSignIn(keepRememberedUser = true) {
    if (keepRememberedUser) {
      await Promise.all([clearBiometricCredentials(), setBiometricRememberEnabled(false)]);
    } else {
      await clearRememberedLogin();
      setRememberedUsername("");
    }

    setRememberDevice(false);
    setBiometricReady(false);
  }

  async function restoreSession() {
    const [savedToken, savedRememberedUsername, biometricEnabled, support] = await Promise.all([
      getSessionToken(),
      getStoredRememberedUsername(),
      isBiometricRememberEnabled(),
      getBiometricSupport(),
    ]);

    setRememberedUsername(savedRememberedUsername);
    setRememberDevice(biometricEnabled);
    setBiometricAvailable(support.available);
    setBiometricLabel(support.label);
    setBiometricReady(support.available && biometricEnabled && Boolean(savedRememberedUsername));
    setUsername((current) => current || savedRememberedUsername);

    if (!savedToken) {
      setBootstrapping(false);
      return;
    }

    try {
      const me = await getMe(savedToken);
      if (!me) {
        await clearSessionToken();
        resetSessionState();
      } else {
        setToken(savedToken);
        setUser(me);
      }
    } catch {
      await clearSessionToken();
      resetSessionState();
    } finally {
      setBootstrapping(false);
    }
  }

  async function persistSession(response: AuthResponse) {
    await setSessionToken(response.accessToken);
    setToken(response.accessToken);
    setUser(response.user);
  }

  async function clearSession() {
    await Promise.all([clearSessionToken(), clearRememberedLogin()]);
    resetSessionState();
    setAuthError(null);
    setPasswordError(null);
    setUsername("");
    setRememberedUsername("");
    setRememberDevice(false);
    setBiometricReady(false);
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

  async function handleRememberDeviceChange(nextValue: boolean) {
    setRememberDevice(nextValue);

    if (!nextValue && (biometricReady || rememberedUsername)) {
      await disableBiometricSignIn(false);
    }
  }

  async function handlePasswordLogin() {
    const trimmedUsername = username.trim();
    const trimmedPassword = password.trim();

    if (!trimmedUsername || !trimmedPassword) {
      setAuthError("Username and password are required.");
      return;
    }

    setAuthLoading(true);
    setAuthError(null);
    try {
      const response = await login(trimmedUsername, password);
      await persistSession(response);

      if (rememberDevice && biometricAvailable) {
        await persistRememberedUsername(trimmedUsername);
        await setBiometricRememberEnabled(true);
        setRememberedUsername(trimmedUsername);

        if (!response.user.mustChangePassword) {
          await saveBiometricCredentials({ username: trimmedUsername, password });
          setBiometricReady(true);
        } else {
          setBiometricReady(false);
        }
      } else {
        await clearRememberedLogin();
        setRememberedUsername("");
        setRememberDevice(false);
        setBiometricReady(false);
      }

      setPassword("");
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Authentication failed");
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleBiometricSignIn() {
    if (biometricLoading) {
      return;
    }

    setBiometricLoading(true);
    setAuthError(null);
    try {
      const support = await getBiometricSupport();
      setBiometricAvailable(support.available);
      setBiometricLabel(support.label);

      if (!support.available) {
        throw new Error("Biometric sign-in is not available on this device.");
      }

      const savedCredentials = await getBiometricCredentials(getBiometricPrompt(support.label));
      if (!savedCredentials) {
        await disableBiometricSignIn(true);
        setAuthError("Saved biometric sign-in is no longer available. Sign in with your password to set it up again.");
        return;
      }

      const response = await login(savedCredentials.username, savedCredentials.password);
      await persistSession(response);
      setUsername(savedCredentials.username);
      setRememberedUsername(savedCredentials.username);
      setRememberDevice(true);
      setBiometricReady(true);
      setPassword("");
    } catch (error) {
      if (isBiometricPromptCancelled(error)) {
        return;
      }

      const message = error instanceof Error ? error.message : "Biometric sign-in failed";
      if (isInvalidCredentialsMessage(message)) {
        await disableBiometricSignIn(true);
        setAuthError("Saved sign-in details are no longer valid. Sign in with your password to set up biometrics again.");
      } else {
        setAuthError(message);
      }
    } finally {
      setBiometricLoading(false);
    }
  }

  async function handlePasswordChange() {
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

      if (rememberDevice && biometricAvailable) {
        await persistRememberedUsername(response.user.username);
        await setBiometricRememberEnabled(true);
        await saveBiometricCredentials({ username: response.user.username, password: newPassword });
        setRememberedUsername(response.user.username);
        setBiometricReady(true);
      } else {
        await clearRememberedLogin();
        setRememberedUsername("");
        setRememberDevice(false);
        setBiometricReady(false);
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : "Password update failed");
    } finally {
      setPasswordLoading(false);
    }
  }

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
          rememberDevice={rememberDevice}
          biometricAvailable={biometricAvailable}
          biometricReady={biometricReady}
          biometricLoading={biometricLoading}
          rememberedUsername={rememberedUsername}
          biometricLabel={biometricLabel}
          onUsernameChange={setUsername}
          onPasswordChange={setPassword}
          onRememberDeviceChange={handleRememberDeviceChange}
          onBiometricSubmit={handleBiometricSignIn}
          onSubmit={handlePasswordLogin}
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
          onSubmit={handlePasswordChange}
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
    backgroundColor: palette.page,
  },
  authRoot: {
    flex: 1,
    backgroundColor: palette.page,
  },
  authBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: palette.page,
  },
  authGlowTop: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 999,
    backgroundColor: "rgba(112, 158, 255, 0.16)",
    top: -80,
    right: -40,
  },
  authGlowBottom: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: "rgba(36, 88, 211, 0.08)",
    bottom: -60,
    left: -40,
  },
  authScroll: {
    flexGrow: 1,
    paddingTop: 12,
    paddingBottom: 52,
  },
  authFrame: {
    alignSelf: "center",
    width: "100%",
    gap: 14,
  },
  authHeroCard: {
    borderRadius: radii.lg,
    overflow: "hidden",
    padding: 22,
    gap: 16,
    borderWidth: 1,
    borderColor: "#d8e6fb",
  },
  authHeroOrbLarge: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 999,
    backgroundColor: "rgba(36,88,211,0.08)",
    top: -30,
    right: -30,
  },
  authHeroOrbSmall: {
    position: "absolute",
    width: 90,
    height: 90,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.78)",
    bottom: 12,
    left: -12,
  },
  authHeroTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  authHeroEyebrow: {
    color: palette.accent,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  authHeroPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: "#edf4ff",
    borderWidth: 1,
    borderColor: "#d4e4ff",
  },
  authHeroPillText: {
    color: palette.accentDeep,
    fontSize: 12,
    fontWeight: "700",
  },
  authHeroTitle: {
    color: palette.ink,
    fontSize: 30,
    fontWeight: "800",
    lineHeight: 36,
    maxWidth: 360,
  },
  authHeroSubtitle: {
    color: palette.body,
    fontSize: 15,
    lineHeight: 22,
    maxWidth: 380,
  },
  authHighlightRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  authHighlightCard: {
    minWidth: 132,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "rgba(255,255,255,0.78)",
    borderWidth: 1,
    borderColor: "#d8e6fb",
    gap: 2,
  },
  authHighlightLabel: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  authHighlightValue: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: "800",
  },
  authPanel: {
    borderRadius: radii.lg,
    backgroundColor: palette.panel,
    padding: 20,
    gap: 16,
    borderWidth: 1,
    borderColor: palette.line,
  },
  authPanelHeader: {
    gap: 4,
  },
  authPanelTitle: {
    color: palette.ink,
    fontSize: 24,
    fontWeight: "800",
  },
  authPanelSubtitle: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  authCompactIntro: {
    gap: 12,
    paddingBottom: 2,
  },
  authCompactEyebrow: {
    color: palette.accent,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.1,
  },
  authCompactTitle: {
    color: palette.ink,
    fontSize: 28,
    fontWeight: "800",
    lineHeight: 34,
  },
  authCompactSubtitle: {
    color: palette.body,
    fontSize: 14,
    lineHeight: 21,
  },
  authCompactHighlightRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  authCompactHighlightChip: {
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: "#edf4ff",
    borderWidth: 1,
    borderColor: "#d4e4ff",
    gap: 2,
  },
  authCompactHighlightLabel: {
    color: palette.muted,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  authCompactHighlightValue: {
    color: palette.accentDeep,
    fontSize: 13,
    fontWeight: "800",
  },
  authFootnote: {
    borderRadius: radii.md,
    padding: 12,
    backgroundColor: "#f5f8fc",
  },
  authFootnoteText: {
    color: palette.body,
    fontSize: 12,
    lineHeight: 18,
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
  rememberToggle: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "#dbe4f0",
    backgroundColor: "#f8fbff",
    padding: 14,
  },
  rememberIndicator: {
    width: 22,
    height: 22,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: "#9db5d9",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  rememberIndicatorActive: {
    backgroundColor: palette.accent,
    borderColor: palette.accent,
  },
  rememberIndicatorDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: "#ffffff",
  },
  rememberCopy: {
    flex: 1,
    gap: 4,
  },
  rememberTitle: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: "700",
  },
  rememberBody: {
    color: palette.body,
    fontSize: 13,
    lineHeight: 19,
  },
  savedSigninHint: {
    color: palette.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  primaryButton: {
    backgroundColor: palette.ink,
    minHeight: 52,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButton: {
    minHeight: 50,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "#bfd2fa",
    backgroundColor: "#edf4ff",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
  },
  authSecondaryAction: {
    gap: 8,
  },
  savedSigninLabel: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  secondaryButtonText: {
    color: palette.accentDeep,
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
