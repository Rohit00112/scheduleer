import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

export const LEGACY_TOKEN_STORAGE_KEY = "scheduler.mobile.token";

const SESSION_TOKEN_STORAGE_KEY = "scheduler.mobile.session-token";
const REMEMBERED_USERNAME_STORAGE_KEY = "scheduler.mobile.remembered-username";
const BIOMETRIC_ENABLED_STORAGE_KEY = "scheduler.mobile.biometric-enabled";
const BIOMETRIC_CREDENTIALS_STORAGE_KEY = "scheduler.mobile.biometric-credentials";

const BIOMETRIC_CREDENTIAL_OPTIONS: SecureStore.SecureStoreOptions = {
  requireAuthentication: true,
};

export type SavedCredentials = {
  username: string;
  password: string;
};

async function removeLegacyToken() {
  await AsyncStorage.removeItem(LEGACY_TOKEN_STORAGE_KEY);
}

export async function getSessionToken(): Promise<string | null> {
  const secureToken = await SecureStore.getItemAsync(SESSION_TOKEN_STORAGE_KEY);
  if (secureToken) {
    await removeLegacyToken();
    return secureToken;
  }

  const legacyToken = await AsyncStorage.getItem(LEGACY_TOKEN_STORAGE_KEY);
  if (!legacyToken) {
    return null;
  }

  await SecureStore.setItemAsync(SESSION_TOKEN_STORAGE_KEY, legacyToken);
  await removeLegacyToken();
  return legacyToken;
}

export async function setSessionToken(token: string) {
  await SecureStore.setItemAsync(SESSION_TOKEN_STORAGE_KEY, token);
}

export async function clearSessionToken() {
  await SecureStore.deleteItemAsync(SESSION_TOKEN_STORAGE_KEY);
  await removeLegacyToken();
}

export async function getRememberedUsername(): Promise<string> {
  return (await SecureStore.getItemAsync(REMEMBERED_USERNAME_STORAGE_KEY)) ?? "";
}

export async function setRememberedUsername(username: string) {
  const normalized = username.trim();
  if (!normalized) {
    await SecureStore.deleteItemAsync(REMEMBERED_USERNAME_STORAGE_KEY);
    return;
  }

  await SecureStore.setItemAsync(REMEMBERED_USERNAME_STORAGE_KEY, normalized);
}

export async function clearRememberedUsername() {
  await SecureStore.deleteItemAsync(REMEMBERED_USERNAME_STORAGE_KEY);
}

export async function isBiometricRememberEnabled(): Promise<boolean> {
  return (await SecureStore.getItemAsync(BIOMETRIC_ENABLED_STORAGE_KEY)) === "true";
}

export async function setBiometricRememberEnabled(enabled: boolean) {
  if (enabled) {
    await SecureStore.setItemAsync(BIOMETRIC_ENABLED_STORAGE_KEY, "true");
    return;
  }

  await SecureStore.deleteItemAsync(BIOMETRIC_ENABLED_STORAGE_KEY);
}

export async function saveBiometricCredentials(credentials: SavedCredentials) {
  await SecureStore.setItemAsync(
    BIOMETRIC_CREDENTIALS_STORAGE_KEY,
    JSON.stringify(credentials),
    BIOMETRIC_CREDENTIAL_OPTIONS,
  );
}

export async function getBiometricCredentials(authenticationPrompt: string): Promise<SavedCredentials | null> {
  const storedValue = await SecureStore.getItemAsync(BIOMETRIC_CREDENTIALS_STORAGE_KEY, {
    ...BIOMETRIC_CREDENTIAL_OPTIONS,
    authenticationPrompt,
  });

  if (!storedValue) {
    return null;
  }

  try {
    const parsedValue = JSON.parse(storedValue) as Partial<SavedCredentials>;
    if (typeof parsedValue.username === "string" && typeof parsedValue.password === "string") {
      return {
        username: parsedValue.username,
        password: parsedValue.password,
      };
    }
  } catch {
    // Fall through and remove the invalid payload below.
  }

  await clearBiometricCredentials();
  return null;
}

export async function clearBiometricCredentials() {
  await SecureStore.deleteItemAsync(BIOMETRIC_CREDENTIALS_STORAGE_KEY);
}

export async function clearRememberedLogin() {
  await Promise.all([
    clearBiometricCredentials(),
    setBiometricRememberEnabled(false),
    clearRememberedUsername(),
  ]);
}
