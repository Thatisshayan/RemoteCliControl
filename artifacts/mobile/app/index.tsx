import { Redirect } from "expo-router";
import { useRuntimeConfig } from "../lib/runtime-config";

export default function Index() {
  const { hydrated, onboardingComplete } = useRuntimeConfig();

  if (!hydrated) return null;
  if (!onboardingComplete) return <Redirect href="/onboarding" />;
  return <Redirect href="/(tabs)/terminal" />;
}
