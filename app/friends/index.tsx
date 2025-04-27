import React, { useMemo, useState } from "react";
import { FlashList } from "@shopify/flash-list";
import { StyleSheet, View } from "react-native";
import {
  Avatar,
  Divider,
  IconButton,
  List,
  Menu,
  Provider as PaperProvider,
  Text,
  useTheme,
} from "react-native-paper";
import { Stack } from "expo-router";

/* ------------------------------------------------------------------ */
/* dummy data – replace with Firestore query later                    */
type Friend = {
  id: string;
  name: string;
  handle: string;
  online?: boolean;
  joined: number; // unix-time (used for “latest” sorting)
};
const SAMPLE: Friend[] = [
  {
    id: "1",
    name: "Ada Byron",
    handle: "@adab",
    online: true,
    joined: 1714413560,
  },
  {
    id: "2",
    name: "Grace Hopper",
    handle: "@hopper",
    joined: 1714313560,
  },
  {
    id: "3",
    name: "Linus Torvalds",
    handle: "@linus",
    joined: 1712213560,
  },
];

/* ------------------------------------------------------------------ */
export default function Friends() {
  const { colors } = useTheme();

  /* view state */
  const [order, setOrder] = useState<"default" | "latest" | "alpha">("default");
  const [menuVisible, setMenuVisible] = useState(false);

  /* derived sorted data */
  const data = useMemo(() => {
    switch (order) {
      case "latest":
        return [...SAMPLE].sort((a, b) => b.joined - a.joined);
      case "alpha":
        return [...SAMPLE].sort((a, b) => a.name.localeCompare(b.name));
      default:
        return [...SAMPLE].sort((a, b) => a.joined - b.joined); // oldest → newest
    }
  }, [order]);

  /* ---------------------------------------------------------------- */
  return (
    <PaperProvider>
      <View style={styles.container}>
        <Stack.Screen options={{ title: "Friends" }} />

        {/* ---------- Sort-by bar ----------------------------------- */}
        <View style={styles.sortBar}>
          <Text variant="labelLarge">
            Sort&nbsp;by&nbsp;
            <Text style={{ fontWeight: "600" }}>
              {order === "default"
                ? "Default"
                : order === "latest"
                ? "Latest"
                : "Alphabetical"}
            </Text>
          </Text>

          <Menu
            visible={menuVisible}
            onDismiss={() => setMenuVisible(false)}
            anchor={
              <IconButton
                icon="chevron-down"
                size={20}
                onPress={() => setMenuVisible(true)}
              />
            }
          >
            <Menu.Item
              onPress={() => {
                setOrder("default");
                setMenuVisible(false);
              }}
              title="Default"
            />
            <Menu.Item
              onPress={() => {
                setOrder("latest");
                setMenuVisible(false);
              }}
              title="Latest"
            />
            <Menu.Item
              onPress={() => {
                setOrder("alpha");
                setMenuVisible(false);
              }}
              title="Alphabetical"
            />
          </Menu>
        </View>

        {/* ---------- list ------------------------------------------ */}
        <FlashList
          data={data}
          estimatedItemSize={60}
          ItemSeparatorComponent={Divider}
          renderItem={({ item }) => (
            <List.Item
              title={() => (
                <View style={styles.inlineName}>
                  <Text variant="bodyLarge">{item.name}</Text>

                  {/* tiny status dot */}
                  <List.Icon
                    icon="circle"
                    size={12}
                    color={
                      item.online ? colors.primary : colors.onSurfaceDisabled
                    }
                    style={{ marginLeft: 6, marginRight: 0 }}
                  />
                </View>
              )}
              description={item.handle}
              left={() => (
                <Avatar.Text
                  size={36}
                  label={item.name[0]}
                  style={{ backgroundColor: "#90caf9" }}
                />
              )}
            />
          )}
        />
      </View>
    </PaperProvider>
  );
}

/* ------------------------------------------------------------------ */
const styles = StyleSheet.create({
  container: { flex: 1 },
  sortBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  inlineName: { flexDirection: "row", alignItems: "center" },
});
