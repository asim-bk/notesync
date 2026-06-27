import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import type { AuthSession } from "@notesync/shared-types";

const AUTH_STORAGE_KEY = "notesync.auth-state";

export interface StoredAuthState {
  session: AuthSession;
  syncSecret: string;
}

export async function readStoredAuthState(): Promise<StoredAuthState | null> {
  const raw = await readValue();
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as StoredAuthState;
  } catch {
    return null;
  }
}

export async function writeStoredAuthState(state: StoredAuthState): Promise<void> {
  await writeValue(JSON.stringify(state));
}

export async function clearStoredAuthState(): Promise<void> {
  if (Platform.OS === "web") {
    try {
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
    } catch {
      // best-effort
    }
    return;
  }

  await SecureStore.deleteItemAsync(AUTH_STORAGE_KEY);
}

async function readValue(): Promise<string | null> {
  if (Platform.OS === "web") {
    try {
      return window.localStorage.getItem(AUTH_STORAGE_KEY);
    } catch {
      return null;
    }
  }

  return SecureStore.getItemAsync(AUTH_STORAGE_KEY);
}

async function writeValue(value: string): Promise<void> {
  if (Platform.OS === "web") {
    try {
      window.localStorage.setItem(AUTH_STORAGE_KEY, value);
    } catch {
      // best-effort
    }
    return;
  }

  await SecureStore.setItemAsync(AUTH_STORAGE_KEY, value, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY
  });
}
