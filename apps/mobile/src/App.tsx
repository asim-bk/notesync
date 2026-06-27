import { useEffect, useMemo, useRef, useState } from "react";
import * as Clipboard from "expo-clipboard";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  Share as NativeShare,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions
} from "react-native";
import type { NoteSummary, ShareCreationResult } from "@notesync/shared-types";
import { NoteCard } from "./components/note-card";
import { useNotesApp } from "./hooks/use-notes-app";
import { colors } from "./theme";

const SIDEBAR_WIDTH = 320;
const INSPECTOR_WIDTH = 320;

type MobileListMode = "all" | "synced";
type MobileOverlayScreen = "settings" | "auth" | "syncing" | null;
type MobileHeaderAction = {
  label: string;
  onPress(): void;
} | null;
type DrawerItemKey = "notes" | "new" | "shared" | "synced" | "settings";
type ShareDialogStep = "protect" | "password" | "result" | null;

export default function App() {
  const app = useNotesApp();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1180;
  const isTablet = width >= 860;
  const isMobile = !isTablet;

  const drawerWidth = Math.min(width * 0.84, 308);
  const drawerTranslate = useRef(new Animated.Value(-drawerWidth - 28)).current;
  const drawerBackdropOpacity = useRef(new Animated.Value(0)).current;
  const [mobileMenuVisible, setMobileMenuVisible] = useState(false);
  const [mobileListMode, setMobileListMode] = useState<MobileListMode>("all");
  const [mobileOverlayScreen, setMobileOverlayScreen] = useState<MobileOverlayScreen>(null);
  const [shareTargetNoteId, setShareTargetNoteId] = useState<string | null>(null);
  const [sharedComposerNoteId, setSharedComposerNoteId] = useState<string | null>(null);
  const [shareDialogStep, setShareDialogStep] = useState<ShareDialogStep>(null);
  const [shareDialogPassword, setShareDialogPassword] = useState("");
  const [shareDialogError, setShareDialogError] = useState<string | null>(null);
  const [shareResult, setShareResult] = useState<ShareCreationResult | null>(null);
  const [copiedShareUrl, setCopiedShareUrl] = useState<string | null>(null);
  const [deleteTargetNoteId, setDeleteTargetNoteId] = useState<string | null>(null);

  const noteCount = app.summaries.length;
  const syncedSummaries = useMemo(() => {
    return app.summaries.filter((note) => note.syncState === "synced");
  }, [app.summaries]);
  const activeSummary = app.summaries.find((note) => note.id === app.activeStoredNote?.note.id) ?? null;
  const visibleMobileSummaries = mobileListMode === "synced" ? syncedSummaries : app.summaries;

  useEffect(() => {
    if (!sharedComposerNoteId || !app.summaries.some((note) => note.id === sharedComposerNoteId)) {
      setSharedComposerNoteId(app.activeStoredNote?.note.id ?? app.summaries[0]?.id ?? null);
    }
  }, [app.activeStoredNote?.note.id, app.summaries, sharedComposerNoteId]);

  useEffect(() => {
    if (!isMobile) {
      setMobileMenuVisible(false);
      drawerTranslate.setValue(-drawerWidth - 28);
      drawerBackdropOpacity.setValue(0);
    }
  }, [drawerBackdropOpacity, drawerTranslate, drawerWidth, isMobile]);

  const showMobileMenu = () => {
    if (mobileMenuVisible) {
      return;
    }

    setMobileMenuVisible(true);
    drawerTranslate.setValue(-drawerWidth - 28);
    drawerBackdropOpacity.setValue(0);
    requestAnimationFrame(() => {
      Animated.parallel([
        Animated.timing(drawerTranslate, {
          toValue: 0,
          duration: 240,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true
        }),
        Animated.timing(drawerBackdropOpacity, {
          toValue: 1,
          duration: 240,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true
        })
      ]).start();
    });
  };

  const hideMobileMenu = () => {
    if (!mobileMenuVisible) {
      return;
    }

    Animated.parallel([
      Animated.timing(drawerTranslate, {
        toValue: -drawerWidth - 28,
        duration: 210,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true
      }),
      Animated.timing(drawerBackdropOpacity, {
        toValue: 0,
        duration: 210,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true
      })
    ]).start(({ finished }) => {
      if (finished) {
        setMobileMenuVisible(false);
      }
    });
  };

  const resetMobileHome = () => {
    hideMobileMenu();
    setMobileOverlayScreen(null);
    setMobileListMode("all");
    app.setScreen("list");
  };

  const openMobileNotes = () => {
    hideMobileMenu();
    setMobileOverlayScreen(null);
    setMobileListMode("all");
    app.setScreen("list");
  };

  const openMobileSyncedNotes = () => {
    hideMobileMenu();
    setMobileOverlayScreen(null);
    setMobileListMode("synced");
    app.setScreen("list");
  };

  const openMobileShare = () => {
    hideMobileMenu();
    setMobileOverlayScreen(null);
    app.setScreen("share");
  };

  const openMobileSettings = () => {
    hideMobileMenu();
    setMobileOverlayScreen("settings");
  };

  const openMobileAuth = () => {
    hideMobileMenu();
    app.setAuthMode("login");
    setMobileOverlayScreen("auth");
  };

  const handleNewNote = () => {
    hideMobileMenu();
    setMobileOverlayScreen(null);
    app.startNewNote();
  };

  const handleEditNote = async (noteId: string) => {
    hideMobileMenu();
    setMobileOverlayScreen(null);
    await app.editNote(noteId);
  };

  const handleAuthSubmit = async () => {
    const authMode = app.authMode;
    const success = await app.submitAuth();
    if (!success) {
      return;
    }

    hideMobileMenu();

    if (authMode === "login") {
      setMobileOverlayScreen("syncing");
      await delay(120);
      await app.syncNow();
    }

    setMobileOverlayScreen(null);
    setMobileListMode("all");
    app.setScreen("list");
  };

  const handleSignOut = async () => {
    hideMobileMenu();
    setMobileOverlayScreen(null);
    setMobileListMode("all");
    app.setScreen("list");
    await app.signOut();
  };

  const beginShareFlow = (noteId: string) => {
    setShareTargetNoteId(noteId);
    setShareDialogPassword("");
    setShareDialogError(null);
    setShareResult(null);
    setCopiedShareUrl(null);
    setShareDialogStep("protect");
  };

  const closeShareFlow = () => {
    setShareDialogStep(null);
    setShareDialogPassword("");
    setShareDialogError(null);
    setShareResult(null);
    setCopiedShareUrl(null);
  };

  const completeShareCreation = async (password?: string) => {
    if (!shareTargetNoteId) {
      return;
    }

    const createdShare = await app.createShareForNote(shareTargetNoteId, password);
    if (createdShare) {
      setShareResult(createdShare);
      setShareDialogPassword("");
      setShareDialogError(null);
      setCopiedShareUrl(null);
      setShareDialogStep("result");
    }
  };

  const handleProtectedShare = async () => {
    if (!shareDialogPassword.trim()) {
      setShareDialogError("Enter a password before continuing.");
      return;
    }

    await completeShareCreation(shareDialogPassword);
  };

  const handleCopyShareLink = async (url: string) => {
    await Clipboard.setStringAsync(url);
    setCopiedShareUrl(url);
  };

  const handleShareLink = async (url: string) => {
    try {
      if (Platform.OS === "web" && typeof navigator !== "undefined" && "share" in navigator) {
        await navigator.share({
          title: "NoteSync share",
          text: url,
          url
        });
        return;
      }

      await NativeShare.share({
        title: "NoteSync share",
        message: url,
        url
      });
    } catch {
      await handleCopyShareLink(url);
    }
  };

  const handleDeleteCurrentNote = () => {
    if (!app.activeStoredNote?.note.id) {
      return;
    }

    setDeleteTargetNoteId(app.activeStoredNote.note.id);
  };

  const confirmDeleteNote = async () => {
    if (!deleteTargetNoteId) {
      return;
    }

    const deleted = await app.deleteNote(deleteTargetNoteId);
    if (deleted) {
      setDeleteTargetNoteId(null);
    }
  };

  const mobileHeader = getMobileHeaderState({
    app,
    noteCount,
    syncedCount: syncedSummaries.length,
    listMode: mobileListMode,
    overlayScreen: mobileOverlayScreen,
    resetHome: resetMobileHome,
    openAllNotes: openMobileNotes
  });

  const activeDrawerItem = getActiveDrawerItem({
    app,
    listMode: mobileListMode,
    overlayScreen: mobileOverlayScreen
  });

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
        {isMobile ? (
          renderMobileHeader({
            title: mobileHeader.title,
            meta: mobileHeader.meta,
            onMenuPress: showMobileMenu,
            secondaryAction: mobileHeader.secondaryAction
          })
        ) : (
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
              <Pressable onPress={() => app.startNewNote()} style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>New note</Text>
              </Pressable>
            </View>
          </View>
        )}

        {app.statusMessage ? (
          <View style={styles.statusBanner}>
            <Text style={styles.statusBannerText}>{app.statusMessage}</Text>
          </View>
        ) : null}

        <View style={[styles.workspace, !isTablet ? styles.workspaceStacked : null]}>
          {isMobile ? (
            <View style={styles.mobilePanel}>
              {mobileOverlayScreen === "auth"
                ? renderAuthScreen(app, handleAuthSubmit, resetMobileHome)
                : mobileOverlayScreen === "syncing"
                  ? renderSyncingScreen(app)
                  : mobileOverlayScreen === "settings"
                    ? renderSettingsScreen(app, noteCount, syncedSummaries.length)
                    : app.screen === "editor"
                      ? renderEditor(app, activeSummary, isTablet, {
                          onDelete: handleDeleteCurrentNote,
                          onShare: () => {
                            if (app.activeStoredNote?.note.id) {
                              beginShareFlow(app.activeStoredNote.note.id);
                            }
                          }
                        })
                      : app.screen === "share"
                        ? renderShareHub(app, {
                            selectedNoteId: sharedComposerNoteId,
                            onSelectNote: setSharedComposerNoteId,
                            onCreateShare: () => {
                              if (sharedComposerNoteId) {
                                beginShareFlow(sharedComposerNoteId);
                              }
                            },
                            onCopyLink: handleCopyShareLink
                          })
                        : renderMobileNotesHome({
                            app,
                            summaries: visibleMobileSummaries,
                            emptyTitle: mobileListMode === "synced" ? "No synced notes yet" : "No notes yet",
                            emptyText:
                              mobileListMode === "synced"
                                ? "Sign in and sync your account to populate this view."
                                : "Tap the plus button to open a new note.",
                            onNotePress: handleEditNote
                          })}
            </View>
          ) : (
            <>
              <View style={[styles.sidebar, isDesktop ? { width: SIDEBAR_WIDTH } : null]}>
                {renderSidebar(app, noteCount)}
              </View>
              <View style={styles.editorSurface}>
                {renderEditor(app, activeSummary, isTablet, {
                  onDelete: handleDeleteCurrentNote,
                  onShare: () => {
                    if (app.activeStoredNote?.note.id) {
                      beginShareFlow(app.activeStoredNote.note.id);
                    }
                  }
                })}
              </View>
              <View style={[styles.inspector, isDesktop ? { width: INSPECTOR_WIDTH } : null]}>
                {renderInspector(app)}
              </View>
            </>
          )}
        </View>

        {isMobile && mobileOverlayScreen === null && app.screen === "list" ? (
          <Pressable onPress={handleNewNote} style={styles.floatingAddButton}>
            <Text style={styles.floatingAddButtonText}>+</Text>
          </Pressable>
        ) : null}

        {mobileMenuVisible ? (
          <View style={styles.mobileDrawerLayer}>
            <Animated.View style={[styles.mobileDrawerBackdrop, { opacity: drawerBackdropOpacity }]}>
              <Pressable onPress={hideMobileMenu} style={styles.backdropPressable} />
            </Animated.View>
            {renderMobileDrawer({
              app,
              drawerWidth,
              drawerTranslate,
              noteCount,
              syncedCount: syncedSummaries.length,
              activeItem: activeDrawerItem,
              onClose: hideMobileMenu,
              onOpenNotes: openMobileNotes,
              onOpenNewNote: handleNewNote,
              onOpenShared: openMobileShare,
              onOpenSynced: openMobileSyncedNotes,
              onOpenSettings: openMobileSettings,
              onOpenAuth: openMobileAuth,
              onSignOut: handleSignOut
            })}
          </View>
        ) : null}

        <Modal animationType="fade" onRequestClose={closeShareFlow} transparent visible={shareDialogStep !== null}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              {shareDialogStep === "protect" ? (
                <>
                  <Text style={styles.modalTitle}>Protect this share with a password?</Text>
                  <Text style={styles.modalCopy}>
                    Choose whether the recipient should enter a password before opening this note.
                  </Text>
                  <View style={styles.modalActionColumn}>
                    <Pressable onPress={() => setShareDialogStep("password")} style={styles.accentButton}>
                      <Text style={styles.primaryButtonText}>Yes, protect it</Text>
                    </Pressable>
                    <Pressable onPress={() => void completeShareCreation("")} style={styles.secondaryButtonCompact}>
                      <Text style={styles.secondaryButtonText}>No, continue</Text>
                    </Pressable>
                    <Pressable onPress={closeShareFlow} style={styles.ghostButton}>
                      <Text style={styles.ghostButtonText}>Cancel</Text>
                    </Pressable>
                  </View>
                </>
              ) : null}

              {shareDialogStep === "password" ? (
                <>
                  <Text style={styles.modalTitle}>Enter a share password</Text>
                  <Text style={styles.modalCopy}>
                    This password will be required when the shared note is opened.
                  </Text>
                  <TextInput
                    onChangeText={(value) => {
                      setShareDialogPassword(value);
                      if (shareDialogError) {
                        setShareDialogError(null);
                      }
                    }}
                    placeholder="Share password"
                    placeholderTextColor={colors.textSoft}
                    secureTextEntry
                    style={styles.inlineInput}
                    value={shareDialogPassword}
                  />
                  {shareDialogError ? <Text style={styles.modalErrorText}>{shareDialogError}</Text> : null}
                  <View style={styles.modalActionColumn}>
                    <Pressable disabled={app.loading} onPress={() => void handleProtectedShare()} style={styles.accentButton}>
                      <Text style={styles.primaryButtonText}>{app.loading ? "Creating..." : "Create share"}</Text>
                    </Pressable>
                    <Pressable onPress={() => setShareDialogStep("protect")} style={styles.secondaryButtonCompact}>
                      <Text style={styles.secondaryButtonText}>Back</Text>
                    </Pressable>
                  </View>
                </>
              ) : null}

              {shareDialogStep === "result" && shareResult ? (
                <>
                  <Text style={styles.modalTitle}>Share link ready</Text>
                  <Text style={styles.modalCopy}>
                    Send this link directly or open the platform share sheet.
                  </Text>
                  <View style={styles.shareResultLinkCard}>
                    <Text numberOfLines={2} style={styles.shareResultLinkText}>
                      {shareResult.url}
                    </Text>
                  </View>
                  <View style={styles.modalActionColumn}>
                    <Pressable onPress={() => void handleCopyShareLink(shareResult.url)} style={styles.accentButton}>
                      <Text style={styles.primaryButtonText}>
                        {copiedShareUrl === shareResult.url ? "Copied" : "Copy link"}
                      </Text>
                    </Pressable>
                    <Pressable onPress={() => void handleShareLink(shareResult.url)} style={styles.secondaryButtonCompact}>
                      <Text style={styles.secondaryButtonText}>Share to apps</Text>
                    </Pressable>
                    <Pressable onPress={closeShareFlow} style={styles.ghostButton}>
                      <Text style={styles.ghostButtonText}>Done</Text>
                    </Pressable>
                  </View>
                </>
              ) : null}
            </View>
          </View>
        </Modal>

        <Modal
          animationType="fade"
          onRequestClose={() => setDeleteTargetNoteId(null)}
          transparent
          visible={deleteTargetNoteId !== null}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Delete this note?</Text>
              <Text style={styles.modalCopy}>
                This removes the local note immediately and queues a remote delete if sync was enabled.
              </Text>
              <View style={styles.modalActionColumn}>
                <Pressable disabled={app.loading} onPress={() => void confirmDeleteNote()} style={styles.destructiveButton}>
                  <Text style={styles.destructiveButtonText}>{app.loading ? "Deleting..." : "Delete note"}</Text>
                </Pressable>
                <Pressable onPress={() => setDeleteTargetNoteId(null)} style={styles.secondaryButtonCompact}>
                  <Text style={styles.secondaryButtonText}>Cancel</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

function getMobileHeaderState(props: {
  app: ReturnType<typeof useNotesApp>;
  noteCount: number;
  syncedCount: number;
  listMode: MobileListMode;
  overlayScreen: MobileOverlayScreen;
  resetHome(): void;
  openAllNotes(): void;
}) {
  const { app, noteCount, syncedCount, listMode, overlayScreen, resetHome, openAllNotes } = props;
  let title = "Notes";
  let meta = `${noteCount} ${noteCount === 1 ? "note" : "notes"}`;
  let secondaryAction: MobileHeaderAction = null;

  if (overlayScreen === "auth") {
    title = app.authMode === "register" ? "Create account" : "Login";
    meta = "Connect your account to sync and protected sharing.";
    secondaryAction = {
      label: "Local",
      onPress: resetHome
    };
  } else if (overlayScreen === "syncing") {
    title = "Syncing";
    meta = "Loading your encrypted notes from the server.";
  } else if (overlayScreen === "settings") {
    title = "Settings";
    meta = "Security, export, and device controls.";
    secondaryAction = {
      label: "Home",
      onPress: resetHome
    };
  } else if (app.screen === "editor") {
    title = app.activeStoredNote ? "Edit note" : "New note";
    meta = `${app.draft.format.toUpperCase()} draft`;
    secondaryAction = {
      label: "Home",
      onPress: resetHome
    };
  } else if (app.screen === "share") {
    title = "Shared";
    meta = "Create and open protected note links.";
    secondaryAction = {
      label: "Home",
      onPress: resetHome
    };
  } else if (listMode === "synced") {
    title = "Synced notes";
    meta = `${syncedCount} ready from account sync`;
    secondaryAction = {
      label: "All",
      onPress: openAllNotes
    };
  }

  return { title, meta, secondaryAction };
}

function getActiveDrawerItem(props: {
  app: ReturnType<typeof useNotesApp>;
  listMode: MobileListMode;
  overlayScreen: MobileOverlayScreen;
}): DrawerItemKey {
  const { app, listMode, overlayScreen } = props;

  if (overlayScreen === "settings") {
    return "settings";
  }

  if (app.screen === "share") {
    return "shared";
  }

  if (listMode === "synced" && app.screen === "list") {
    return "synced";
  }

  if (app.screen === "editor" && !app.activeStoredNote) {
    return "new";
  }

  return "notes";
}

function renderMobileHeader(props: {
  title: string;
  meta: string;
  onMenuPress(): void;
  secondaryAction: MobileHeaderAction;
}) {
  return (
    <View style={styles.mobileHeader}>
      <Pressable onPress={props.onMenuPress} style={styles.headerMenuButton}>
        <View style={styles.headerMenuIcon}>
          <View style={styles.headerMenuLine} />
          <View style={styles.headerMenuLine} />
          <View style={styles.headerMenuLine} />
        </View>
      </Pressable>

      <View style={styles.mobileHeaderBody}>
        <Text numberOfLines={1} style={styles.mobileHeaderTitle}>
          {props.title}
        </Text>
        <Text numberOfLines={1} style={styles.mobileHeaderMeta}>
          {props.meta}
        </Text>
      </View>

      {props.secondaryAction ? (
        <Pressable onPress={props.secondaryAction.onPress} style={styles.headerIconButton}>
          <Text style={styles.headerIconButtonText}>{props.secondaryAction.label}</Text>
        </Pressable>
      ) : (
        <View style={styles.mobileHeaderSpacer} />
      )}
    </View>
  );
}

function renderMobileDrawer(props: {
  app: ReturnType<typeof useNotesApp>;
  drawerWidth: number;
  drawerTranslate: Animated.Value;
  noteCount: number;
  syncedCount: number;
  activeItem: DrawerItemKey;
  onClose(): void;
  onOpenNotes(): void;
  onOpenNewNote(): void;
  onOpenShared(): void;
  onOpenSynced(): void;
  onOpenSettings(): void;
  onOpenAuth(): void;
  onSignOut(): Promise<void>;
}) {
  return (
    <Animated.View
      style={[
        styles.mobileDrawer,
        {
          transform: [{ translateX: props.drawerTranslate }],
          width: props.drawerWidth
        }
      ]}
    >
      <View style={styles.mobileDrawerContent}>
        <View style={styles.mobileDrawerTop}>
          <View>
            <Text style={styles.drawerEyebrow}>Workspace</Text>
            <Text style={styles.drawerTitle}>NoteSync</Text>
          </View>
          <Pressable onPress={props.onClose} style={styles.drawerCloseButton}>
            <Text style={styles.drawerCloseButtonText}>Close</Text>
          </Pressable>
        </View>

        <View style={styles.drawerSection}>
          <Text style={styles.drawerSectionLabel}>Navigate</Text>
          <DrawerButton
            label="Notes"
            meta={`${props.noteCount} total`}
            active={props.activeItem === "notes"}
            onPress={props.onOpenNotes}
          />
          <DrawerButton
            label="New note"
            meta="Open an empty editor"
            active={props.activeItem === "new"}
            onPress={props.onOpenNewNote}
          />
          <DrawerButton
            label="Shared"
            meta="Protected links and access"
            active={props.activeItem === "shared"}
            onPress={props.onOpenShared}
          />
          <DrawerButton
            label="Synced notes"
            meta={`${props.syncedCount} synced`}
            active={props.activeItem === "synced"}
            onPress={props.onOpenSynced}
          />
        </View>

        <View style={styles.drawerBottomGroup}>
          <View style={styles.drawerSection}>
            <Text style={styles.drawerSectionLabel}>Settings</Text>
            <DrawerButton
              label="Settings"
              meta="Security, export, device"
              active={props.activeItem === "settings"}
              onPress={props.onOpenSettings}
            />
          </View>

          <View style={styles.drawerUserCard}>
            <View style={styles.drawerUserHeader}>
              <View
                style={[
                  styles.drawerUserDot,
                  { backgroundColor: props.app.authState ? colors.success : colors.warning }
                ]}
              />
              <Text style={styles.drawerUserTitle}>
                {props.app.authState ? props.app.authState.session.user.displayName : "Guest mode"}
              </Text>
            </View>
            <Text style={styles.drawerUserText}>
              {props.app.authState
                ? props.app.authState.session.user.email
                : "Sign in to sync notes and create protected live shares."}
            </Text>
            {props.app.authState ? (
              <Pressable onPress={() => void props.onSignOut()} style={styles.secondaryButtonCompact}>
                <Text style={styles.secondaryButtonText}>Logout</Text>
              </Pressable>
            ) : (
              <Pressable onPress={props.onOpenAuth} style={styles.accentButton}>
                <Text style={styles.primaryButtonText}>Login</Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

function renderMobileNotesHome(props: {
  app: ReturnType<typeof useNotesApp>;
  summaries: NoteSummary[];
  emptyTitle: string;
  emptyText: string;
  onNotePress(noteId: string): Promise<void>;
}) {
  if (props.summaries.length === 0) {
    return (
      <View style={styles.emptyGridState}>
        <Text style={styles.emptyGridTitle}>{props.emptyTitle}</Text>
        <Text style={styles.emptyGridText}>{props.emptyText}</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.mobileNotesScroll} showsVerticalScrollIndicator={false}>
      <View style={styles.notesGrid}>
        {props.summaries.map((note) => (
          <NoteCard
            compact
            containerStyle={styles.gridCard}
            key={note.id}
            note={note}
            selected={note.id === props.app.activeStoredNote?.note.id}
            onPress={() => void props.onNotePress(note.id)}
          />
        ))}
      </View>
    </ScrollView>
  );
}

function renderAuthScreen(
  app: ReturnType<typeof useNotesApp>,
  onSubmit: () => Promise<void>,
  onContinueLocal: () => void
) {
  return (
    <ScrollView contentContainerStyle={styles.mobileSurfaceScroll} showsVerticalScrollIndicator={false}>
      <View style={styles.authCard}>
        <Text style={styles.authTitle}>
          {app.authMode === "register" ? "Create your sync account" : "Sign in to your account"}
        </Text>
        <Text style={styles.authCopy}>
          Account access enables server sync and protected share links while your local vault remains encrypted on the device.
        </Text>

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

        <Pressable disabled={app.loading} onPress={() => void onSubmit()} style={styles.accentButton}>
          <Text style={styles.primaryButtonText}>
            {app.loading
              ? "Checking account..."
              : app.authMode === "register"
                ? "Create account"
                : "Login and sync"}
          </Text>
        </Pressable>

        <Pressable onPress={onContinueLocal} style={styles.secondaryButtonCompact}>
          <Text style={styles.secondaryButtonText}>Continue local only</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function renderSyncingScreen(app: ReturnType<typeof useNotesApp>) {
  return (
    <View style={styles.syncingScreen}>
      <View style={styles.syncingCard}>
        <ActivityIndicator color={colors.primaryAlt} size="large" />
        <Text style={styles.syncingTitle}>Syncing your notes</Text>
        <Text style={styles.syncingCopy}>
          We are checking your account, pulling remote notes, and refreshing the local encrypted vault.
        </Text>
        <View style={styles.syncingSteps}>
          <Text style={styles.syncingStep}>Checking account session</Text>
          <Text style={styles.syncingStep}>Decrypting remote note content</Text>
          <Text style={styles.syncingStep}>Refreshing the mobile notes grid</Text>
        </View>
        {app.loading ? <Text style={styles.syncingHint}>Please wait...</Text> : null}
      </View>
    </View>
  );
}

function renderShareHub(
  app: ReturnType<typeof useNotesApp>,
  props: {
    selectedNoteId: string | null;
    onSelectNote(noteId: string): void;
    onCreateShare(): void;
    onCopyLink(url: string): Promise<void>;
  }
) {
  const selectedSummary = app.summaries.find((note) => note.id === props.selectedNoteId) ?? null;

  return (
    <ScrollView contentContainerStyle={styles.mobileSurfaceScroll} showsVerticalScrollIndicator={false}>
      <View style={styles.inspectorSection}>
        <Text style={styles.sectionTitle}>Create share</Text>
        <Text style={styles.panelCopy}>
          Pick a note, then choose whether the link should require a password before it can be opened.
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.notePickerRow}>
          {app.summaries.map((note) => (
            <Pressable
              key={note.id}
              onPress={() => props.onSelectNote(note.id)}
              style={[
                styles.notePickerChip,
                note.id === props.selectedNoteId ? styles.notePickerChipActive : null
              ]}
            >
              <Text
                numberOfLines={1}
                style={[
                  styles.notePickerChipText,
                  note.id === props.selectedNoteId ? styles.notePickerChipTextActive : null
                ]}
              >
                {note.title}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
        <View style={styles.shareComposerCard}>
          <Text style={styles.shareComposerTitle}>
            {selectedSummary ? selectedSummary.title : "Select a note to share"}
          </Text>
          <Text style={styles.shareComposerMeta}>
            {selectedSummary
              ? `${selectedSummary.format.toUpperCase()} · updated ${new Date(selectedSummary.updatedAt).toLocaleDateString()}`
              : "The share action will open the password dialog."}
          </Text>
          <Pressable
            disabled={!selectedSummary || app.loading}
            onPress={props.onCreateShare}
            style={styles.accentButton}
          >
            <Text style={styles.primaryButtonText}>
              {app.loading ? "Preparing..." : "Share selected note"}
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.inspectorSection}>
        <Text style={styles.sectionTitle}>Shared notes</Text>
        {app.shareHistory.length > 0 ? (
          <View style={styles.shareHistoryList}>
            {app.shareHistory.map((share) => (
              <View key={share.id} style={styles.shareHistoryCard}>
                <View style={styles.shareHistoryHeader}>
                  <View style={styles.shareHistoryTitleBlock}>
                    <Text numberOfLines={1} style={styles.shareHistoryTitle}>
                      {share.noteTitle}
                    </Text>
                    <Text style={styles.shareHistoryMeta}>
                      {share.passwordProtected ? "Password protected" : "Open access"} ·{" "}
                      {new Date(share.createdAt).toLocaleDateString()}
                    </Text>
                  </View>
                  <Pressable onPress={() => void props.onCopyLink(share.shareUrl)} style={styles.linkChip}>
                    <Text style={styles.linkChipText}>Copy link</Text>
                  </Pressable>
                </View>
                <Text numberOfLines={1} style={styles.shareHistoryUrl}>
                  {share.shareUrl}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyPanel}>
            <Text style={styles.emptyPanelText}>No shared notes yet.</Text>
          </View>
        )}
      </View>

      {renderShareAccessSection(app)}
      {renderOpenedShareSection(app)}
    </ScrollView>
  );
}

function renderSettingsScreen(
  app: ReturnType<typeof useNotesApp>,
  encryptedNoteCount: number,
  syncedNoteCount: number
) {
  return (
    <ScrollView contentContainerStyle={styles.mobileSurfaceScroll} showsVerticalScrollIndicator={false}>
      <View style={styles.inspectorSection}>
        <Text style={styles.sectionTitle}>Vault</Text>
        <View style={styles.securityList}>
          <SecurityRow label="Local vault" value="AES-256-GCM" />
          <SecurityRow label="Encrypted notes" value={`${encryptedNoteCount}`} />
          <SecurityRow label="Synced notes" value={`${syncedNoteCount}`} />
          <SecurityRow
            label="Account session"
            value={app.authState ? app.authState.session.user.email : "Not connected"}
          />
        </View>
      </View>

      <View style={styles.inspectorSection}>
        <Text style={styles.sectionTitle}>Sync and security</Text>
        <Text style={styles.panelCopy}>
          Manage device protection, run sync on demand, and choose whether the current note should stay local or be included in account sync.
        </Text>
        <View style={styles.filterRowWrap}>
          <ActionPill
            label={app.syncEnabled ? "Current note sync on" : "Current note local"}
            active={app.syncEnabled}
            onPress={() => app.setSyncEnabled(!app.syncEnabled)}
          />
        </View>
        <View style={styles.actionColumn}>
          <Pressable disabled={app.loading} onPress={() => void app.syncNow()} style={styles.secondaryButtonCompact}>
            <Text style={styles.secondaryButtonText}>{app.loading ? "Working..." : "Sync now"}</Text>
          </Pressable>
          <Pressable onPress={() => void app.rotateDeviceKey()} style={styles.secondaryButtonCompact}>
            <Text style={styles.secondaryButtonText}>Rotate device key</Text>
          </Pressable>
        </View>
      </View>

      {renderExportSection(app)}
    </ScrollView>
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
  isTablet: boolean,
  actions?: {
    onDelete(): void;
    onShare(): void;
  }
) {
  return (
    <>
      <View style={styles.editorHeader}>
        {app.activeStoredNote ? (
          <View style={styles.editorUtilityRow}>
            <Pressable onPress={actions?.onShare} style={styles.secondaryButtonCompact}>
              <Text style={styles.secondaryButtonText}>Share</Text>
            </Pressable>
            <Pressable onPress={actions?.onDelete} style={styles.destructiveButtonInline}>
              <Text style={styles.destructiveButtonText}>Delete</Text>
            </Pressable>
          </View>
        ) : null}

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
      {renderSecuritySection(app)}
      {renderAccountSection(app)}
      {renderShareCreateSection(app)}
      {renderShareAccessSection(app)}
      {renderExportSection(app)}
      {renderLatestShareSection(app)}
      {renderOpenedShareSection(app)}
    </ScrollView>
  );
}

function renderSecuritySection(app: ReturnType<typeof useNotesApp>) {
  return (
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
  );
}

function renderAccountSection(app: ReturnType<typeof useNotesApp>) {
  return (
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
  );
}

function renderShareCreateSection(app: ReturnType<typeof useNotesApp>) {
  return (
    <View style={styles.inspectorSection}>
      <Text style={styles.sectionTitle}>Share panel</Text>
      <Text style={styles.panelCopy}>
        Leave the password blank for an open share, or set one to protect the link before it goes to the API.
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
        <Text style={styles.primaryButtonText}>Create share</Text>
      </Pressable>
    </View>
  );
}

function renderShareAccessSection(app: ReturnType<typeof useNotesApp>) {
  return (
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
        placeholder="Password if required"
        placeholderTextColor={colors.textSoft}
        secureTextEntry
        style={styles.inlineInput}
        value={app.shareAccessPassword}
      />
      <Pressable onPress={() => void app.accessSharedNote()} style={styles.secondaryButtonCompact}>
        <Text style={styles.secondaryButtonText}>Open shared note</Text>
      </Pressable>
    </View>
  );
}

function renderExportSection(app: ReturnType<typeof useNotesApp>) {
  return (
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
  );
}

function renderLatestShareSection(app: ReturnType<typeof useNotesApp>) {
  return (
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
  );
}

function renderOpenedShareSection(app: ReturnType<typeof useNotesApp>) {
  return (
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
  );
}

function DrawerButton(props: {
  label: string;
  meta: string;
  active?: boolean;
  onPress(): void;
}) {
  return (
    <Pressable onPress={props.onPress} style={[styles.drawerButton, props.active ? styles.drawerButtonActive : null]}>
      <Text style={[styles.drawerButtonLabel, props.active ? styles.drawerButtonLabelActive : null]}>
        {props.label}
      </Text>
      <Text style={styles.drawerButtonMeta}>{props.meta}</Text>
    </Pressable>
  );
}

function ActionPill(props: { label: string; active?: boolean; onPress(): void }) {
  return (
    <Pressable onPress={props.onPress} style={[styles.pill, props.active ? styles.pillActive : null]}>
      <Text style={[styles.pillText, props.active ? styles.pillTextActive : null]}>{props.label}</Text>
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

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
  mobileHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    marginBottom: 14
  },
  headerMenuButton: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 40,
    minWidth: 66,
    paddingHorizontal: 14
  },
  headerMenuIcon: {
    gap: 4
  },
  headerMenuLine: {
    backgroundColor: colors.text,
    borderRadius: 999,
    height: 2,
    width: 16
  },
  mobileHeaderBody: {
    flex: 1,
    minWidth: 0
  },
  mobileHeaderTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "800"
  },
  mobileHeaderMeta: {
    color: colors.textSoft,
    fontSize: 12,
    marginTop: 3
  },
  mobileHeaderSpacer: {
    minWidth: 66
  },
  headerIconButton: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 40,
    minWidth: 66,
    paddingHorizontal: 14
  },
  headerIconButtonText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "700"
  },
  mobileDrawerLayer: {
    bottom: -12,
    left: -16,
    position: "absolute",
    right: -16,
    top: -14,
    zIndex: 40
  },
  mobileDrawerBackdrop: {
    backgroundColor: colors.overlay,
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0
  },
  backdropPressable: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0
  },
  mobileDrawer: {
    backgroundColor: colors.bgElevated,
    borderColor: colors.borderStrong,
    borderRightWidth: 1,
    bottom: 0,
    left: 16,
    maxWidth: 296,
    paddingBottom: 22,
    paddingLeft: 20,
    paddingRight: 14,
    paddingTop: 24,
    position: "absolute",
    top: 0,
    width: 308
  },
  mobileDrawerContent: {
    flex: 1,
    justifyContent: "space-between"
  },
  mobileDrawerTop: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 18
  },
  drawerEyebrow: {
    color: colors.textSoft,
    fontSize: 11,
    textTransform: "uppercase"
  },
  drawerTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "800",
    marginTop: 4
  },
  drawerCloseButton: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 36,
    paddingHorizontal: 14
  },
  drawerCloseButtonText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "700"
  },
  drawerSection: {
    gap: 8
  },
  drawerSectionLabel: {
    color: colors.textSoft,
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 4,
    textTransform: "uppercase"
  },
  drawerButton: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 11
  },
  drawerButtonActive: {
    backgroundColor: colors.panelSoft,
    borderColor: colors.primaryStrong
  },
  drawerButtonLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700"
  },
  drawerButtonLabelActive: {
    color: colors.text
  },
  drawerButtonMeta: {
    color: colors.textSoft,
    fontSize: 12
  },
  drawerBottomGroup: {
    gap: 14
  },
  drawerUserCard: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    padding: 14
  },
  drawerUserHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8
  },
  drawerUserDot: {
    borderRadius: 999,
    height: 8,
    width: 8
  },
  drawerUserTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700"
  },
  drawerUserText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19
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
  mobileNotesScroll: {
    paddingTop: 4,
    paddingBottom: 110
  },
  notesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    justifyContent: "space-between"
  },
  gridCard: {
    flexBasis: "48%",
    maxWidth: "48%"
  },
  emptyGridState: {
    alignItems: "center",
    backgroundColor: colors.bgElevated,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24
  },
  emptyGridTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700"
  },
  emptyGridText: {
    color: colors.textSoft,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    textAlign: "center"
  },
  mobileSurfaceScroll: {
    gap: 14,
    paddingBottom: 16
  },
  notePickerRow: {
    gap: 8,
    paddingBottom: 2
  },
  notePickerChip: {
    backgroundColor: colors.bgElevated,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: "center",
    maxWidth: 180,
    minHeight: 36,
    paddingHorizontal: 14
  },
  notePickerChipActive: {
    backgroundColor: colors.primaryStrong,
    borderColor: colors.primaryStrong
  },
  notePickerChipText: {
    color: colors.textSoft,
    fontSize: 12,
    fontWeight: "700"
  },
  notePickerChipTextActive: {
    color: colors.text
  },
  shareComposerCard: {
    backgroundColor: colors.bgElevated,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    padding: 12
  },
  shareComposerTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700"
  },
  shareComposerMeta: {
    color: colors.textSoft,
    fontSize: 12,
    lineHeight: 18
  },
  shareHistoryList: {
    gap: 10
  },
  shareHistoryCard: {
    backgroundColor: colors.bgElevated,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 10,
    padding: 12
  },
  shareHistoryHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between"
  },
  shareHistoryTitleBlock: {
    flex: 1,
    minWidth: 0
  },
  shareHistoryTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700"
  },
  shareHistoryMeta: {
    color: colors.textSoft,
    fontSize: 12,
    marginTop: 4
  },
  shareHistoryUrl: {
    color: colors.textMuted,
    fontSize: 12
  },
  linkChip: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 34,
    paddingHorizontal: 12
  },
  linkChipText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "700"
  },
  authCard: {
    backgroundColor: colors.bgElevated,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 14,
    padding: 16
  },
  authTitle: {
    color: colors.text,
    fontSize: 21,
    fontWeight: "800"
  },
  authCopy: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21
  },
  syncingScreen: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingBottom: 40,
    paddingHorizontal: 8
  },
  syncingCard: {
    alignItems: "center",
    backgroundColor: colors.bgElevated,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 14,
    paddingHorizontal: 18,
    paddingVertical: 24,
    width: "100%"
  },
  syncingTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "800"
  },
  syncingCopy: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center"
  },
  syncingSteps: {
    gap: 8,
    width: "100%"
  },
  syncingStep: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.text,
    fontSize: 13,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  syncingHint: {
    color: colors.textSoft,
    fontSize: 12
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
  editorUtilityRow: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "flex-end"
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
  destructiveButtonInline: {
    alignItems: "center",
    backgroundColor: "rgba(255, 107, 107, 0.12)",
    borderColor: colors.danger,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 16
  },
  destructiveButton: {
    alignItems: "center",
    backgroundColor: colors.danger,
    borderRadius: 8,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 16
  },
  destructiveButtonText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700"
  },
  ghostButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 42
  },
  ghostButtonText: {
    color: colors.textSoft,
    fontSize: 13,
    fontWeight: "700"
  },
  actionColumn: {
    gap: 10
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
  modalBackdrop: {
    alignItems: "center",
    backgroundColor: colors.overlay,
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 18
  },
  modalCard: {
    backgroundColor: colors.bgElevated,
    borderColor: colors.borderStrong,
    borderRadius: 8,
    borderWidth: 1,
    gap: 14,
    maxWidth: 420,
    padding: 18,
    width: "100%"
  },
  modalTitle: {
    color: colors.text,
    fontSize: 21,
    fontWeight: "800"
  },
  modalCopy: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21
  },
  modalActionColumn: {
    gap: 10
  },
  modalErrorText: {
    color: colors.warning,
    fontSize: 12
  },
  shareResultLinkCard: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    padding: 12
  },
  shareResultLinkText: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 19
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
  floatingAddButton: {
    alignItems: "center",
    backgroundColor: colors.primaryStrong,
    borderRadius: 999,
    bottom: 22,
    justifyContent: "center",
    minHeight: 58,
    minWidth: 58,
    position: "absolute",
    right: 22,
    shadowColor: "#000000",
    shadowOffset: {
      width: 0,
      height: 10
    },
    shadowOpacity: 0.24,
    shadowRadius: 18
  },
  floatingAddButtonText: {
    color: colors.text,
    fontSize: 30,
    fontWeight: "500",
    lineHeight: 30,
    marginTop: -2
  }
});
