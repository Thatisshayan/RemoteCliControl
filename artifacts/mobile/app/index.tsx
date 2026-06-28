import { useEffect, useState } from "react";
import { Redirect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function Index() {
  const [ready, setReady] = useState(false);
  const [onboarded, setOnboarded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem("onboardingComplete").then((v) => {
      setOnboarded(v === "true");
      setReady(true);
    });
  }, []);

  if (!ready) return null;
  if (!onboarded) return <Redirect href="/onboarding" />;
  return <Redirect href="/(tabs)/terminal" />;
}
