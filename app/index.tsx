import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { getMyProfile } from "../services/profileService";

export default function Index() {
  const [ready, setReady] = useState(false);
  const [route, setRoute] = useState<
    "welcome" | "pending" | "approved" | "blocked" | "deleted"
  >("welcome");

  useEffect(() => {
    const init = async () => {
      try {
        const profile = await getMyProfile();

        if (!profile) {
          setRoute("welcome");
          setReady(true);
          return;
        }

        if (profile.is_deleted) {
          setRoute("deleted");
        } else if (profile.is_blocked) {
          setRoute("blocked");
        } else if (profile.moderation_status === "approved") {
          setRoute("approved");
        } else {
          setRoute("pending");
        }
      } catch {
        setRoute("welcome");
      } finally {
        setReady(true);
      }
    };

    init();
  }, []);

  if (!ready) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#2E7D32" />
      </View>
    );
  }

  if (route === "deleted") {
    return <Redirect href="/profile-deleted" />;
  }

  if (route === "blocked") {
    return <Redirect href="/access-restricted" />;
  }

  if (route === "approved") {
    return <Redirect href="/splash" />;
  }

  if (route === "pending") {
    return <Redirect href="/pending-approval" />;
  }

  return <Redirect href="/welcome" />;
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
});
