import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions
} from "react-native";
import { NoteCard } from "./components/note-card";
import { useNotesApp } from "./hooks/use-notes-app";
import { colors } from "./theme";

const SIDEBAR_WIDTH = 320;
const INSPECTOR_WIDTH = 300;

export default function App() {
  const app = useNotesApp();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1180;
  const isTablet = width >= 860;
  const isMobile = !isTablet;

  const noteCount = app.summaries.length;
  const protectedCount = app.encryptedNoteCount;
  const syncedCount = app.summaries.filter((note) => note.syncState === "synced").length;
  const activeSummary = app.summaries.find((note) => note.id === app.activeStoredNote?.note.id) ?? null;

  if (!app.ready) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingScreen}>
          <Text style={styles.brandTitle}>NoteSync</Text>
          <Text style={styles.loadingText}>
            Preparing encrypted local storage and device keychain access.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (app.error) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingScreen}>
          <Text style={styles.brandTitle}>NoteSync</Text>
          <Text style={styles.errorText}>Startup failed: {app.error}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.shell}>
        <View style={[styles.topBar, isTablet ? styles.topBarDesktop : null]}>
          <View style={styles.brandBlock}>
            <Text style={styles.brandTitle}>NoteSync</Text>
            <Text style={styles.brandSubtitle}>
              Private notes, paper-like reading surfaces, secure sharing.
            </Text>
          </View>

          <View style={styles.topBarRight}>
            <View style={styles.statusPill}>
              <View style={[styles.statusDot, { backgroundColor: colors.success }]} />
              <Text style={styles.statusPillText}>Device vault active</Text>
            </View>
            {!isMobile ? (
              <Pressable onPress={() => app.startNewNote()} style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>New note</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        <ScrollView
          horizontal={isMobile}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.statsRow, isMobile ? styles.statsRowMobile : null]}
        >
          <MetricCard label="Encrypted" value={`${protectedCount}`} meta="AES-256-GCM" />
          <MetricCard label="Available notes" value={`${noteCount}`} meta="Offline first" />
          <MetricCard label="Synced" value={`${syncedCount}/${noteCount}`} meta="Hybrid model" />
        </ScrollView>

        {isMobile ? (
          <View style={styles.mobileSwitchRow}>
            <SwitchButton
              label="Notes"
              active={app.screen === "list"}
              onPress={() => app.setScreen("list")}
            />
            <SwitchButton
              label="Editor"
              active={app.screen === "editor"}
              onPress={() => app.setScreen("editor")}
            />
            <SwitchButton
              label="Share"
              active={app.screen === "share"}
              onPress={() => app.setScreen("share")}
            />
          </View>
        ) : null}

        <View style={[styles.workspace, !isTablet ? styles.workspaceStacked : null]}>
          {isMobile ? (
            <>
              {app.screen === "list" ? (
                <View style={styles.mobilePanel}>
                  {renderSidebar(app, noteCount)}
                </View>
              ) : null}

              {app.screen === "editor" ? (
                <View style={styles.mobilePanel}>
                  {renderEditor(app, activeSummary, isTablet)}
                </View>
              ) : null}

              {app.screen === "share" ? (
                <View style={styles.mobilePanel}>
                  {renderInspector(app)}
                </View>
              ) : null}
            </>
          ) : (
            <>
              <View style={[styles.sidebar, isDesktop ? { width: SIDEBAR_WIDTH } : null]}>
                {renderSidebar(app, noteCount)}
              </View>
              <View style={styles.editorSurface}>{renderEditor(app, activeSummary, isTablet)}</View>
              <View style={[styles.inspector, isDesktop ? { width: INSPECTOR_WIDTH } : null]}>
                {renderInspector(app)}
              </View>
            </>
          )}
        </View>

        {isMobile ? (
          <View style={styles.mobileBottomBar}>
            <Pressable onPress={() => app.setScreen("list")} style={styles.mobileGhostButton}>
              <Text style={styles.mobileGhostButtonText}>Library</Text>
            </Pressable>
            <Pressable onPress={() => app.startNewNote()} style={styles.mobilePrimaryButton}>
              <Text style={styles.primaryButtonText}>New note</Text>
            </Pressable>
            <Pressable onPress={() => app.setScreen("share")} style={styles.mobileGhostButton}>
              <Text style={styles.mobileGhostButtonText}>Share</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

function renderSidebar(app: ReturnType<typeof useNotesApp>, noteCount: number) {
  return (
    <>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Workspace</Text>
        <Text style={styles.sectionMeta}>{noteCount} notes</Text>
      </View>

      <View style={styles.filterRow}>
        <Pill label="Markdown" active />
        <Pill label="HTML" />
        <Pill label="RTF" />
      </View>

      <ScrollView contentContainerStyle={styles.noteList}>
        {app.summaries.map((note) => (
        <NoteCard
          key={note.id}
          note={note}
          selected={note.id === app.activeStoredNote?.note.id}
          onPress={() => void app.editNote(note.id)}
        />
      ))}
    </ScrollView>
    </>
  );
}

function renderEditor(
  app: ReturnType<typeof useNotesApp>,
  activeSummary: { format: string } | null,
  isTablet: boolean
) {
  return (
    <>
      <View style={styles.editorHeader}>
        <View>
          <Text style={styles.editorTitle}>
            {app.activeStoredNote ? "Current note" : "Start a secure note"}
          </Text>
          <Text style={styles.editorSubtitle}>
            Mobile-friendly note writing with a paper reading surface and local encryption.
          </Text>
        </View>

        <View style={styles.headerBadges}>
          <Pill label={activeSummary?.format.toUpperCase() ?? "MARKDOWN"} active />
          <Pill label="Paper view" />
          <Pill label="Offline" />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.editorScroll}>
        <View style={styles.inputGroup}>
          <Text style={styles.fieldLabel}>Title</Text>
          <TextInput
            onChangeText={(title) => app.setDraft((current) => ({ ...current, title }))}
            placeholder="Research session notes"
            placeholderTextColor={colors.inkSoft}
            style={styles.titleInput}
            value={app.draft.title}
          />
        </View>

        <View style={styles.inputGroup}>
          <View style={styles.fieldHeaderRow}>
            <Text style={styles.fieldLabel}>Content</Text>
            <Text style={styles.fieldHint}>Markdown editor</Text>
          </View>
          <TextInput
            multiline
            onChangeText={(content) => app.setDraft((current) => ({ ...current, content }))}
            placeholder="Capture structured notes, references and action items."
            placeholderTextColor={colors.inkSoft}
            style={styles.contentInput}
            textAlignVertical="top"
            value={app.draft.content}
          />
        </View>

        <View style={[styles.actionsRow, !isTablet ? styles.actionsRowStacked : null]}>
          <Pressable onPress={() => app.setScreen("list")} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Return to notes</Text>
          </Pressable>
          <Pressable
            disabled={app.loading}
            onPress={() => void app.saveNote()}
            style={styles.primaryButtonLarge}
          >
            <Text style={styles.primaryButtonText}>
              {app.loading ? "Encrypting..." : "Save encrypted note"}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </>
  );
}

function renderInspector(app: ReturnType<typeof useNotesApp>) {
  return (
    <>
      <View style={styles.inspectorSection}>
        <Text style={styles.sectionTitle}>Security</Text>
        <View style={styles.securityList}>
          <SecurityRow label="Local ownership" value="Stored on device" />
          <SecurityRow label="Cipher" value="AES-256-GCM" />
          <SecurityRow label="Share access" value="URL + password" />
          <SecurityRow label="Session model" value="JWT API auth" />
        </View>
      </View>

      <View style={styles.inspectorSection}>
        <Text style={styles.sectionTitle}>Share panel</Text>
        <Text style={styles.panelCopy}>
          Generate a protected note preview with optional password control and limited views.
        </Text>
        <TextInput
          onChangeText={app.setSharePassword}
          placeholder="Optional share password"
          placeholderTextColor={colors.textSoft}
          secureTextEntry
          style={styles.inlineInput}
          value={app.sharePassword}
        />
        <Pressable onPress={() => void app.openSharePreview()} style={styles.accentButton}>
          <Text style={styles.primaryButtonText}>Generate secure preview</Text>
        </Pressable>
      </View>

      <View style={styles.inspectorSection}>
        <Text style={styles.sectionTitle}>Export targets</Text>
        <View style={styles.filterRowWrap}>
          <Pill label="PDF" active />
          <Pill label="Word" />
          <Pill label="Markdown" />
          <Pill label="HTML" />
        </View>
      </View>

      <View style={styles.inspectorSection}>
        <Text style={styles.sectionTitle}>Latest share</Text>
        {app.sharePreview ? (
          <View style={styles.sharePreviewCard}>
            <InfoLine label="Slug" value={app.sharePreview.slug} />
            <InfoLine label="Format" value={app.sharePreview.format.toUpperCase()} />
            <InfoLine
              label="Password"
              value={app.sharePreview.policy.passwordProtected ? "Protected" : "Not set"}
            />
            <InfoLine
              label="View limit"
              value={`${app.sharePreview.policy.maxViews ?? "Unlimited"}`}
            />
          </View>
        ) : (
          <View style={styles.emptyPanel}>
            <Text style={styles.emptyPanelText}>No share generated yet.</Text>
          </View>
        )}
      </View>
    </>
  );
}

function MetricCard(props: { label: string; value: string; meta: string }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{props.label}</Text>
      <Text style={styles.metricValue}>{props.value}</Text>
      <Text style={styles.metricMeta}>{props.meta}</Text>
    </View>
  );
}

function Pill(props: { label: string; active?: boolean }) {
  return (
    <View style={[styles.pill, props.active ? styles.pillActive : null]}>
      <Text style={[styles.pillText, props.active ? styles.pillTextActive : null]}>{props.label}</Text>
    </View>
  );
}

function SwitchButton(props: { label: string; active?: boolean; onPress(): void }) {
  return (
    <Pressable onPress={props.onPress} style={[styles.switchButton, props.active ? styles.switchButtonActive : null]}>
      <Text style={[styles.switchButtonText, props.active ? styles.switchButtonTextActive : null]}>
        {props.label}
      </Text>
    </Pressable>
  );
}

function SecurityRow(props: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{props.label}</Text>
      <Text style={styles.infoValue}>{props.value}</Text>
    </View>
  );
}

function InfoLine(props: { label: string; value: string }) {
  return (
    <View style={styles.infoLine}>
      <Text style={styles.infoLineLabel}>{props.label}</Text>
      <Text numberOfLines={1} style={styles.infoLineValue}>
        {props.value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.bg,
    flex: 1
  },
  shell: {
    backgroundColor: colors.bg,
    flex: 1,
    paddingBottom: 12,
    paddingHorizontal: 16,
    paddingTop: 14
  },
  loadingScreen: {
    alignItems: "center",
    backgroundColor: colors.bg,
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 10,
    maxWidth: 320,
    textAlign: "center"
  },
  errorText: {
    color: colors.warning,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 10,
    maxWidth: 340,
    textAlign: "center"
  },
  topBar: {
    gap: 14,
    marginBottom: 14
  },
  topBarDesktop: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  brandBlock: {
    flex: 1,
    maxWidth: 760
  },
  brandTitle: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "800"
  },
  brandSubtitle: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 6
  },
  topBarRight: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  statusPill: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    minHeight: 40,
    paddingHorizontal: 14
  },
  statusDot: {
    borderRadius: 999,
    height: 8,
    width: 8
  },
  statusPillText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "600"
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 14
  },
  statsRowMobile: {
    paddingRight: 8
  },
  metricCard: {
    backgroundColor: colors.bgElevated,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 104,
    minWidth: 170,
    padding: 16
  },
  metricLabel: {
    color: colors.textMuted,
    fontSize: 12,
    marginBottom: 12
  },
  metricValue: {
    color: colors.text,
    fontSize: 26,
    fontWeight: "800"
  },
  metricMeta: {
    color: colors.textSoft,
    fontSize: 12,
    marginTop: 8
  },
  mobileSwitchRow: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
    padding: 6
  },
  switchButton: {
    alignItems: "center",
    borderRadius: 6,
    flex: 1,
    justifyContent: "center",
    minHeight: 40,
    paddingHorizontal: 10
  },
  switchButtonActive: {
    backgroundColor: colors.panelSoft
  },
  switchButtonText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "600"
  },
  switchButtonTextActive: {
    color: colors.text
  },
  workspace: {
    flex: 1,
    flexDirection: "row",
    gap: 14,
    minHeight: 0
  },
  workspaceStacked: {
    flexDirection: "column"
  },
  mobilePanel: {
    flex: 1,
    minHeight: 0
  },
  sidebar: {
    backgroundColor: colors.bgElevated,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 0,
    padding: 14
  },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700"
  },
  sectionMeta: {
    color: colors.textSoft,
    fontSize: 12
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 14
  },
  filterRowWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  noteList: {
    gap: 10,
    paddingBottom: 10
  },
  editorSurface: {
    backgroundColor: colors.bgElevated,
    borderColor: colors.borderStrong,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    minHeight: 0,
    padding: 16
  },
  editorHeader: {
    gap: 12,
    marginBottom: 16
  },
  editorTitle: {
    color: colors.text,
    fontSize: 21,
    fontWeight: "800"
  },
  editorSubtitle: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6
  },
  headerBadges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  editorScroll: {
    gap: 16,
    paddingBottom: 12
  },
  inputGroup: {
    gap: 10
  },
  fieldHeaderRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  fieldLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "700"
  },
  fieldHint: {
    color: colors.textSoft,
    fontSize: 12
  },
  titleInput: {
    backgroundColor: colors.paper,
    borderColor: "#d7ceb8",
    borderRadius: 8,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 18,
    minHeight: 54,
    paddingHorizontal: 14,
    paddingVertical: 14
  },
  contentInput: {
    backgroundColor: colors.paper,
    borderColor: "#d7ceb8",
    borderRadius: 8,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 15,
    lineHeight: 22,
    minHeight: 340,
    padding: 16
  },
  actionsRow: {
    flexDirection: "row",
    gap: 12,
    justifyContent: "flex-end"
  },
  actionsRowStacked: {
    flexDirection: "column"
  },
  inspector: {
    backgroundColor: colors.bgElevated,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 14,
    padding: 14
  },
  inspectorSection: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    padding: 14
  },
  panelCopy: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 20
  },
  securityList: {
    gap: 10
  },
  infoRow: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    gap: 4,
    paddingBottom: 10
  },
  infoLabel: {
    color: colors.textSoft,
    fontSize: 12
  },
  infoValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600"
  },
  inlineInput: {
    backgroundColor: colors.panelMuted,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.text,
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  emptyPanel: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: 8,
    borderStyle: "dashed",
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 96,
    padding: 18
  },
  emptyPanelText: {
    color: colors.textSoft,
    fontSize: 13
  },
  sharePreviewCard: {
    gap: 10
  },
  infoLine: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  infoLineLabel: {
    color: colors.textSoft,
    fontSize: 12
  },
  infoLineValue: {
    color: colors.text,
    flexShrink: 1,
    fontSize: 13,
    fontWeight: "600",
    marginLeft: 12,
    textAlign: "right"
  },
  pill: {
    backgroundColor: colors.panelMuted,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 32,
    paddingHorizontal: 12
  },
  pillActive: {
    backgroundColor: colors.panelSoft,
    borderColor: colors.borderStrong
  },
  pillText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "600"
  },
  pillTextActive: {
    color: colors.text
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.primaryStrong,
    borderRadius: 8,
    justifyContent: "center",
    minHeight: 42,
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  primaryButtonLarge: {
    alignItems: "center",
    backgroundColor: colors.primaryStrong,
    borderRadius: 8,
    flex: 1,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: 18,
    paddingVertical: 12
  },
  accentButton: {
    alignItems: "center",
    backgroundColor: colors.primaryAlt,
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
    backgroundColor: colors.panelSoft,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600"
  },
  mobileBottomBar: {
    backgroundColor: colors.overlay,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
    padding: 10
  },
  mobilePrimaryButton: {
    alignItems: "center",
    backgroundColor: colors.primaryStrong,
    borderRadius: 10,
    flex: 1.3,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: 12
  },
  mobileGhostButton: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: 12
  },
  mobileGhostButtonText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "600"
  }
});
