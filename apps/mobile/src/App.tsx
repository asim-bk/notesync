import { SafeAreaView, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { NoteCard } from "./components/note-card";
import { useNotesApp } from "./hooks/use-notes-app";
import { colors } from "./theme";

export default function App() {
  const app = useNotesApp();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>NoteSync</Text>
            <Text style={styles.subtitle}>Encrypted notes with controlled sharing</Text>
          </View>
          <Pressable onPress={() => app.startNewNote()} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>New note</Text>
          </Pressable>
        </View>

        {app.screen === "list" ? (
          <ScrollView contentContainerStyle={styles.list}>
            {app.summaries.map((note) => (
              <NoteCard key={note.id} note={note} onPress={() => app.editNote(note.id)} />
            ))}
          </ScrollView>
        ) : null}

        {app.screen === "editor" ? (
          <ScrollView contentContainerStyle={styles.editor}>
            <TextInput
              onChangeText={(title) => app.setDraft((current) => ({ ...current, title }))}
              placeholder="Note title"
              placeholderTextColor={colors.textMuted}
              style={styles.titleInput}
              value={app.draft.title}
            />

            <TextInput
              multiline
              onChangeText={(content) => app.setDraft((current) => ({ ...current, content }))}
              placeholder="Write in Markdown"
              placeholderTextColor={colors.textMuted}
              style={styles.contentInput}
              textAlignVertical="top"
              value={app.draft.content}
            />

            <View style={styles.actions}>
              <Pressable onPress={() => app.setScreen("list")} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>Back</Text>
              </Pressable>
              <Pressable
                disabled={app.loading}
                onPress={() => void app.saveNote()}
                style={styles.primaryButton}
              >
                <Text style={styles.primaryButtonText}>
                  {app.loading ? "Saving..." : "Save encrypted"}
                </Text>
              </Pressable>
            </View>

            <View style={styles.sharePanel}>
              <Text style={styles.sectionTitle}>Secure share</Text>
              <TextInput
                onChangeText={app.setSharePassword}
                placeholder="Optional share password"
                placeholderTextColor={colors.textMuted}
                secureTextEntry
                style={styles.inlineInput}
                value={app.sharePassword}
              />
              <Pressable onPress={() => void app.createShare()} style={styles.shareButton}>
                <Text style={styles.primaryButtonText}>Create share preview</Text>
              </Pressable>
            </View>
          </ScrollView>
        ) : null}

        {app.screen === "share" && app.sharePreview ? (
          <View style={styles.shareResult}>
            <Text style={styles.sectionTitle}>Share preview</Text>
            <Text style={styles.shareText}>Slug: {app.sharePreview.slug}</Text>
            <Text style={styles.shareText}>Title: {app.sharePreview.title}</Text>
            <Text style={styles.shareText}>
              Password protected: {app.sharePreview.policy.passwordProtected ? "Yes" : "No"}
            </Text>
            <Text style={styles.shareText}>Max views: {app.sharePreview.policy.maxViews}</Text>
            <Pressable onPress={() => app.setScreen("editor")} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Back to editor</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.bg,
    flex: 1
  },
  container: {
    backgroundColor: colors.bg,
    flex: 1,
    padding: 20
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "800"
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    marginTop: 4
  },
  list: {
    gap: 12,
    paddingBottom: 24
  },
  editor: {
    gap: 14,
    paddingBottom: 24
  },
  titleInput: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.text,
    fontSize: 18,
    paddingHorizontal: 14,
    paddingVertical: 14
  },
  contentInput: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.text,
    fontSize: 15,
    minHeight: 280,
    padding: 14
  },
  actions: {
    flexDirection: "row",
    gap: 12,
    justifyContent: "flex-end"
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 8,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  primaryButtonText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700"
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: colors.panelMuted,
    borderRadius: 8,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600"
  },
  sharePanel: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    marginTop: 8,
    padding: 16
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700"
  },
  inlineInput: {
    backgroundColor: colors.panelMuted,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.text,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  shareButton: {
    alignItems: "center",
    backgroundColor: colors.primaryAlt,
    borderRadius: 8,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  shareResult: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    padding: 16
  },
  shareText: {
    color: colors.textMuted,
    fontSize: 14
  }
});
