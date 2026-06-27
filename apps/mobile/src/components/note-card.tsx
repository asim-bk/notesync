import { Pressable, StyleSheet, Text, View } from "react-native";
import type { NoteSummary } from "@notesync/shared-types";
import { colors } from "../theme";

export function NoteCard(props: {
  note: NoteSummary;
  selected?: boolean;
  onPress(): void;
}) {
  const { note, onPress, selected } = props;

  return (
    <Pressable onPress={onPress} style={[styles.card, selected ? styles.cardSelected : null]}>
      <View style={styles.row}>
        <Text numberOfLines={1} style={styles.title}>
          {note.title}
        </Text>
        <Text style={styles.badge}>{note.format.toUpperCase()}</Text>
      </View>
      <Text numberOfLines={2} style={styles.excerpt}>
        {note.excerpt || "No preview available yet."}
      </Text>
      <View style={styles.row}>
        <Text style={styles.meta}>{note.syncState.replace("-", " ")}</Text>
        <Text style={styles.meta}>{new Date(note.updatedAt).toLocaleDateString()}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.paper,
    borderColor: "#d7ceb8",
    borderRadius: 8,
    borderWidth: 1,
    gap: 10,
    padding: 16
  },
  cardSelected: {
    borderColor: colors.primaryStrong,
    backgroundColor: colors.paperMuted
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  title: {
    color: colors.ink,
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
    marginRight: 12
  },
  badge: {
    color: colors.inkSoft,
    flexShrink: 0,
    fontSize: 12,
    fontWeight: "700"
  },
  excerpt: {
    color: colors.inkSoft,
    fontSize: 14,
    lineHeight: 20
  },
  meta: {
    color: colors.inkSoft,
    fontSize: 12
  }
});
