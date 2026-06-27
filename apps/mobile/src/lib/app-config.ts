import { Platform } from "react-native";

function resolveDefaultApiBaseUrl(): string {
  if (Platform.OS === "android") {
    return "http://10.0.2.2:4000";
  }

  return "http://localhost:4000";
}

export const API_BASE_URL = (
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  resolveDefaultApiBaseUrl()
).replace(/\/+$/, "");
