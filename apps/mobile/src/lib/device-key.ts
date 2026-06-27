import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { createLocalId } from "./id";

const DEVICE_SECRET_KEY = "notesync.device-secret";

export async function getOrCreateDeviceSecret(): Promise<string> {
  const existingSecret = await readSecret();
  if (existingSecret) {
    return existingSecret;
  }

  const nextSecret = createSecret();
  await writeSecret(nextSecret);
  return nextSecret;
}

async function readSecret(): Promise<string | null> {
  if (Platform.OS === "web") {
    return readWebSecret();
  }

  return SecureStore.getItemAsync(DEVICE_SECRET_KEY);
}

async function writeSecret(secret: string): Promise<void> {
  if (Platform.OS === "web") {
    writeWebSecret(secret);
    return;
  }

  await SecureStore.setItemAsync(DEVICE_SECRET_KEY, secret, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY
  });
}

function createSecret(): string {
  if (globalThis.crypto?.getRandomValues) {
    const bytes = globalThis.crypto.getRandomValues(new Uint8Array(32));
    return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
  }

  return `${createLocalId("device")}-${Date.now().toString(16)}`;
}

function readWebSecret(): string | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) {
      return null;
    }

    return window.localStorage.getItem(DEVICE_SECRET_KEY);
  } catch {
    return null;
  }
}

function writeWebSecret(secret: string): void {
  try {
    if (typeof window === "undefined" || !window.localStorage) {
      return;
    }

    window.localStorage.setItem(DEVICE_SECRET_KEY, secret);
  } catch {
    // Web fallback remains best-effort.
  }
}
