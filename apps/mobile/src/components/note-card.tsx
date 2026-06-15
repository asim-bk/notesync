import { Pressable, StyleSheet, Text, View } from "react-native";
import type { NoteSummary } from "@notesync/shared-types";
import { colors } from "../theme";

export function NoteCard(props: {
  note: NoteSummary;
  onPress(): void;
}) {
  const { note, onPress } = props;

  return (
    <Pressable onPress={onPress} style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.title}>{note.title}</Text>
        <Text style={styles.badge}>{note.format.toUpperCase()}</Text>
      </View>
      <Text style={styles.excerpt}>{note.excerpt || "No preview available yet."}</Text>
      <View style={styles.row}>
        <Text style={styles.meta}>{note.syncState}</Text>
        <Text style={styles.meta}>{new Date(note.updatedAt).toLocaleDateString()}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 10,
    padding: 16
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  title: {
    color: colors.text,
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
    marginRight: 12
  },
  badge: {
    color: colors.primaryAlt,
    fontSize: 12,
    fontWeight: "700"
  },
  excerpt: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20
  },
  meta: {
    color: colors.textMuted,
    fontSize: 12
  }
});
