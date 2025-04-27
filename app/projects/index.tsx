import React, { useState } from "react";
import { View } from "react-native";
import { Card, Chip, List, SegmentedButtons } from "react-native-paper";
import { Stack } from "expo-router";

const current = [
  { id: "c1", title: "Spider Robot", role: "ML Engineer" },
];
const finished = [
  { id: "f1", title: "CS147 Design Project", role: "Designer" },
];

export default function ProjectsScreen() {
  const [section, setSection] = useState<"current" | "finished">("current");
  const data = section === "current" ? current : finished;

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: "My Projects" }} />

      <SegmentedButtons
        value={section}
        onValueChange={(v) => setSection(v as any)}
        buttons={[
          { value: "current",  label: "Current" },
          { value: "finished", label: "Finished" },
        ]}
        style={{ margin: 8 }}
      />

      {data.map((p) => (
        <Card key={p.id} style={{ margin: 8 }}>
          <Card.Title title={p.title} subtitle={p.role} />
        </Card>
      ))}
    </View>
  );
}
