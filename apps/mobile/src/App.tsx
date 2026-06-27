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
import type { NoteFormat, NoteSummary } from "@notesync/shared-types";
import { NoteCard } from "./components/note-card";
import { useNotesApp } from "./hooks/use-notes-app";
import { colors } from "./theme";

const SIDEBAR_WIDTH = 320;
const INSPECTOR_WIDTH = 320;

export default function App() {
  const app = useNotesApp();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1180;
  const isTablet = width >= 860;
  const isMobile = !isTablet;

  const noteCount = app.summaries.length;
  const protectedCount = app.encryptedNoteCount;
  const syncedCount = app.syncedNoteCount;
  const activeSummary = app.summaries.find((note) => note.id === app.activeStoredNote?.note.id) ?? null;

  if (!app.ready) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingScreen}>
          <Text style={styles.brandTitle}>NoteSync</Text>
          <Text style={styles.loadingText}>
            Preparing encrypted local storage, account session, and sync state.
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
              Local-first encrypted notes with account sync, protected shares, and export tools.
            </Text>
          </View>

          <View style={styles.topBarRight}>
            <View style={styles.statusPill}>
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: app.authState ? colors.success : colors.warning }
                ]}
              />
              <Text style={styles.statusPillText}>
                {app.authState ? "Account sync ready" : "Local-only mode"}
              </Text>
            </View>
            {!isMobile ? (
              <Pressable onPress={() => app.startNewNote()} style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>New note</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        {app.statusMessage ? (
          <View style={styles.statusBanner}>
            <Text style={styles.statusBannerText}>{app.statusMessage}</Text>
          </View>
        ) : null}

        <ScrollView
          horizontal={isMobile}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.statsRow, isMobile ? styles.statsRowMobile : null]}
        >
          <MetricCard label="Encrypted" value={`${protectedCount}`} meta="Device vault" />
          <MetricCard label="Notes" value={`${noteCount}`} meta="Paper surfaces" />
          <MetricCard label="Synced" value={`${syncedCount}/${noteCount}`} meta="Account-linked" />
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

      <View style={styles.quickCreateRow}>
        <ActionPill label="Markdown" onPress={() => app.startNewNote("markdown")} />
        <ActionPill label="HTML" onPress={() => app.startNewNote("html")} />
        <ActionPill label="RTF" onPress={() => app.startNewNote("rtf")} />
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
  activeSummary: NoteSummary | null,
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
            Write locally, opt into account sync when needed, and keep export/share flows close.
          </Text>
        </View>

        <View style={styles.headerBadges}>
          <ActionPill
            label="MD"
            active={app.draft.format === "markdown"}
            onPress={() => app.changeFormat("markdown")}
          />
          <ActionPill
            label="HTML"
            active={app.draft.format === "html"}
            onPress={() => app.changeFormat("html")}
          />
          <ActionPill
            label="RTF"
            active={app.draft.format === "rtf"}
            onPress={() => app.changeFormat("rtf")}
          />
          <ActionPill
            label={app.syncEnabled ? "Sync on" : "Local only"}
            active={app.syncEnabled}
            onPress={() => app.setSyncEnabled(!app.syncEnabled)}
          />
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
            <Text style={styles.fieldHint}>
              {activeSummary?.format.toUpperCase() ?? app.draft.format.toUpperCase()}
            </Text>
          </View>
          <TextInput
            multiline
            onChangeText={(content) => app.setDraft((current) => ({ ...current, content }))}
            placeholder="Capture structured notes, references, and action items."
            placeholderTextColor={colors.inkSoft}
            style={styles.contentInput}
            textAlignVertical="top"
            value={app.draft.content}
          />
        </View>

        <View style={[styles.actionsRow, !isTablet ? styles.actionsRowStacked : null]}>
          <Pressable
            disabled={app.loading}
            onPress={() => void app.syncNow()}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>Sync now</Text>
          </Pressable>
          <Pressable
            disabled={app.loading}
            onPress={() => void app.saveNote()}
            style={styles.primaryButtonLarge}
          >
            <Text style={styles.primaryButtonText}>
              {app.loading ? "Working..." : "Save encrypted note"}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </>
  );
}

function renderInspector(app: ReturnType<typeof useNotesApp>) {
  return (
    <ScrollView contentContainerStyle={styles.inspectorScroll}>
      <View style={styles.inspectorSection}>
        <Text style={styles.sectionTitle}>Security</Text>
        <View style={styles.securityList}>
          <SecurityRow label="Local vault" value="AES-256-GCM" />
          <SecurityRow
            label="Account session"
            value={app.authState ? app.authState.session.user.email : "Not connected"}
          />
          <SecurityRow label="Active note mode" value={app.syncEnabled ? "Sync enabled" : "Local only"} />
          <SecurityRow label="Share gate" value="Slug + password" />
        </View>
        <Pressable onPress={() => void app.rotateDeviceKey()} style={styles.secondaryButtonCompact}>
          <Text style={styles.secondaryButtonText}>Rotate device key</Text>
        </Pressable>
      </View>

      <View style={styles.inspectorSection}>
        <Text style={styles.sectionTitle}>Account</Text>
        {app.authState ? (
          <>
            <Text style={styles.panelCopy}>
              Connected as {app.authState.session.user.displayName}. Sync and live share use this session.
            </Text>
            <Pressable onPress={() => void app.signOut()} style={styles.secondaryButtonCompact}>
              <Text style={styles.secondaryButtonText}>Sign out</Text>
            </Pressable>
          </>
        ) : (
          <>
            <View style={styles.segmentedRow}>
              <SegmentButton
                label="Register"
                active={app.authMode === "register"}
                onPress={() => app.setAuthMode("register")}
              />
              <SegmentButton
                label="Login"
                active={app.authMode === "login"}
                onPress={() => app.setAuthMode("login")}
              />
            </View>
            {app.authMode === "register" ? (
              <TextInput
                onChangeText={(displayName) => app.setAuthForm((current) => ({ ...current, displayName }))}
                placeholder="Display name"
                placeholderTextColor={colors.textSoft}
                style={styles.inlineInput}
                value={app.authForm.displayName}
              />
            ) : null}
            <TextInput
              autoCapitalize="none"
              keyboardType="email-address"
              onChangeText={(email) => app.setAuthForm((current) => ({ ...current, email }))}
              placeholder="Email"
              placeholderTextColor={colors.textSoft}
              style={styles.inlineInput}
              value={app.authForm.email}
            />
            <TextInput
              autoCapitalize="none"
              onChangeText={(password) => app.setAuthForm((current) => ({ ...current, password }))}
              placeholder="Password"
              placeholderTextColor={colors.textSoft}
              secureTextEntry
              style={styles.inlineInput}
              value={app.authForm.password}
            />
            <Pressable onPress={() => void app.submitAuth()} style={styles.accentButton}>
              <Text style={styles.primaryButtonText}>
                {app.authMode === "register" ? "Create account" : "Sign in"}
              </Text>
            </Pressable>
          </>
        )}
      </View>

      <View style={styles.inspectorSection}>
        <Text style={styles.sectionTitle}>Share panel</Text>
        <Text style={styles.panelCopy}>
          Share creation encrypts note content again with the share password before sending it to the API.
        </Text>
        <TextInput
          onChangeText={app.setSharePassword}
          placeholder="Share password"
          placeholderTextColor={colors.textSoft}
          secureTextEntry
          style={styles.inlineInput}
          value={app.sharePassword}
        />
        <Pressable onPress={() => void app.openSharePreview()} style={styles.accentButton}>
          <Text style={styles.primaryButtonText}>Create secure share</Text>
        </Pressable>
      </View>

      <View style={styles.inspectorSection}>
        <Text style={styles.sectionTitle}>Share access</Text>
        <TextInput
          autoCapitalize="none"
          onChangeText={app.setShareSlug}
          placeholder="Share slug"
          placeholderTextColor={colors.textSoft}
          style={styles.inlineInput}
          value={app.shareSlug}
        />
        <TextInput
          onChangeText={app.setShareAccessPassword}
          placeholder="Share password"
          placeholderTextColor={colors.textSoft}
          secureTextEntry
          style={styles.inlineInput}
          value={app.shareAccessPassword}
        />
        <Pressable onPress={() => void app.accessSharedNote()} style={styles.secondaryButtonCompact}>
          <Text style={styles.secondaryButtonText}>Open shared note</Text>
        </Pressable>
      </View>

      <View style={styles.inspectorSection}>
        <Text style={styles.sectionTitle}>Export</Text>
        <View style={styles.filterRowWrap}>
          <ActionPill label="PDF" onPress={() => void app.exportActiveNote("pdf")} />
          <ActionPill label="DOCX" onPress={() => void app.exportActiveNote("docx")} />
          <ActionPill label="MD" onPress={() => void app.exportActiveNote("markdown")} />
          <ActionPill label="HTML" onPress={() => void app.exportActiveNote("html")} />
          <ActionPill label="RTF" onPress={() => void app.exportActiveNote("rtf")} />
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
            <Text style={styles.emptyPanelText}>No live share created yet.</Text>
          </View>
        )}
      </View>

      <View style={styles.inspectorSection}>
        <Text style={styles.sectionTitle}>Opened share</Text>
        {app.accessedShare ? (
          <View style={styles.sharedReadCard}>
            <Text style={styles.sharedReadTitle}>{app.accessedShare.title}</Text>
            <Text style={styles.sharedReadMeta}>
              {app.accessedShare.format.toUpperCase()} · {new Date(app.accessedShare.createdAt).toLocaleDateString()}
            </Text>
            <Text style={styles.sharedReadBody}>{app.accessedShare.content}</Text>
          </View>
        ) : (
          <View style={styles.emptyPanel}>
            <Text style={styles.emptyPanelText}>Open a shared note to inspect decrypted content.</Text>
          </View>
        )}
      </View>
    </ScrollView>
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

function ActionPill(props: { label: string; active?: boolean; onPress(): void }) {
  return (
    <Pressable onPress={props.onPress} style={[styles.pill, props.active ? styles.pillActive : null]}>
      <Text style={[styles.pillText, props.active ? styles.pillTextActive : null]}>{props.label}</Text>
    </Pressable>
  );
}

function SwitchButton(props: { label: string; active?: boolean; onPress(): void }) {
  return (
    <Pressable
      onPress={props.onPress}
      style={[styles.switchButton, props.active ? styles.switchButtonActive : null]}
    >
      <Text style={[styles.switchButtonText, props.active ? styles.switchButtonTextActive : null]}>
        {props.label}
      </Text>
    </Pressable>
  );
}

function SegmentButton(props: { label: string; active?: boolean; onPress(): void }) {
  return (
    <Pressable
      onPress={props.onPress}
      style={[styles.segmentButton, props.active ? styles.segmentButtonActive : null]}
    >
      <Text style={[styles.segmentButtonText, props.active ? styles.segmentButtonTextActive : null]}>
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
    maxWidth: 340,
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
  statusBanner: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 14,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  statusBannerText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19
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
  quickCreateRow: {
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
    fontSize: 16,
    minHeight: 52,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  contentInput: {
    backgroundColor: colors.paper,
    borderColor: "#d7ceb8",
    borderRadius: 8,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 15,
    lineHeight: 22,
    minHeight: 320,
    paddingHorizontal: 14,
    paddingVertical: 14
  },
  actionsRow: {
    flexDirection: "row",
    gap: 10,
    justifyContent: "flex-end"
  },
  actionsRowStacked: {
    flexDirection: "column-reverse"
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.primaryStrong,
    borderRadius: 8,
    justifyContent: "center",
    minHeight: 40,
    paddingHorizontal: 16
  },
  primaryButtonLarge: {
    alignItems: "center",
    backgroundColor: colors.primaryStrong,
    borderRadius: 8,
    flex: 1,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: 16
  },
  accentButton: {
    alignItems: "center",
    backgroundColor: colors.primaryAlt,
    borderRadius: 8,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 16
  },
  primaryButtonText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700"
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 48,
    minWidth: 120,
    paddingHorizontal: 16
  },
  secondaryButtonCompact: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 16
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700"
  },
  inspector: {
    backgroundColor: colors.bgElevated,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 0,
    padding: 14
  },
  inspectorScroll: {
    gap: 14,
    paddingBottom: 12
  },
  inspectorSection: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    padding: 14
  },
  securityList: {
    gap: 10
  },
  panelCopy: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19
  },
  inlineInput: {
    backgroundColor: colors.bgElevated,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.text,
    fontSize: 14,
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  pill: {
    alignItems: "center",
    backgroundColor: colors.panelMuted,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 34,
    paddingHorizontal: 12
  },
  pillActive: {
    backgroundColor: colors.primaryStrong,
    borderColor: colors.primaryStrong
  },
  pillText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700"
  },
  pillTextActive: {
    color: colors.text
  },
  segmentedRow: {
    backgroundColor: colors.bgElevated,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    padding: 6
  },
  segmentButton: {
    alignItems: "center",
    borderRadius: 6,
    flex: 1,
    justifyContent: "center",
    minHeight: 36
  },
  segmentButtonActive: {
    backgroundColor: colors.panelSoft
  },
  segmentButtonText: {
    color: colors.textSoft,
    fontSize: 13,
    fontWeight: "700"
  },
  segmentButtonTextActive: {
    color: colors.text
  },
  infoRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between"
  },
  infoLabel: {
    color: colors.textMuted,
    flex: 1,
    fontSize: 12,
    fontWeight: "600"
  },
  infoValue: {
    color: colors.text,
    flex: 1,
    fontSize: 12,
    textAlign: "right"
  },
  sharePreviewCard: {
    backgroundColor: colors.bgElevated,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    padding: 12
  },
  infoLine: {
    gap: 4
  },
  infoLineLabel: {
    color: colors.textSoft,
    fontSize: 11,
    textTransform: "uppercase"
  },
  infoLineValue: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "600"
  },
  emptyPanel: {
    alignItems: "center",
    backgroundColor: colors.bgElevated,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 88,
    paddingHorizontal: 14
  },
  emptyPanelText: {
    color: colors.textSoft,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center"
  },
  sharedReadCard: {
    backgroundColor: colors.paper,
    borderColor: "#d7ceb8",
    borderRadius: 8,
    borderWidth: 1,
    gap: 10,
    padding: 14
  },
  sharedReadTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "800"
  },
  sharedReadMeta: {
    color: colors.inkSoft,
    fontSize: 12
  },
  sharedReadBody: {
    color: colors.ink,
    fontSize: 14,
    lineHeight: 21
  },
  mobileBottomBar: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
    padding: 8
  },
  mobileGhostButton: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    minHeight: 42
  },
  mobileGhostButtonText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "600"
  },
  mobilePrimaryButton: {
    alignItems: "center",
    backgroundColor: colors.primaryStrong,
    borderRadius: 8,
    flex: 1,
    justifyContent: "center",
    minHeight: 42
  }
});
