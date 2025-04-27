import React, { useEffect, useMemo, useState } from "react";
import { FlatList, Keyboard, StyleSheet, View } from "react-native";
import {
  Chip,
  List,
  TextInput,
  useTheme,
} from "react-native-paper";
import { fetchAllTags, addGlobalTag } from "@/constants/tags";

/* ------------------------------------------------------------------ */
/* props                                                               */
interface Props {
  value: string[];                    // current tag list from parent
  onChange: (tags: string[]) => void; // callback → parent state
  currentUid: string;                 // needed when creating new global tag
}
export default function TagSelector({ value, onChange, currentUid }: Props) {
  /* ------------------------------------------------------------------ */
  const { colors } = useTheme();
  const [allTags, setAllTags] = useState<string[]>([]);
  const [query,   setQuery]   = useState("");

  /* fetch global tag list once */
  useEffect(() => {
    fetchAllTags().then(setAllTags);
  }, []);

  /* ------------------------------------------------------------------ */
  /* derived filtered suggestions                                       */
  const suggestions = useMemo(() => {
    if (query.trim() === "") return [];
    const q = query.toLowerCase();
    return allTags
      .filter((t) => t.toLowerCase().includes(q) && !value.includes(t))
      .slice(0, 6); // show at most 6
  }, [query, allTags, value]);

  /* helpers                                                            */
  const addTag = (tag: string) => {
    onChange([...value, tag]);
    setQuery("");
    Keyboard.dismiss();
  };
  const removeTag = (tag: string) => onChange(value.filter((t) => t !== tag));

  /* ------------------------------------------------------------------ */
  return (
    <View style={styles.container}>
      {/* ----------- selected chips (cards) ------------------------ */}
      <View style={styles.chipRow}>
        {value.map((t) => (
          <Chip
            mode="outlined"
            key={t}
            style={styles.chip}
            onClose={() => removeTag(t)}
            theme={{ colors: { outline: colors.primary } }}
          >
            {t}
          </Chip>
        ))}
      </View>

      {/* ----------- search / add input ---------------------------- */}
      <TextInput
        placeholder="Type to search or add tag…"
        value={query}
        onChangeText={setQuery}
        mode="outlined"
        returnKeyType="done"
        onSubmitEditing={async () => {
          const clean = query.trim();
          if (!clean) return;
          if (!allTags.includes(clean)) {
            await addGlobalTag(clean, currentUid);     // create globally
            setAllTags((prev) => [...prev, clean]);    // keep local list fresh
          }
          addTag(clean);
        }}
      />

      {/* ----------- dropdown suggestions -------------------------- */}
      {suggestions.length > 0 && (
        <FlatList
          data={suggestions}
          keyExtractor={(item) => item}
          renderItem={({ item }) => (
            <List.Item
              title={item}
              onPress={() => addTag(item)}
              left={(props) => <List.Icon {...props} icon="tag" />}
            />
          )}
          style={styles.dropdown}
        />
      )}
    </View>
  );
}

/* -------------------------------------------------------------------- */
const styles = StyleSheet.create({
  container: { width: "100%" },
  chipRow:   { flexDirection: "row", flexWrap: "wrap", marginBottom: 8 },
  chip:      { margin: 2 },
  dropdown:  { maxHeight: 220, marginTop: 4,
               borderRadius: 8, backgroundColor: "#fff", elevation: 4 },
});
