import type { StyleProp, ViewStyle } from "react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { NoteSummary } from "@notesync/shared-types";
import { colors } from "../theme";

export function NoteCard(props: {
  note: NoteSummary;
  selected?: boolean;
  compact?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  onPress(): void;
}) {
  const { note, onPress, selected, compact, containerStyle } = props;

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.card,
        compact ? styles.cardCompact : null,
        selected ? styles.cardSelected : null,
        containerStyle
      ]}
    >
      <View style={styles.row}>
        <Text numberOfLines={2} style={[styles.title, compact ? styles.titleCompact : null]}>
          {note.title}
        </Text>
        {!compact ? <Text style={styles.badge}>{note.format.toUpperCase()}</Text> : null}
      </View>
      <Text numberOfLines={compact ? 4 : 2} style={[styles.excerpt, compact ? styles.excerptCompact : null]}>
        {note.excerpt || "No preview available yet."}
      </Text>
      <View style={styles.row}>
        <Text numberOfLines={1} style={styles.meta}>
          {compact ? note.format.toUpperCase() : note.syncState.replace("-", " ")}
        </Text>
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
  cardCompact: {
    justifyContent: "space-between",
    minHeight: 174,
    padding: 14
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
  titleCompact: {
    fontSize: 15,
    lineHeight: 20,
    marginRight: 0
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
  excerptCompact: {
    fontSize: 13,
    lineHeight: 18
  },
  meta: {
    color: colors.inkSoft,
    fontSize: 12
  }
});
