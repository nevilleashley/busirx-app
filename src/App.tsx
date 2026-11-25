import React, { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import {
  Building2,
  CalendarDays,
  ClipboardCheck,
  CreditCard,
  FileSpreadsheet,
  FolderLock,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  MessageSquare,
  Mic,
  Plus,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { auth, db, handleFirestoreError, OperationType, testFirestoreConnection } from './lib/firebase.ts';
import { buildStarterSocialCalendarDays } from './lib/socialPlaybook.ts';
import {
  createStripeCheckoutApi,
  draftLeadFollowUpApi,
  fetchSystemReadiness,
  generateBlueprintApi,
  generateSocialCalendarApi,
  openStripePortalApi,
  cancelStripeSubscriptionApi,
  syncStripeSessionApi,
} from './services/apiClient.ts';
import {
  appendAuditLog,
  approveAndActivateCampaign,
  approveAndMarkSocialDayPublished,
  approveAndResolveObligation,
  approveBlueprintItemsAndCreateTasks,
  approveConsequentialTask,
  completeOrAdvanceTask,
  createFinancialEntry,
  createLeadRecord,
  createManualTask,
  createMarketingCampaign,
  createObligation,
  createTeamMember,
  deleteBusinessAndAllData,
  deleteLeadRecord,
  deleteTask,
  dismissBlueprintItem,
  ensureUserProfile,
  exportBusinessDataJson,
  markNotificationRead,
  runReminderCheckAndLog,
  saveBusinessAssessment,
  saveGeneratedBlueprintItems,
  saveGeneratedSocialCalendar,
  subscribeBusinessSubcollection,
  subscribeUserBusinesses,
  toggleSocialCalendarMiniTask,
  updateLeadDetails,
  updateLeadStageAndOutreach,
  updateSocialCalendarDayDraft,
  updateTaskAssignee,
  updateUserNotificationPreferences,
  updateUserSubscriptionState,
  uploadPrivateDocumentRecord,
} from './services/busirxService.ts';
import type {
  AuditLogRecord,
  BlueprintCategoryId,
  BlueprintItem,
  BusinessAssessmentInput,
  BusinessRecord,
  DocumentRecord,
  FinancialEntryRecord,
  LeadRecord,
  MarketingCampaignRecord,
  NotificationLogRecord,
  ObligationRecord,
  SocialCalendarDay,
  SystemReadinessStatus,
  TaskItem,
  TeamMemberRecord,
  UserProfile,
} from './types/busirx.ts';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { LandingAuthView } from './components/LandingAuthView.tsx';
import { AssessmentWizard } from './components/AssessmentWizard.tsx';
import { BlueprintReviewView } from './components/BlueprintReviewView.tsx';
import { TasksAutomationView } from './components/TasksAutomationView.tsx';
import { ObligationsDocumentsView } from './components/ObligationsDocumentsView.tsx';
import { TeamFinanceGrowthView } from './components/TeamFinanceGrowthView.tsx';
import { BillingSecurityView } from './components/BillingSecurityView.tsx';
import { SocialCalendarView } from './components/SocialCalendarView.tsx';
import { LeadCRM } from './components/LeadCRM.tsx';
import { VoiceStudioView } from './components/VoiceStudioView.tsx';
import { AssistantDrawer } from './components/AssistantDrawer.tsx';
import { DashboardOverview, type WorkspaceNavSection } from './components/DashboardOverview.tsx';

function WorkspaceApp() {
  const [authReady, setAuthReady] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [readiness, setReadiness] = useState<SystemReadinessStatus | null>(null);

  const [businesses, setBusinesses] = useState<BusinessRecord[]>([]);
  const [activeBusinessId, setActiveBusinessId] = useState<string | null>(null);
  const [creatingNewBusiness, setCreatingNewBusiness] = useState(false);

  const [activeSection, setActiveSection] = useState<WorkspaceNavSection>('dashboard');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);

  const [blueprintItems, setBlueprintItems] = useState<BlueprintItem[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [obligations, setObligations] = useState<ObligationRecord[]>([]);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMemberRecord[]>([]);
  const [financialEntries, setFinancialEntries] = useState<FinancialEntryRecord[]>([]);
  const [notifications, setNotifications] = useState<NotificationLogRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>([]);
  const [campaigns, setCampaigns] = useState<MarketingCampaignRecord[]>([]);
  const [socialDays, setSocialDays] = useState<SocialCalendarDay[]>([]);
  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [preselectedLeadDay, setPreselectedLeadDay] = useState<{
    dayNumber: number;
    platform: string;
  } | null>(null);

  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingSocial, setIsGeneratingSocial] = useState(false);
  const [assessmentError, setAssessmentError] = useState('');
  const [socialError, setSocialError] = useState('');
  const [globalError, setGlobalError] = useState('');

  useEffect(() => {
    testFirestoreConnection();
    fetchSystemReadiness()
      .then(setReadiness)
      .catch(() => {});
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setFirebaseUser(u);
      setAuthReady(true);
      if (u && u.emailVerified) {
        try {
          await ensureUserProfile({
            uid: u.uid,
            email: u.email || '',
            displayName: u.displayName || '',
          });
        } catch (err) {
          setGlobalError(err instanceof Error ? err.message : 'Unable to initialize user profile.');
        }
      }
    });
    return () => unsub();
  }, []);

  // Handle Stripe Checkout return URL sync
  useEffect(() => {
    if (!firebaseUser || !firebaseUser.emailVerified) return;
    const params = new URLSearchParams(window.location.search);
    const billing = params.get('billing');
    const sessionId = params.get('session_id');
    if (billing === 'success' && sessionId) {
      syncStripeSessionApi(sessionId)
        .then(async (synced) => {
          await updateUserSubscriptionState(firebaseUser.uid, synced);
          window.history.replaceState({}, '', window.location.pathname);
        })
        .catch((err) => {
          setGlobalError(err instanceof Error ? err.message : 'Stripe sync failed.');
        });
    }
  }, [firebaseUser]);

  // Subscribe to userProfile and businesses
  useEffect(() => {
    if (!firebaseUser || !firebaseUser.emailVerified) {
      setUserProfile(null);
      setBusinesses([]);
      return;
    }

    const unsubUser = onSnapshot(
      doc(db, 'users', firebaseUser.uid),
      (snap) => {
        if (snap.exists()) {
          setUserProfile(snap.data() as UserProfile);
        }
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.GET, `users/${firebaseUser.uid}`);
        } catch (wrapped) {
          setGlobalError((wrapped as Error).message);
        }
      }
    );

    const unsubBiz = subscribeUserBusinesses(
      firebaseUser.uid,
      (list) => {
        setBusinesses(list);
        if (list.length > 0) {
          setActiveBusinessId((prev) =>
            prev && list.some((b) => b.id === prev) ? prev : list[0].id
          );
        } else {
          setActiveBusinessId(null);
        }
      },
      (err) => setGlobalError(err.message)
    );

    return () => {
      unsubUser();
      unsubBiz();
    };
  }, [firebaseUser]);

  const activeBusiness = useMemo(
    () => businesses.find((b) => b.id === activeBusinessId) || null,
    [businesses, activeBusinessId]
  );

  // Subscribe to subcollections for the active business
  useEffect(() => {
    if (!firebaseUser || !firebaseUser.emailVerified || !activeBusinessId) {
      setBlueprintItems([]);
      setTasks([]);
      setObligations([]);
      setDocuments([]);
      setTeamMembers([]);
      setFinancialEntries([]);
      setNotifications([]);
      setAuditLogs([]);
      setCampaigns([]);
      setSocialDays([]);
      setLeads([]);
      return;
    }

    const uid = firebaseUser.uid;
    const onErr = (err: Error) => setGlobalError(err.message);

    const unsubs = [
      subscribeBusinessSubcollection<BlueprintItem>(activeBusinessId, uid, 'blueprintItems', setBlueprintItems, onErr),
      subscribeBusinessSubcollection<TaskItem>(activeBusinessId, uid, 'tasks', setTasks, onErr),
      subscribeBusinessSubcollection<ObligationRecord>(activeBusinessId, uid, 'obligations', setObligations, onErr),
      subscribeBusinessSubcollection<DocumentRecord>(activeBusinessId, uid, 'documents', setDocuments, onErr),
      subscribeBusinessSubcollection<TeamMemberRecord>(activeBusinessId, uid, 'teamMembers', setTeamMembers, onErr),
      subscribeBusinessSubcollection<FinancialEntryRecord>(activeBusinessId, uid, 'financialEntries', setFinancialEntries, onErr),
      subscribeBusinessSubcollection<NotificationLogRecord>(activeBusinessId, uid, 'notifications', setNotifications, onErr),
      subscribeBusinessSubcollection<AuditLogRecord>(activeBusinessId, uid, 'auditLogs', setAuditLogs, onErr),
      subscribeBusinessSubcollection<MarketingCampaignRecord>(activeBusinessId, uid, 'marketingCampaigns', setCampaigns, onErr),
      subscribeBusinessSubcollection<SocialCalendarDay>(activeBusinessId, uid, 'socialCalendarDays', setSocialDays, onErr),
      subscribeBusinessSubcollection<LeadRecord>(activeBusinessId, uid, 'leads', setLeads, onErr),
    ];

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [firebaseUser, activeBusinessId]);

  const handleRefreshVerification = async () => {
    if (!auth.currentUser) return;
    await auth.currentUser.reload();
    setFirebaseUser(auth.currentUser);
    if (auth.currentUser.emailVerified) {
      await ensureUserProfile({
        uid: auth.currentUser.uid,
        email: auth.currentUser.email || '',
        displayName: auth.currentUser.displayName || '',
      });
    }
  };

  const handleAssessmentSubmit = async (
    assessment: BusinessAssessmentInput,
    affectedCategories?: BlueprintCategoryId[]
  ) => {
    if (!firebaseUser) return;
    setAssessmentError('');
    setIsGenerating(true);

    try {
      const isUpdatingExisting = Boolean(activeBusiness && !creatingNewBusiness);
      const businessId = await saveBusinessAssessment({
        businessId: isUpdatingExisting ? activeBusiness?.id : undefined,
        ownerUid: firebaseUser.uid,
        actorEmail: firebaseUser.email || '',
        assessment,
        previousVersion: isUpdatingExisting ? activeBusiness?.assessmentVersion : undefined,
      });

      const generated = await generateBlueprintApi(
        businessId,
        assessment,
        affectedCategories
      );

      await saveGeneratedBlueprintItems({
        businessId,
        ownerUid: firebaseUser.uid,
        actorEmail: firebaseUser.email || '',
        assessmentVersion: isUpdatingExisting ? (activeBusiness?.assessmentVersion || 1) + 1 : 1,
        generated,
        replaceCategoryIds: affectedCategories,
      });

      if (!isUpdatingExisting) {
        try {
          const starter = buildStarterSocialCalendarDays(assessment);
          await saveGeneratedSocialCalendar({
            businessId,
            ownerUid: firebaseUser.uid,
            actorEmail: firebaseUser.email || '',
            generated: starter,
          });
        } catch {
          // SocialCalendarView will also populate automatically on first open if needed
        }
      }

      setActiveBusinessId(businessId);
      setCreatingNewBusiness(false);
      setActiveSection('blueprint');
    } catch (err) {
      setAssessmentError(
        err instanceof Error ? err.message : 'Unable to save assessment and generate blueprint.'
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRegenerateAll = async () => {
    if (!firebaseUser || !activeBusiness) return;
    setIsGenerating(true);
    setGlobalError('');
    try {
      const generated = await generateBlueprintApi(activeBusiness.id, activeBusiness);
      await saveGeneratedBlueprintItems({
        businessId: activeBusiness.id,
        ownerUid: firebaseUser.uid,
        actorEmail: firebaseUser.email || '',
        assessmentVersion: activeBusiness.assessmentVersion,
        generated,
      });
    } catch (err) {
      setGlobalError(err instanceof Error ? err.message : 'Blueprint regeneration failed.');
    } finally {
      setIsGenerating(false);
    }
  };

  if (!authReady) {
    return (
      <div className="min-h-screen bg-[#F8F7FB] flex items-center justify-center">
        <p className="text-sm text-[#4A4756]">Loading Busi Rx...</p>
      </div>
    );
  }

  if (!firebaseUser || !firebaseUser.emailVerified) {
    return (
      <LandingAuthView
        unverifiedUser={firebaseUser}
        onRefreshVerification={handleRefreshVerification}
      />
    );
  }

  const pendingBlueprintCount = blueprintItems.filter(
    (b) => b.completionStatus === 'pending_approval'
  ).length;
  const newLeadsCount = leads.filter((l) => l.stage === 'new').length;

  const navItems: Array<{
    id: WorkspaceNavSection;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    count?: number;
  }> = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'blueprint', label: 'Blueprint', icon: ClipboardCheck, count: pendingBlueprintCount },
    { id: 'tasks', label: 'Tasks & Reminders', icon: ListChecks },
    { id: 'obligations', label: 'Bills, Licenses & Vault', icon: FolderLock },
    { id: 'operations', label: 'Team, Finance & Growth', icon: Users },
    { id: 'social_calendar', label: '30-Day Social Calendar', icon: CalendarDays },
    { id: 'leads', label: 'Lead CRM', icon: UserPlus, count: newLeadsCount },
    { id: 'voice_studio', label: 'Voice & Audio', icon: Mic },
    { id: 'assessment', label: 'Update Assessment', icon: FileSpreadsheet },
    { id: 'billing', label: 'Billing & Security', icon: CreditCard },
  ];

  const activeNavLabel = navItems.find((n) => n.id === activeSection)?.label || 'Workspace';

  return (
    <div className="min-h-screen bg-[#F8F7FB] text-[#1C1B22] flex">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-[#E6E2F0] flex flex-col justify-between transition-transform lg:static lg:translate-x-0 ${
          mobileNavOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div>
          <div className="px-6 py-5 border-b border-[#E6E2F0] flex items-center justify-between">
            <div>
              <p className="font-display text-lg font-bold text-[#4C1D95] tracking-tight">
                Busi Rx
              </p>
              <p className="text-[11px] text-[#6E6A7C]">The Prescription for a Healthier Business</p>
            </div>
            <button
              type="button"
              onClick={() => setMobileNavOpen(false)}
              className="lg:hidden p-1 text-[#6E6A7C]"
              aria-label="Close navigation"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Business Switcher */}
          <div className="px-4 py-4 border-b border-[#E6E2F0] space-y-2">
            <label className="block text-[11px] font-semibold text-[#6E6A7C]">
              Active Business
            </label>
            {businesses.length > 0 ? (
              <div className="flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-[#4C1D95] shrink-0" />
                <select
                  value={activeBusinessId || ''}
                  onChange={(e) => {
                    setActiveBusinessId(e.target.value);
                    setCreatingNewBusiness(false);
                  }}
                  className="w-full text-xs font-semibold text-[#1C1B22] bg-[#F8F7FB] border border-[#E6E2F0] rounded-lg px-2.5 py-2"
                >
                  {businesses.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <p className="text-xs text-[#6E6A7C]">No business profile yet</p>
            )}

            <button
              type="button"
              onClick={() => {
                setCreatingNewBusiness(true);
                setActiveSection('assessment');
                setMobileNavOpen(false);
              }}
              className="w-full py-1.5 px-2.5 text-xs font-medium text-[#4C1D95] hover:bg-[#F3EFFC] rounded-lg flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Another Business
            </button>
          </div>

          {/* Nav Links */}
          {activeBusiness && !creatingNewBusiness && (
            <nav className="p-3 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveSection(item.id);
                      setMobileNavOpen(false);
                    }}
                    className={`w-full px-3 py-2.5 rounded-lg text-xs font-medium flex items-center justify-between transition-colors whitespace-nowrap ${
                      active
                        ? 'bg-[#4C1D95] text-white'
                        : 'text-[#4A4756] hover:bg-[#F3EFFC] hover:text-[#1C1B22]'
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <Icon className="w-4 h-4 shrink-0" />
                      <span>{item.label}</span>
                    </span>
                    {typeof item.count === 'number' && item.count > 0 && (
                      <span
                        className={`font-mono-tabular text-[11px] ${
                          active ? 'text-white' : 'text-[#4C1D95]'
                        }`}
                      >
                        {item.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          )}
        </div>

        <div className="p-4 border-t border-[#E6E2F0] space-y-2">
          <div className="text-xs">
            <p className="font-semibold text-[#1C1B22] truncate">
              {userProfile?.displayName || firebaseUser.email}
            </p>
            <p className="text-[#6E6A7C] truncate">{firebaseUser.email}</p>
          </div>
          <button
            type="button"
            onClick={() => signOut(auth)}
            className="w-full py-2 px-3 text-xs font-medium text-[#4A4756] border border-[#E6E2F0] rounded-lg hover:bg-[#F8F7FB] flex items-center justify-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Viewport */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-20 bg-white border-b border-[#E6E2F0] px-6 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="lg:hidden p-1.5 border border-[#E6E2F0] rounded-lg text-[#4A4756]"
              aria-label="Open menu"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="text-xs text-[#6E6A7C] truncate">
              <span>Busi Rx</span>
              {activeBusiness && !creatingNewBusiness && (
                <>
                  <span className="mx-1.5">/</span>
                  <span className="text-[#1C1B22] font-medium">{activeBusiness.name}</span>
                  <span className="mx-1.5">/</span>
                  <span className="text-[#4C1D95] font-semibold">{activeNavLabel}</span>
                </>
              )}
            </div>
          </div>

          {activeBusiness && !creatingNewBusiness && (
            <button
              type="button"
              onClick={() => setAssistantOpen(true)}
              className="px-3.5 py-2 text-xs font-semibold bg-[#F3EFFC] text-[#4C1D95] rounded-lg hover:bg-[#E8E0FA] flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Ask Busi Rx
            </button>
          )}
        </header>

        <main
          className={`flex-1 p-6 lg:p-8 w-full mx-auto space-y-6 ${
            activeSection === 'leads' ? 'max-w-7xl' : 'max-w-6xl'
          }`}
        >
          {globalError && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center justify-between">
              <span className="break-words">{globalError}</span>
              <button
                type="button"
                onClick={() => setGlobalError('')}
                className="underline ml-4 shrink-0"
              >
                Dismiss
              </button>
            </div>
          )}

          {!activeBusiness || creatingNewBusiness ? (
            <AssessmentWizard
              existingBusiness={null}
              isSubmitting={isGenerating}
              errorMessage={assessmentError}
              onSubmit={handleAssessmentSubmit}
              onCancel={
                businesses.length > 0 ? () => setCreatingNewBusiness(false) : undefined
              }
            />
          ) : activeSection === 'dashboard' ? (
            <DashboardOverview
              business={activeBusiness}
              blueprintItems={blueprintItems}
              tasks={tasks}
              obligations={obligations}
              notifications={notifications}
              socialDays={socialDays}
              leads={leads}
              onNavigate={setActiveSection}
              onMarkNotificationRead={(id) => markNotificationRead(activeBusiness.id, id)}
            />
          ) : activeSection === 'assessment' ? (
            <AssessmentWizard
              existingBusiness={activeBusiness}
              isSubmitting={isGenerating}
              errorMessage={assessmentError}
              onSubmit={handleAssessmentSubmit}
              onCancel={() => setActiveSection('dashboard')}
            />
          ) : activeSection === 'blueprint' ? (
            <BlueprintReviewView
              businessName={activeBusiness.name}
              items={blueprintItems}
              isGenerating={isGenerating}
              onApproveSelected={async (selected) => {
                await approveBlueprintItemsAndCreateTasks({
                  businessId: activeBusiness.id,
                  ownerUid: firebaseUser.uid,
                  actorEmail: firebaseUser.email || '',
                  itemsToApprove: selected,
                  existingTasks: tasks,
                });
                setActiveSection('tasks');
              }}
              onDismissItem={(id) => dismissBlueprintItem(activeBusiness.id, id)}
              onRegenerateAll={handleRegenerateAll}
            />
          ) : activeSection === 'tasks' && userProfile ? (
            <TasksAutomationView
              tasks={tasks}
              notifications={notifications}
              userProfile={userProfile}
              onCreateTask={(input) =>
                createManualTask({
                  businessId: activeBusiness.id,
                  ownerUid: firebaseUser.uid,
                  ...input,
                })
              }
              onApproveTask={(task) =>
                approveConsequentialTask({
                  businessId: activeBusiness.id,
                  ownerUid: firebaseUser.uid,
                  actorEmail: firebaseUser.email || '',
                  task,
                })
              }
              onCompleteTask={(task) =>
                completeOrAdvanceTask({
                  businessId: activeBusiness.id,
                  ownerUid: firebaseUser.uid,
                  actorEmail: firebaseUser.email || '',
                  task,
                })
              }
              onUpdateAssignee={(taskId, assignee) =>
                updateTaskAssignee(activeBusiness.id, taskId, assignee)
              }
              onDeleteTask={(taskId) => deleteTask(activeBusiness.id, taskId)}
              onRunReminderCheck={() =>
                runReminderCheckAndLog({
                  business: activeBusiness,
                  userProfile,
                  tasks,
                  obligations,
                  teamMembers,
                  leads,
                  existingNotifications: notifications,
                })
              }
              onMarkNotifRead={(notifId) => markNotificationRead(activeBusiness.id, notifId)}
              onUpdateReminderPrefs={(prefs) =>
                updateUserNotificationPreferences(firebaseUser.uid, prefs)
              }
            />
          ) : activeSection === 'obligations' ? (
            <ObligationsDocumentsView
              obligations={obligations}
              documents={documents}
              onCreateObligation={(input) =>
                createObligation({
                  businessId: activeBusiness.id,
                  ownerUid: firebaseUser.uid,
                  actorEmail: firebaseUser.email || '',
                  ...input,
                })
              }
              onApproveAndResolveObligation={(obl) =>
                approveAndResolveObligation({
                  businessId: activeBusiness.id,
                  ownerUid: firebaseUser.uid,
                  actorEmail: firebaseUser.email || '',
                  obligation: obl,
                })
              }
              onUploadDocument={(input) =>
                uploadPrivateDocumentRecord({
                  businessId: activeBusiness.id,
                  ownerUid: firebaseUser.uid,
                  actorEmail: firebaseUser.email || '',
                  ...input,
                })
              }
            />
          ) : activeSection === 'operations' ? (
            <TeamFinanceGrowthView
              teamMembers={teamMembers}
              financialEntries={financialEntries}
              campaigns={campaigns}
              onCreateTeamMember={(input) =>
                createTeamMember({
                  businessId: activeBusiness.id,
                  ownerUid: firebaseUser.uid,
                  ...input,
                })
              }
              onCreateFinancialEntry={(input) =>
                createFinancialEntry({
                  businessId: activeBusiness.id,
                  ownerUid: firebaseUser.uid,
                  ...input,
                })
              }
              onCreateCampaign={(input) =>
                createMarketingCampaign({
                  businessId: activeBusiness.id,
                  ownerUid: firebaseUser.uid,
                  ...input,
                })
              }
              onApproveCampaign={(id) => approveAndActivateCampaign(activeBusiness.id, id)}
              onOpenSocialCalendar={() => setActiveSection('social_calendar')}
              onOpenLeads={() => setActiveSection('leads')}
            />
          ) : activeSection === 'social_calendar' ? (
            <SocialCalendarView
              businessId={activeBusiness.id}
              businessName={activeBusiness.name}
              days={socialDays}
              leads={leads}
              isGenerating={isGeneratingSocial}
              errorMessage={socialError}
              onSeedStarterCalendar={async ({ startDate, focusGoal }) => {
                setSocialError('');
                const starter = buildStarterSocialCalendarDays(
                  activeBusiness,
                  startDate,
                  focusGoal
                );
                await saveGeneratedSocialCalendar({
                  businessId: activeBusiness.id,
                  ownerUid: firebaseUser.uid,
                  actorEmail: firebaseUser.email || '',
                  generated: starter,
                });
              }}
              onGenerateCalendar={async ({ startDate, focusGoal }) => {
                setSocialError('');
                setIsGeneratingSocial(true);
                try {
                  const generated = await generateSocialCalendarApi({
                    businessId: activeBusiness.id,
                    assessment: activeBusiness,
                    startDate,
                    focusGoal,
                  });
                  await saveGeneratedSocialCalendar({
                    businessId: activeBusiness.id,
                    ownerUid: firebaseUser.uid,
                    actorEmail: firebaseUser.email || '',
                    generated,
                  });
                } catch (err) {
                  setSocialError(
                    err instanceof Error
                      ? err.message
                      : 'Unable to generate 30-day social media calendar.'
                  );
                } finally {
                  setIsGeneratingSocial(false);
                }
              }}
              onToggleMiniTask={(day, taskText) =>
                toggleSocialCalendarMiniTask({
                  businessId: activeBusiness.id,
                  day,
                  taskText,
                })
              }
              onSaveDraftEdits={(params) =>
                updateSocialCalendarDayDraft({
                  businessId: activeBusiness.id,
                  ...params,
                })
              }
              onApproveAndSetStatus={(day, targetStatus) =>
                approveAndMarkSocialDayPublished({
                  businessId: activeBusiness.id,
                  ownerUid: firebaseUser.uid,
                  actorEmail: firebaseUser.email || '',
                  day,
                  targetStatus,
                })
              }
              onLogLeadFromDay={(day) => {
                setPreselectedLeadDay({
                  dayNumber: day.dayNumber,
                  platform: day.platform,
                });
                setActiveSection('leads');
              }}
            />
          ) : activeSection === 'leads' ? (
            <LeadCRM
              businessName={activeBusiness.name}
              leads={leads}
              preselectedDay={preselectedLeadDay}
              onClearPreselectedDay={() => setPreselectedLeadDay(null)}
              onCreateLead={(input) =>
                createLeadRecord({
                  businessId: activeBusiness.id,
                  ownerUid: firebaseUser.uid,
                  actorEmail: firebaseUser.email || '',
                  ...input,
                })
              }
              onUpdateLeadStage={(lead, nextStage) =>
                updateLeadStageAndOutreach({
                  businessId: activeBusiness.id,
                  ownerUid: firebaseUser.uid,
                  actorEmail: firebaseUser.email || '',
                  lead,
                  stage: nextStage,
                })
              }
              onUpdateLeadDetails={(lead, updates) =>
                updateLeadDetails({
                  businessId: activeBusiness.id,
                  ownerUid: firebaseUser.uid,
                  actorEmail: firebaseUser.email || '',
                  lead,
                  updates,
                })
              }
              onDeleteLead={(leadId) => deleteLeadRecord(activeBusiness.id, leadId)}
              onDraftFollowUp={async (lead) => {
                const resp = await draftLeadFollowUpApi({
                  businessName: activeBusiness.name,
                  industry: activeBusiness.industry,
                  activity: activeBusiness.activity,
                  leadName: lead.fullName,
                  companyOrHandle: lead.companyOrHandle,
                  sourceChannel: lead.sourceChannel,
                  sourcePostDay: lead.sourcePostDay,
                  interestSummary: lead.interestSummary,
                  stage: lead.stage,
                });
                return resp.draft;
              }}
            />
          ) : activeSection === 'voice_studio' ? (
            <VoiceStudioView
              business={activeBusiness}
              leads={leads}
              onCreateTaskFromTranscript={async ({ title, description }) => {
                const due = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
                  .toISOString()
                  .slice(0, 10);
                await createManualTask({
                  businessId: activeBusiness.id,
                  ownerUid: firebaseUser.uid,
                  title,
                  description,
                  categoryId: 'daily_operations',
                  priority: 'medium',
                  taskType: 'one_time',
                  recurrenceIntervalDays: 0,
                  dueDate: due,
                  assignee: 'Business Owner',
                  requiresExplicitApproval: false,
                  consequentialActionType: 'none',
                });
                await appendAuditLog({
                  businessId: activeBusiness.id,
                  ownerUid: firebaseUser.uid,
                  actorEmail: firebaseUser.email || '',
                  action: 'task_created_from_transcript',
                  entityType: 'task',
                  entityId: activeBusiness.id,
                  summary: `Created task "${title}" from transcribed audio memo.`,
                });
              }}
              onAppendToLeadNote={async (lead, transcriptText) => {
                const stamp = new Date().toISOString().slice(0, 10);
                const combinedNote = [
                  lead.lastContactNote?.trim(),
                  `[Audio Transcript ${stamp}]: ${transcriptText}`,
                ]
                  .filter(Boolean)
                  .join('\n\n')
                  .slice(0, 1000);
                await updateLeadStageAndOutreach({
                  businessId: activeBusiness.id,
                  ownerUid: firebaseUser.uid,
                  actorEmail: firebaseUser.email || '',
                  lead,
                  stage: lead.stage,
                  lastContactNote: combinedNote,
                });
              }}
            />
          ) : userProfile ? (
            <BillingSecurityView
              userProfile={userProfile}
              businessName={activeBusiness.name}
              readiness={readiness}
              auditLogs={auditLogs}
              onStartCheckout={async (planTier) => {
                const { url } = await createStripeCheckoutApi(planTier);
                if (url) window.location.assign(url);
              }}
              onOpenPortal={async () => {
                const { url } = await openStripePortalApi(userProfile.stripeCustomerId || '');
                if (url) window.location.assign(url);
              }}
              onCancelSubscription={async () => {
                await cancelStripeSubscriptionApi(userProfile.stripeSubscriptionId || '');
                await updateUserSubscriptionState(firebaseUser.uid, {
                  planTier: userProfile.planTier,
                  subscriptionStatus: 'canceled',
                  stripeCustomerId: userProfile.stripeCustomerId || '',
                  stripeSubscriptionId: userProfile.stripeSubscriptionId || '',
                });
                await appendAuditLog({
                  businessId: activeBusiness.id,
                  ownerUid: firebaseUser.uid,
                  actorEmail: firebaseUser.email || '',
                  action: 'subscription_canceled',
                  entityType: 'billing',
                  entityId: userProfile.stripeSubscriptionId || 'sub',
                  summary: 'Scheduled subscription cancellation at end of billing cycle.',
                });
              }}
              onExportData={async () => {
                const payload = await exportBusinessDataJson(
                  firebaseUser.uid,
                  activeBusiness.id,
                  firebaseUser.email || ''
                );
                const blob = new Blob([JSON.stringify(payload, null, 2)], {
                  type: 'application/json',
                });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `busirx-${activeBusiness.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              onDeleteBusiness={async () => {
                await deleteBusinessAndAllData(firebaseUser.uid, activeBusiness.id);
                setActiveSection('dashboard');
              }}
            />
          ) : null}
        </main>
      </div>

      {activeBusiness && (
        <AssistantDrawer
          open={assistantOpen}
          onClose={() => setAssistantOpen(false)}
          business={activeBusiness}
          tasks={tasks}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <WorkspaceApp />
    </ErrorBoundary>
  );
}
