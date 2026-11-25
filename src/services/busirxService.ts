import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { ref, uploadBytes } from 'firebase/storage';
import { db, handleFirestoreError, OperationType, storage } from '../lib/firebase.ts';
import {
  addDaysIso,
  buildReminderDedupeKey,
  buildTaskDedupeKey,
  daysUntilDate,
  formatIsoDate,
  inferConsequentialActionType,
  inferInitialDueDate,
  inferRecurrenceDays,
  sanitizeId,
} from '../lib/domain.ts';
import type {
  AuditLogRecord,
  BlueprintItem,
  BusinessAssessmentInput,
  BusinessRecord,
  DocCategory,
  DocumentRecord,
  FinancialEntryRecord,
  LeadRecord,
  LeadStage,
  MarketingCampaignRecord,
  NotificationLogRecord,
  ObligationRecord,
  PlanTier,
  SocialCalendarDay,
  SubscriptionStatus,
  TaskItem,
  TeamMemberRecord,
  UserProfile,
} from '../types/busirx.ts';
import {
  dispatchRemindersApi,
  type GeneratedBlueprintResponse,
  type GeneratedSocialCalendarResponse,
} from './apiClient.ts';

function newDocId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return sanitizeId(`${prefix}_${Date.now()}_${rand}`);
}

export async function ensureUserProfile(params: {
  uid: string;
  email: string;
  displayName: string;
}): Promise<UserProfile> {
  const path = `users/${params.uid}`;
  try {
    const userRef = doc(db, 'users', params.uid);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      return snap.data() as UserProfile;
    }
    const profile: UserProfile = {
      uid: params.uid,
      email: params.email.slice(0, 254),
      displayName: (params.displayName || params.email.split('@')[0] || 'Founder').slice(0, 120),
      planTier: 'free',
      subscriptionStatus: 'inactive',
      reminderEmailEnabled: true,
      reminderInAppEnabled: true,
      reminderLeadDays: 7,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(userRef, profile);
    return profile;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function updateUserNotificationPreferences(
  uid: string,
  prefs: {
    displayName: string;
    reminderEmailEnabled: boolean;
    reminderInAppEnabled: boolean;
    reminderLeadDays: number;
  }
): Promise<void> {
  const path = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), {
      displayName: prefs.displayName.slice(0, 120),
      reminderEmailEnabled: prefs.reminderEmailEnabled,
      reminderInAppEnabled: prefs.reminderInAppEnabled,
      reminderLeadDays: Math.max(1, Math.min(90, Math.round(prefs.reminderLeadDays))),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function updateUserSubscriptionState(
  uid: string,
  state: {
    planTier: PlanTier;
    subscriptionStatus: SubscriptionStatus;
    stripeCustomerId: string;
    stripeSubscriptionId: string;
  }
): Promise<void> {
  const path = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), {
      planTier: state.planTier,
      subscriptionStatus: state.subscriptionStatus,
      stripeCustomerId: state.stripeCustomerId.slice(0, 120),
      stripeSubscriptionId: state.stripeSubscriptionId.slice(0, 120),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function appendAuditLog(params: {
  businessId: string;
  ownerUid: string;
  actorEmail: string;
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
}): Promise<void> {
  const id = newDocId('audit');
  const path = `businesses/${params.businessId}/auditLogs/${id}`;
  try {
    await setDoc(doc(db, 'businesses', params.businessId, 'auditLogs', id), {
      id,
      businessId: params.businessId,
      ownerUid: params.ownerUid,
      action: params.action.slice(0, 120),
      actorEmail: params.actorEmail.slice(0, 254),
      entityType: params.entityType.slice(0, 80),
      entityId: params.entityId.slice(0, 128),
      summary: params.summary.slice(0, 500),
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export function subscribeUserBusinesses(
  ownerUid: string,
  onData: (businesses: BusinessRecord[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const q = query(collection(db, 'businesses'), where('ownerUid', '==', ownerUid));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => d.data() as BusinessRecord);
      onData(items);
    },
    (err) => {
      try {
        handleFirestoreError(err, OperationType.LIST, 'businesses');
      } catch (wrapped) {
        onError(wrapped as Error);
      }
    }
  );
}

export async function saveBusinessAssessment(params: {
  businessId?: string;
  ownerUid: string;
  actorEmail: string;
  assessment: BusinessAssessmentInput;
  previousVersion?: number;
}): Promise<string> {
  const businessId = params.businessId || newDocId('biz');
  const path = `businesses/${businessId}`;
  const isUpdate = Boolean(params.businessId);
  try {
    if (isUpdate) {
      await updateDoc(doc(db, 'businesses', businessId), {
        name: params.assessment.name.slice(0, 160),
        industry: params.assessment.industry.slice(0, 120),
        activity: params.assessment.activity.slice(0, 500),
        country: params.assessment.country.slice(0, 100),
        stateProvince: params.assessment.stateProvince.slice(0, 100),
        city: params.assessment.city.slice(0, 100),
        jurisdictions: params.assessment.jurisdictions.slice(0, 15),
        stage: params.assessment.stage,
        legalStructure: params.assessment.legalStructure,
        employeeCount: Math.max(0, Math.min(100000, Math.round(params.assessment.employeeCount))),
        operatingModel: params.assessment.operatingModel,
        existingRegistrations: params.assessment.existingRegistrations.slice(0, 30),
        bankingEstablished: params.assessment.bankingEstablished,
        bookkeepingEstablished: params.assessment.bookkeepingEstablished,
        offeringType: params.assessment.offeringType,
        workerTypes: params.assessment.workerTypes,
        marketingChannels: params.assessment.marketingChannels.slice(0, 20),
        goals: params.assessment.goals.slice(0, 20),
        assessmentVersion: (params.previousVersion || 1) + 1,
        onboardingComplete: true,
        updatedAt: serverTimestamp(),
      });
      await appendAuditLog({
        businessId,
        ownerUid: params.ownerUid,
        actorEmail: params.actorEmail,
        action: 'assessment_updated',
        entityType: 'business',
        entityId: businessId,
        summary: `Updated business assessment to version ${(params.previousVersion || 1) + 1}.`,
      });
    } else {
      await setDoc(doc(db, 'businesses', businessId), {
        id: businessId,
        ownerUid: params.ownerUid,
        name: params.assessment.name.slice(0, 160),
        industry: params.assessment.industry.slice(0, 120),
        activity: params.assessment.activity.slice(0, 500),
        country: params.assessment.country.slice(0, 100),
        stateProvince: params.assessment.stateProvince.slice(0, 100),
        city: params.assessment.city.slice(0, 100),
        jurisdictions: params.assessment.jurisdictions.slice(0, 15),
        stage: params.assessment.stage,
        legalStructure: params.assessment.legalStructure,
        employeeCount: Math.max(0, Math.min(100000, Math.round(params.assessment.employeeCount))),
        operatingModel: params.assessment.operatingModel,
        existingRegistrations: params.assessment.existingRegistrations.slice(0, 30),
        bankingEstablished: params.assessment.bankingEstablished,
        bookkeepingEstablished: params.assessment.bookkeepingEstablished,
        offeringType: params.assessment.offeringType,
        workerTypes: params.assessment.workerTypes,
        marketingChannels: params.assessment.marketingChannels.slice(0, 20),
        goals: params.assessment.goals.slice(0, 20),
        assessmentVersion: 1,
        onboardingComplete: true,
        blueprintApprovedAt: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await appendAuditLog({
        businessId,
        ownerUid: params.ownerUid,
        actorEmail: params.actorEmail,
        action: 'business_created',
        entityType: 'business',
        entityId: businessId,
        summary: `Created business profile "${params.assessment.name}" and completed initial assessment.`,
      });
    }
    return businessId;
  } catch (err) {
    handleFirestoreError(err, isUpdate ? OperationType.UPDATE : OperationType.CREATE, path);
  }
}

export async function saveGeneratedBlueprintItems(params: {
  businessId: string;
  ownerUid: string;
  actorEmail: string;
  assessmentVersion: number;
  generated: GeneratedBlueprintResponse;
  replaceCategoryIds?: string[];
}): Promise<void> {
  const basePath = `businesses/${params.businessId}/blueprintItems`;
  try {
    const existingSnap = await getDocs(
      query(collection(db, 'businesses', params.businessId, 'blueprintItems'), where('ownerUid', '==', params.ownerUid))
    );

    const batch = writeBatch(db);
    existingSnap.docs.forEach((d) => {
      const data = d.data() as BlueprintItem;
      if (!params.replaceCategoryIds || params.replaceCategoryIds.includes(data.categoryId)) {
        if (data.completionStatus === 'pending_approval' || params.replaceCategoryIds) {
          batch.delete(d.ref);
        }
      }
    });

    for (const item of params.generated.items) {
      const id = newDocId('bp');
      const refDoc = doc(db, 'businesses', params.businessId, 'blueprintItems', id);
      batch.set(refDoc, {
        id,
        businessId: params.businessId,
        ownerUid: params.ownerUid,
        categoryId: item.categoryId,
        categoryNumber: item.categoryNumber,
        categoryName: item.categoryName.slice(0, 120),
        title: item.title.slice(0, 200),
        description: item.description.slice(0, 2000),
        whyItMatters: item.whyItMatters.slice(0, 1000),
        priority: item.priority,
        cadenceType: item.cadenceType,
        suggestedDeadlineOrFrequency: item.suggestedDeadlineOrFrequency.slice(0, 120),
        recurrenceIntervalDays:
          item.cadenceType === 'recurring'
            ? inferRecurrenceDays('recurring', item.suggestedDeadlineOrFrequency, item.recurrenceIntervalDays)
            : 0,
        responsiblePerson: item.responsiblePerson.slice(0, 120),
        applicableJurisdiction: item.applicableJurisdiction.slice(0, 200),
        officialSourceUrl: item.officialSourceUrl.slice(0, 500),
        verificationStatus: item.verificationStatus,
        completionStatus: 'pending_approval',
        requiresExplicitApproval: item.requiresExplicitApproval,
        approvedByOwner: false,
        assessmentVersion: params.assessmentVersion,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    await batch.commit();
    await appendAuditLog({
      businessId: params.businessId,
      ownerUid: params.ownerUid,
      actorEmail: params.actorEmail,
      action: params.replaceCategoryIds ? 'blueprint_regenerated' : 'blueprint_generated',
      entityType: 'blueprint',
      entityId: params.businessId,
      summary: `Generated ${params.generated.items.length} blueprint items using Gemini (${params.generated.model}).`,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, basePath);
  }
}

export async function approveBlueprintItemsAndCreateTasks(params: {
  businessId: string;
  ownerUid: string;
  actorEmail: string;
  itemsToApprove: BlueprintItem[];
  existingTasks: TaskItem[];
}): Promise<{ createdTasksCount: number; skippedDuplicates: number }> {
  const path = `businesses/${params.businessId}/tasks`;
  try {
    const existingKeys = new Set(params.existingTasks.map((t) => t.dedupeKey));
    const batch = writeBatch(db);
    let createdTasksCount = 0;
    let skippedDuplicates = 0;

    for (const bp of params.itemsToApprove) {
      const bpRef = doc(db, 'businesses', params.businessId, 'blueprintItems', bp.id);
      batch.update(bpRef, {
        approvedByOwner: true,
        completionStatus: 'approved',
        updatedAt: serverTimestamp(),
      });

      const dedupeKey = buildTaskDedupeKey(params.businessId, bp.id);
      if (existingKeys.has(dedupeKey)) {
        skippedDuplicates += 1;
        continue;
      }

      const taskId = newDocId('task');
      const recurrenceDays =
        bp.cadenceType === 'recurring'
          ? inferRecurrenceDays('recurring', bp.suggestedDeadlineOrFrequency, bp.recurrenceIntervalDays)
          : 0;
      const dueDate = inferInitialDueDate(
        bp.cadenceType,
        recurrenceDays,
        bp.suggestedDeadlineOrFrequency
      );
      const nextDueDate =
        bp.cadenceType === 'recurring' && recurrenceDays > 0
          ? addDaysIso(dueDate, recurrenceDays)
          : '';
      const consequentialActionType = inferConsequentialActionType(
        bp.categoryId,
        bp.title,
        bp.requiresExplicitApproval
      );

      batch.set(doc(db, 'businesses', params.businessId, 'tasks', taskId), {
        id: taskId,
        businessId: params.businessId,
        ownerUid: params.ownerUid,
        blueprintItemId: bp.id,
        title: bp.title.slice(0, 200),
        description: bp.description.slice(0, 2000),
        categoryId: bp.categoryId,
        priority: bp.priority,
        taskType: bp.cadenceType,
        recurrenceIntervalDays: recurrenceDays,
        dueDate,
        nextDueDate,
        assignee: bp.responsiblePerson.slice(0, 120) || 'Business Owner',
        status: bp.requiresExplicitApproval ? 'awaiting_approval' : 'todo',
        requiresExplicitApproval: bp.requiresExplicitApproval,
        explicitlyApproved: false,
        consequentialActionType,
        dedupeKey,
        completedAt: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      createdTasksCount += 1;
      existingKeys.add(dedupeKey);
    }

    batch.update(doc(db, 'businesses', params.businessId), {
      blueprintApprovedAt: new Date().toISOString(),
      updatedAt: serverTimestamp(),
    });

    await batch.commit();
    await appendAuditLog({
      businessId: params.businessId,
      ownerUid: params.ownerUid,
      actorEmail: params.actorEmail,
      action: 'blueprint_approved',
      entityType: 'blueprint',
      entityId: params.businessId,
      summary: `Approved ${params.itemsToApprove.length} blueprint items; created ${createdTasksCount} tasks (${skippedDuplicates} duplicates prevented).`,
    });

    return { createdTasksCount, skippedDuplicates };
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function dismissBlueprintItem(
  businessId: string,
  itemId: string
): Promise<void> {
  const path = `businesses/${businessId}/blueprintItems/${itemId}`;
  try {
    await updateDoc(doc(db, 'businesses', businessId, 'blueprintItems', itemId), {
      completionStatus: 'dismissed',
      approvedByOwner: false,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function createManualTask(params: {
  businessId: string;
  ownerUid: string;
  title: string;
  description: string;
  categoryId: string;
  priority: TaskItem['priority'];
  taskType: TaskItem['taskType'];
  recurrenceIntervalDays: number;
  dueDate: string;
  assignee: string;
  requiresExplicitApproval: boolean;
  consequentialActionType: TaskItem['consequentialActionType'];
}): Promise<void> {
  const id = newDocId('task');
  const path = `businesses/${params.businessId}/tasks/${id}`;
  try {
    const recDays = params.taskType === 'recurring' ? Math.max(1, params.recurrenceIntervalDays || 30) : 0;
    const due = params.dueDate || formatIsoDate(new Date());
    await setDoc(doc(db, 'businesses', params.businessId, 'tasks', id), {
      id,
      businessId: params.businessId,
      ownerUid: params.ownerUid,
      blueprintItemId: '',
      title: params.title.slice(0, 200),
      description: params.description.slice(0, 2000),
      categoryId: params.categoryId.slice(0, 60),
      priority: params.priority,
      taskType: params.taskType,
      recurrenceIntervalDays: recDays,
      dueDate: due,
      nextDueDate: recDays > 0 ? addDaysIso(due, recDays) : '',
      assignee: params.assignee.slice(0, 120) || 'Business Owner',
      status: params.requiresExplicitApproval ? 'awaiting_approval' : 'todo',
      requiresExplicitApproval: params.requiresExplicitApproval,
      explicitlyApproved: false,
      consequentialActionType: params.requiresExplicitApproval ? params.consequentialActionType : 'none',
      dedupeKey: `manual:${id}`,
      completedAt: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function approveConsequentialTask(params: {
  businessId: string;
  ownerUid: string;
  actorEmail: string;
  task: TaskItem;
}): Promise<void> {
  const path = `businesses/${params.businessId}/tasks/${params.task.id}`;
  try {
    await updateDoc(doc(db, 'businesses', params.businessId, 'tasks', params.task.id), {
      explicitlyApproved: true,
      status: 'in_progress',
      updatedAt: serverTimestamp(),
    });
    await appendAuditLog({
      businessId: params.businessId,
      ownerUid: params.ownerUid,
      actorEmail: params.actorEmail,
      action: 'consequential_task_approved',
      entityType: 'task',
      entityId: params.task.id,
      summary: `Owner explicitly approved ${params.task.consequentialActionType} task "${params.task.title}".`,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function completeOrAdvanceTask(params: {
  businessId: string;
  ownerUid: string;
  actorEmail: string;
  task: TaskItem;
}): Promise<{ rolledForwardTo?: string }> {
  const path = `businesses/${params.businessId}/tasks/${params.task.id}`;
  if (params.task.requiresExplicitApproval && !params.task.explicitlyApproved) {
    throw new Error(
      'Explicit owner approval is required before completing this consequential task.'
    );
  }
  try {
    const nowIso = formatIsoDate(new Date());
    if (params.task.taskType === 'recurring' && params.task.recurrenceIntervalDays > 0) {
      const nextDue = addDaysIso(
        params.task.dueDate || nowIso,
        params.task.recurrenceIntervalDays
      );
      const followingDue = addDaysIso(nextDue, params.task.recurrenceIntervalDays);
      await updateDoc(doc(db, 'businesses', params.businessId, 'tasks', params.task.id), {
        status: params.task.requiresExplicitApproval ? 'awaiting_approval' : 'todo',
        dueDate: nextDue,
        nextDueDate: followingDue,
        completedAt: nowIso,
        updatedAt: serverTimestamp(),
      });
      await appendAuditLog({
        businessId: params.businessId,
        ownerUid: params.ownerUid,
        actorEmail: params.actorEmail,
        action: 'recurring_task_completed_and_rescheduled',
        entityType: 'task',
        entityId: params.task.id,
        summary: `Completed recurring task "${params.task.title}"; next due date recalculated to ${nextDue}.`,
      });
      return { rolledForwardTo: nextDue };
    }

    await updateDoc(doc(db, 'businesses', params.businessId, 'tasks', params.task.id), {
      status: 'completed',
      completedAt: nowIso,
      updatedAt: serverTimestamp(),
    });
    await appendAuditLog({
      businessId: params.businessId,
      ownerUid: params.ownerUid,
      actorEmail: params.actorEmail,
      action: 'task_completed',
      entityType: 'task',
      entityId: params.task.id,
      summary: `Completed one-time task "${params.task.title}".`,
    });
    return {};
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function updateTaskAssignee(
  businessId: string,
  taskId: string,
  assignee: string
): Promise<void> {
  const path = `businesses/${businessId}/tasks/${taskId}`;
  try {
    await updateDoc(doc(db, 'businesses', businessId, 'tasks', taskId), {
      assignee: assignee.slice(0, 120) || 'Business Owner',
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function deleteTask(businessId: string, taskId: string): Promise<void> {
  const path = `businesses/${businessId}/tasks/${taskId}`;
  try {
    await deleteDoc(doc(db, 'businesses', businessId, 'tasks', taskId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function createObligation(params: {
  businessId: string;
  ownerUid: string;
  actorEmail: string;
  recordType: ObligationRecord['recordType'];
  title: string;
  issuerOrVendor: string;
  jurisdiction: string;
  referenceNumber: string;
  amountCents: number;
  currency: string;
  dueOrExpiryDate: string;
  recurrenceIntervalDays: number;
  officialSourceUrl: string;
  requiresExplicitApproval: boolean;
  notes: string;
}): Promise<void> {
  const id = newDocId('obl');
  const path = `businesses/${params.businessId}/obligations/${id}`;
  const daysLeft = daysUntilDate(params.dueOrExpiryDate);
  const status: ObligationRecord['status'] =
    daysLeft === null
      ? 'needs_confirmation'
      : daysLeft < 0
      ? 'overdue'
      : daysLeft <= 14
      ? 'due_soon'
      : 'active';

  try {
    await setDoc(doc(db, 'businesses', params.businessId, 'obligations', id), {
      id,
      businessId: params.businessId,
      ownerUid: params.ownerUid,
      recordType: params.recordType,
      title: params.title.slice(0, 200),
      issuerOrVendor: params.issuerOrVendor.slice(0, 160),
      jurisdiction: params.jurisdiction.slice(0, 160),
      referenceNumber: params.referenceNumber.slice(0, 100),
      amountCents: Math.max(0, Math.round(params.amountCents)),
      currency: params.currency.slice(0, 10) || 'USD',
      dueOrExpiryDate: params.dueOrExpiryDate.slice(0, 30),
      recurrenceIntervalDays: Math.max(0, Math.round(params.recurrenceIntervalDays)),
      status,
      officialSourceUrl: params.officialSourceUrl.slice(0, 500),
      requiresExplicitApproval: params.requiresExplicitApproval,
      approvedForAction: false,
      notes: params.notes.slice(0, 1500),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await appendAuditLog({
      businessId: params.businessId,
      ownerUid: params.ownerUid,
      actorEmail: params.actorEmail,
      action: 'obligation_added',
      entityType: params.recordType,
      entityId: id,
      summary: `Added ${params.recordType} "${params.title}" due ${params.dueOrExpiryDate || 'TBD'}.`,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function approveAndResolveObligation(params: {
  businessId: string;
  ownerUid: string;
  actorEmail: string;
  obligation: ObligationRecord;
}): Promise<void> {
  const path = `businesses/${params.businessId}/obligations/${params.obligation.id}`;
  try {
    const hasRecurrence = params.obligation.recurrenceIntervalDays > 0 && params.obligation.dueOrExpiryDate;
    const nextDate = hasRecurrence
      ? addDaysIso(params.obligation.dueOrExpiryDate, params.obligation.recurrenceIntervalDays)
      : params.obligation.dueOrExpiryDate;

    await updateDoc(doc(db, 'businesses', params.businessId, 'obligations', params.obligation.id), {
      approvedForAction: true,
      status: hasRecurrence ? 'active' : 'paid_or_renewed',
      dueOrExpiryDate: nextDate,
      updatedAt: serverTimestamp(),
    });
    await appendAuditLog({
      businessId: params.businessId,
      ownerUid: params.ownerUid,
      actorEmail: params.actorEmail,
      action: 'obligation_approved_and_renewed',
      entityType: params.obligation.recordType,
      entityId: params.obligation.id,
      summary: `Approved & marked "${params.obligation.title}" as paid/renewed${hasRecurrence ? `; next due ${nextDate}` : ''}.`,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function uploadPrivateDocumentRecord(params: {
  businessId: string;
  ownerUid: string;
  actorEmail: string;
  title: string;
  docCategory: DocCategory;
  file: File;
  linkedObligationId?: string;
}): Promise<{ storageUploaded: boolean; warning?: string }> {
  const id = newDocId('doc');
  const path = `businesses/${params.businessId}/documents/${id}`;
  const cleanFileName = params.file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 180);
  const storagePath = `businesses/${params.businessId}/documents/${id}_${cleanFileName}`;
  let storageUploaded = false;
  let warning: string | undefined;

  try {
    const storageRef = ref(storage, storagePath);
    await uploadBytes(storageRef, params.file, {
      contentType: params.file.type || 'application/octet-stream',
    });
    storageUploaded = true;
  } catch (storageErr) {
    warning =
      storageErr instanceof Error
        ? `Metadata saved in Firestore; Firebase Storage upload requires Storage rules/CORS configuration (${storageErr.message}).`
        : 'Metadata saved in Firestore; binary storage bucket not yet configured.';
  }

  try {
    await setDoc(doc(db, 'businesses', params.businessId, 'documents', id), {
      id,
      businessId: params.businessId,
      ownerUid: params.ownerUid,
      title: params.title.slice(0, 200),
      docCategory: params.docCategory,
      fileName: cleanFileName || 'document',
      mimeType: (params.file.type || 'application/octet-stream').slice(0, 120),
      sizeBytes: Math.min(20971520, params.file.size),
      storagePath: storageUploaded ? storagePath : '',
      linkedObligationId: (params.linkedObligationId || '').slice(0, 128),
      uploadedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await appendAuditLog({
      businessId: params.businessId,
      ownerUid: params.ownerUid,
      actorEmail: params.actorEmail,
      action: 'document_recorded',
      entityType: 'document',
      entityId: id,
      summary: `Recorded document "${params.title}" (${cleanFileName}).`,
    });
    return { storageUploaded, warning };
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function createTeamMember(params: {
  businessId: string;
  ownerUid: string;
  fullName: string;
  email: string;
  roleTitle: string;
  workerClassification: TeamMemberRecord['workerClassification'];
  certificationName: string;
  certificationExpiry: string;
}): Promise<void> {
  const id = newDocId('tm');
  const path = `businesses/${params.businessId}/teamMembers/${id}`;
  try {
    await setDoc(doc(db, 'businesses', params.businessId, 'teamMembers', id), {
      id,
      businessId: params.businessId,
      ownerUid: params.ownerUid,
      fullName: params.fullName.slice(0, 140),
      email: params.email.slice(0, 254),
      roleTitle: params.roleTitle.slice(0, 120),
      workerClassification: params.workerClassification,
      certificationName: params.certificationName.slice(0, 160),
      certificationExpiry: params.certificationExpiry.slice(0, 30),
      status: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function createFinancialEntry(params: {
  businessId: string;
  ownerUid: string;
  entryType: FinancialEntryRecord['entryType'];
  category: string;
  description: string;
  amountCents: number;
  entryDate: string;
}): Promise<void> {
  const id = newDocId('fin');
  const path = `businesses/${params.businessId}/financialEntries/${id}`;
  try {
    await setDoc(doc(db, 'businesses', params.businessId, 'financialEntries', id), {
      id,
      businessId: params.businessId,
      ownerUid: params.ownerUid,
      entryType: params.entryType,
      category: params.category.slice(0, 100),
      description: params.description.slice(0, 300),
      amountCents: Math.max(0, Math.round(params.amountCents)),
      entryDate: params.entryDate.slice(0, 30),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function createMarketingCampaign(params: {
  businessId: string;
  ownerUid: string;
  channel: string;
  campaignName: string;
  goal: string;
  targetMetric: string;
  requiresExternalSendApproval: boolean;
}): Promise<void> {
  const id = newDocId('mkt');
  const path = `businesses/${params.businessId}/marketingCampaigns/${id}`;
  try {
    await setDoc(doc(db, 'businesses', params.businessId, 'marketingCampaigns', id), {
      id,
      businessId: params.businessId,
      ownerUid: params.ownerUid,
      channel: params.channel.slice(0, 100),
      campaignName: params.campaignName.slice(0, 180),
      goal: params.goal.slice(0, 400),
      targetMetric: params.targetMetric.slice(0, 160),
      status: 'planned',
      requiresExternalSendApproval: params.requiresExternalSendApproval,
      approvedByOwner: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function approveAndActivateCampaign(
  businessId: string,
  campaignId: string
): Promise<void> {
  const path = `businesses/${businessId}/marketingCampaigns/${campaignId}`;
  try {
    await updateDoc(doc(db, 'businesses', businessId, 'marketingCampaigns', campaignId), {
      approvedByOwner: true,
      status: 'active',
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function saveGeneratedSocialCalendar(params: {
  businessId: string;
  ownerUid: string;
  actorEmail: string;
  generated: GeneratedSocialCalendarResponse;
}): Promise<void> {
  const basePath = `businesses/${params.businessId}/socialCalendarDays`;
  try {
    const existingSnap = await getDocs(
      query(
        collection(db, 'businesses', params.businessId, 'socialCalendarDays'),
        where('ownerUid', '==', params.ownerUid)
      )
    );
    const batch = writeBatch(db);
    existingSnap.docs.forEach((d) => batch.delete(d.ref));

    for (const day of params.generated.days) {
      const id = sanitizeId(`day_${String(day.dayNumber).padStart(2, '0')}`);
      batch.set(doc(db, 'businesses', params.businessId, 'socialCalendarDays', id), {
        id,
        businessId: params.businessId,
        ownerUid: params.ownerUid,
        dayNumber: day.dayNumber,
        scheduledDate: day.scheduledDate.slice(0, 30),
        platform: day.platform.slice(0, 80),
        contentPillar: day.contentPillar.slice(0, 80),
        topicTitle: day.topicTitle.slice(0, 200),
        hookOrAngle: day.hookOrAngle.slice(0, 400),
        captionDraft: day.captionDraft.slice(0, 2000),
        callToAction: day.callToAction.slice(0, 300),
        miniTasks: day.miniTasks.slice(0, 8),
        completedMiniTasks: [],
        requiresExternalPublishApproval: true,
        approvedToPublish: false,
        dayStatus: 'planned',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    await batch.commit();
    await appendAuditLog({
      businessId: params.businessId,
      ownerUid: params.ownerUid,
      actorEmail: params.actorEmail,
      action: 'social_calendar_generated',
      entityType: 'social_calendar',
      entityId: params.businessId,
      summary: `Generated 30-day customer acquisition social media calendar (${params.generated.days.length} days).`,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, basePath);
  }
}

export async function toggleSocialCalendarMiniTask(params: {
  businessId: string;
  day: SocialCalendarDay;
  taskText: string;
}): Promise<void> {
  const path = `businesses/${params.businessId}/socialCalendarDays/${params.day.id}`;
  const current = params.day.completedMiniTasks || [];
  const exists = current.includes(params.taskText);
  const next = exists
    ? current.filter((t) => t !== params.taskText)
    : [...current, params.taskText].slice(0, 8);
  try {
    await updateDoc(doc(db, 'businesses', params.businessId, 'socialCalendarDays', params.day.id), {
      completedMiniTasks: next,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function updateSocialCalendarDayDraft(params: {
  businessId: string;
  dayId: string;
  hookOrAngle: string;
  captionDraft: string;
  callToAction: string;
  scheduledDate: string;
}): Promise<void> {
  const path = `businesses/${params.businessId}/socialCalendarDays/${params.dayId}`;
  try {
    await updateDoc(doc(db, 'businesses', params.businessId, 'socialCalendarDays', params.dayId), {
      hookOrAngle: params.hookOrAngle.slice(0, 400),
      captionDraft: params.captionDraft.slice(0, 2000),
      callToAction: params.callToAction.slice(0, 300),
      scheduledDate: params.scheduledDate.slice(0, 30),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function approveAndMarkSocialDayPublished(params: {
  businessId: string;
  ownerUid: string;
  actorEmail: string;
  day: SocialCalendarDay;
  targetStatus: 'ready' | 'published';
}): Promise<void> {
  const path = `businesses/${params.businessId}/socialCalendarDays/${params.day.id}`;
  try {
    await updateDoc(doc(db, 'businesses', params.businessId, 'socialCalendarDays', params.day.id), {
      approvedToPublish: true,
      dayStatus: params.targetStatus,
      updatedAt: serverTimestamp(),
    });
    if (params.targetStatus === 'published') {
      await appendAuditLog({
        businessId: params.businessId,
        ownerUid: params.ownerUid,
        actorEmail: params.actorEmail,
        action: 'social_post_approved_and_published',
        entityType: 'social_calendar_day',
        entityId: params.day.id,
        summary: `Owner approved and marked Day ${params.day.dayNumber} (${params.day.platform}: ${params.day.topicTitle}) published.`,
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function createLeadRecord(params: {
  businessId: string;
  ownerUid: string;
  actorEmail: string;
  fullName: string;
  companyOrHandle: string;
  email: string;
  phone: string;
  sourceChannel: string;
  sourcePostDay: number;
  interestSummary: string;
  estimatedValueCents: number;
  nextFollowUpDate: string;
  lastContactNote: string;
}): Promise<string> {
  const id = newDocId('lead');
  const path = `businesses/${params.businessId}/leads/${id}`;
  const cleanPostDay = Math.max(0, Math.min(30, Math.round(params.sourcePostDay || 0)));
  try {
    await setDoc(doc(db, 'businesses', params.businessId, 'leads', id), {
      id,
      businessId: params.businessId,
      ownerUid: params.ownerUid,
      fullName: params.fullName.trim().slice(0, 140),
      companyOrHandle: params.companyOrHandle.trim().slice(0, 140),
      email: params.email.trim().slice(0, 254),
      phone: params.phone.trim().slice(0, 40),
      sourceChannel: (params.sourceChannel || 'Social Media').trim().slice(0, 80),
      sourcePostDay: cleanPostDay,
      interestSummary: params.interestSummary.trim().slice(0, 500),
      estimatedValueCents: Math.max(0, Math.min(1000000000, Math.round(params.estimatedValueCents || 0))),
      stage: 'new',
      nextFollowUpDate: params.nextFollowUpDate.trim().slice(0, 30),
      lastContactNote: params.lastContactNote.trim().slice(0, 1000),
      requiresOutreachApproval: true,
      approvedForOutreach: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await appendAuditLog({
      businessId: params.businessId,
      ownerUid: params.ownerUid,
      actorEmail: params.actorEmail,
      action: 'lead_captured',
      entityType: 'lead',
      entityId: id,
      summary: `Captured lead "${params.fullName}" from ${params.sourceChannel}${
        cleanPostDay > 0 ? ` (Calendar Day ${cleanPostDay})` : ''
      }.`,
    });
    return id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function updateLeadStageAndOutreach(params: {
  businessId: string;
  ownerUid: string;
  actorEmail: string;
  lead: LeadRecord;
  stage: LeadStage;
  approvedForOutreach?: boolean;
  nextFollowUpDate?: string;
  lastContactNote?: string;
}): Promise<void> {
  const path = `businesses/${params.businessId}/leads/${params.lead.id}`;
  const nextApproved =
    typeof params.approvedForOutreach === 'boolean'
      ? params.approvedForOutreach
      : params.stage === 'proposal_sent'
      ? true
      : params.lead.approvedForOutreach;
  try {
    await updateDoc(doc(db, 'businesses', params.businessId, 'leads', params.lead.id), {
      stage: params.stage,
      approvedForOutreach: nextApproved,
      nextFollowUpDate: (params.nextFollowUpDate ?? params.lead.nextFollowUpDate).slice(0, 30),
      lastContactNote: (params.lastContactNote ?? params.lead.lastContactNote).slice(0, 1000),
      updatedAt: serverTimestamp(),
    });
    if (params.stage !== params.lead.stage || (nextApproved && !params.lead.approvedForOutreach)) {
      await appendAuditLog({
        businessId: params.businessId,
        ownerUid: params.ownerUid,
        actorEmail: params.actorEmail,
        action: 'lead_stage_updated',
        entityType: 'lead',
        entityId: params.lead.id,
        summary: `Updated lead "${params.lead.fullName}" to stage "${params.stage}"${
          nextApproved ? ' (outreach approved)' : ''
        }.`,
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function updateLeadDetails(params: {
  businessId: string;
  ownerUid: string;
  actorEmail: string;
  lead: LeadRecord;
  updates: {
    fullName: string;
    companyOrHandle: string;
    email: string;
    phone: string;
    sourceChannel: string;
    sourcePostDay: number;
    interestSummary: string;
    estimatedValueCents: number;
    stage: LeadStage;
    nextFollowUpDate: string;
    lastContactNote: string;
    approvedForOutreach: boolean;
  };
}): Promise<void> {
  const path = `businesses/${params.businessId}/leads/${params.lead.id}`;
  const cleanName = params.updates.fullName.trim().slice(0, 140) || params.lead.fullName || 'Lead';
  const cleanChannel =
    params.updates.sourceChannel.trim().slice(0, 80) || params.lead.sourceChannel || 'Direct Outreach';
  const cleanPostDay = Math.max(0, Math.min(30, Math.round(params.updates.sourcePostDay || 0)));
  const cleanValue = Math.max(
    0,
    Math.min(1000000000, Math.round(params.updates.estimatedValueCents || 0))
  );
  const requiresApproval = params.lead.requiresOutreachApproval ?? true;
  const approvedForOutreach =
    params.updates.stage === 'proposal_sent' ? true : Boolean(params.updates.approvedForOutreach);

  try {
    await updateDoc(doc(db, 'businesses', params.businessId, 'leads', params.lead.id), {
      fullName: cleanName,
      companyOrHandle: params.updates.companyOrHandle.trim().slice(0, 140),
      email: params.updates.email.trim().slice(0, 254),
      phone: params.updates.phone.trim().slice(0, 40),
      sourceChannel: cleanChannel,
      sourcePostDay: cleanPostDay,
      interestSummary: params.updates.interestSummary.trim().slice(0, 500),
      estimatedValueCents: cleanValue,
      stage: params.updates.stage,
      nextFollowUpDate: params.updates.nextFollowUpDate.trim().slice(0, 30),
      lastContactNote: params.updates.lastContactNote.trim().slice(0, 1000),
      requiresOutreachApproval: requiresApproval,
      approvedForOutreach,
      updatedAt: serverTimestamp(),
    });

    await appendAuditLog({
      businessId: params.businessId,
      ownerUid: params.ownerUid,
      actorEmail: params.actorEmail,
      action: 'lead_details_updated',
      entityType: 'lead',
      entityId: params.lead.id,
      summary: `Updated lead "${cleanName}" (stage: ${params.updates.stage}).`,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function deleteLeadRecord(businessId: string, leadId: string): Promise<void> {
  const path = `businesses/${businessId}/leads/${leadId}`;
  try {
    await deleteDoc(doc(db, 'businesses', businessId, 'leads', leadId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function runReminderCheckAndLog(params: {
  business: BusinessRecord;
  userProfile: UserProfile;
  tasks: TaskItem[];
  obligations: ObligationRecord[];
  teamMembers: TeamMemberRecord[];
  leads?: LeadRecord[];
  existingNotifications: NotificationLogRecord[];
}): Promise<{ createdCount: number; duplicatesSkipped: number }> {
  const existingKeys = new Set(params.existingNotifications.map((n) => n.dedupeKey));
  const leadDays = params.userProfile.reminderLeadDays || 7;
  const candidateReminders: Array<{
    dedupeKey: string;
    relatedEntityType: NotificationLogRecord['relatedEntityType'];
    relatedEntityId: string;
    title: string;
    message: string;
    dueDate: string;
  }> = [];

  for (const t of params.tasks) {
    if (t.status === 'completed' || !t.dueDate) continue;
    const diff = daysUntilDate(t.dueDate);
    if (diff !== null && diff <= leadDays) {
      const dedupeKey = buildReminderDedupeKey('task', t.id, t.dueDate, 'in_app');
      if (!existingKeys.has(dedupeKey)) {
        candidateReminders.push({
          dedupeKey,
          relatedEntityType: 'task',
          relatedEntityId: t.id,
          title: diff < 0 ? `Overdue task: ${t.title}` : `Task due in ${diff}d: ${t.title}`,
          message: `Assigned to ${t.assignee}. Scheduled due date is ${t.dueDate}.${
            t.requiresExplicitApproval && !t.explicitlyApproved
              ? ' Explicit owner approval is required before execution.'
              : ''
          }`,
          dueDate: t.dueDate,
        });
      }
    }
  }

  for (const o of params.obligations) {
    if (o.status === 'paid_or_renewed' || !o.dueOrExpiryDate) continue;
    const diff = daysUntilDate(o.dueOrExpiryDate);
    if (diff !== null && diff <= leadDays) {
      const dedupeKey = buildReminderDedupeKey('obligation', o.id, o.dueOrExpiryDate, 'in_app');
      if (!existingKeys.has(dedupeKey)) {
        candidateReminders.push({
          dedupeKey,
          relatedEntityType: 'obligation',
          relatedEntityId: o.id,
          title: diff < 0 ? `Overdue ${o.recordType}: ${o.title}` : `${o.recordType} due in ${diff}d: ${o.title}`,
          message: `Vendor/Issuer: ${o.issuerOrVendor || 'Not specified'}. Target date: ${o.dueOrExpiryDate}.`,
          dueDate: o.dueOrExpiryDate,
        });
      }
    }
  }

  for (const m of params.teamMembers) {
    if (!m.certificationExpiry) continue;
    const diff = daysUntilDate(m.certificationExpiry);
    if (diff !== null && diff <= leadDays) {
      const dedupeKey = buildReminderDedupeKey('certification', m.id, m.certificationExpiry, 'in_app');
      if (!existingKeys.has(dedupeKey)) {
        candidateReminders.push({
          dedupeKey,
          relatedEntityType: 'certification',
          relatedEntityId: m.id,
          title: `Certification expiring: ${m.fullName}`,
          message: `${m.certificationName || 'Team certification'} expires on ${m.certificationExpiry}.`,
          dueDate: m.certificationExpiry,
        });
      }
    }
  }

  for (const l of params.leads || []) {
    if (l.stage === 'won' || l.stage === 'lost' || !l.nextFollowUpDate) continue;
    const diff = daysUntilDate(l.nextFollowUpDate);
    if (diff !== null && diff <= leadDays) {
      const dedupeKey = buildReminderDedupeKey('lead', l.id, l.nextFollowUpDate, 'in_app');
      if (!existingKeys.has(dedupeKey)) {
        candidateReminders.push({
          dedupeKey,
          relatedEntityType: 'lead',
          relatedEntityId: l.id,
          title: diff < 0 ? `Overdue lead follow-up: ${l.fullName}` : `Lead follow-up due in ${diff}d: ${l.fullName}`,
          message: `Source: ${l.sourceChannel}. Stage: ${l.stage}. Follow up on ${l.nextFollowUpDate}.`,
          dueDate: l.nextFollowUpDate,
        });
      }
    }
  }

  if (candidateReminders.length === 0) {
    return { createdCount: 0, duplicatesSkipped: existingKeys.size };
  }

  let emailResultsMap = new Map<string, 'delivered' | 'skipped_no_email_provider' | 'failed'>();
  if (params.userProfile.reminderEmailEnabled) {
    try {
      const emailPayload = candidateReminders.slice(0, 25).map((r) => ({
        dedupeKey: `${r.dedupeKey}:email`,
        title: r.title,
        message: r.message,
        dueDate: r.dueDate,
      }));
      const resp = await dispatchRemindersApi({
        recipientEmail: params.userProfile.email,
        businessName: params.business.name,
        reminders: emailPayload,
      });
      emailResultsMap = new Map(resp.results.map((r) => [r.dedupeKey, r.emailStatus]));
    } catch {
      // Fall back to logging in-app reminders cleanly
    }
  }

  const batch = writeBatch(db);
  let createdCount = 0;

  for (const cand of candidateReminders.slice(0, 25)) {
    if (params.userProfile.reminderInAppEnabled) {
      const id = newDocId('notif');
      batch.set(doc(db, 'businesses', params.business.id, 'notifications', id), {
        id,
        businessId: params.business.id,
        ownerUid: params.business.ownerUid,
        dedupeKey: cand.dedupeKey,
        channel: 'in_app',
        title: cand.title.slice(0, 200),
        message: cand.message.slice(0, 1000),
        relatedEntityType: cand.relatedEntityType,
        relatedEntityId: cand.relatedEntityId,
        deliveryStatus: 'delivered',
        scheduledFor: cand.dueDate,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      createdCount += 1;
    }

    if (params.userProfile.reminderEmailEnabled) {
      const emailDedupe = `${cand.dedupeKey}:email`;
      if (!existingKeys.has(emailDedupe)) {
        const emailId = newDocId('notif');
        const status = emailResultsMap.get(emailDedupe) || 'skipped_no_email_provider';
        batch.set(doc(db, 'businesses', params.business.id, 'notifications', emailId), {
          id: emailId,
          businessId: params.business.id,
          ownerUid: params.business.ownerUid,
          dedupeKey: emailDedupe,
          channel: 'email',
          title: cand.title.slice(0, 200),
          message: cand.message.slice(0, 1000),
          relatedEntityType: cand.relatedEntityType,
          relatedEntityId: cand.relatedEntityId,
          deliveryStatus: status,
          scheduledFor: cand.dueDate,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        createdCount += 1;
      }
    }
  }

  const path = `businesses/${params.business.id}/notifications`;
  try {
    await batch.commit();
    return { createdCount, duplicatesSkipped: 0 };
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function markNotificationRead(businessId: string, notifId: string): Promise<void> {
  const path = `businesses/${businessId}/notifications/${notifId}`;
  try {
    await updateDoc(doc(db, 'businesses', businessId, 'notifications', notifId), {
      deliveryStatus: 'read',
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export function subscribeBusinessSubcollection<T>(
  businessId: string,
  ownerUid: string,
  subcollectionName:
    | 'blueprintItems'
    | 'tasks'
    | 'obligations'
    | 'documents'
    | 'teamMembers'
    | 'financialEntries'
    | 'notifications'
    | 'auditLogs'
    | 'marketingCampaigns'
    | 'socialCalendarDays'
    | 'leads',
  onData: (rows: T[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = `businesses/${businessId}/${subcollectionName}`;
  const q = query(
    collection(db, 'businesses', businessId, subcollectionName),
    where('ownerUid', '==', ownerUid)
  );
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => d.data() as T));
    },
    (err) => {
      try {
        handleFirestoreError(err, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped as Error);
      }
    }
  );
}

export async function exportBusinessDataJson(
  uid: string,
  businessId: string,
  actorEmail: string
): Promise<Record<string, unknown>> {
  const subcollections = [
    'blueprintItems',
    'tasks',
    'obligations',
    'documents',
    'teamMembers',
    'financialEntries',
    'notifications',
    'auditLogs',
    'marketingCampaigns',
    'socialCalendarDays',
    'leads',
  ] as const;

  try {
    const userSnap = await getDoc(doc(db, 'users', uid));
    const bizSnap = await getDoc(doc(db, 'businesses', businessId));
    const exportPayload: Record<string, unknown> = {
      exportedAt: new Date().toISOString(),
      userProfile: userSnap.exists() ? userSnap.data() : null,
      business: bizSnap.exists() ? bizSnap.data() : null,
    };

    for (const sub of subcollections) {
      const snap = await getDocs(
        query(collection(db, 'businesses', businessId, sub), where('ownerUid', '==', uid))
      );
      exportPayload[sub] = snap.docs.map((d) => d.data());
    }

    await appendAuditLog({
      businessId,
      ownerUid: uid,
      actorEmail,
      action: 'data_exported',
      entityType: 'business',
      entityId: businessId,
      summary: 'Owner exported full business and account JSON dataset.',
    });

    return exportPayload;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `businesses/${businessId}`);
  }
}

export async function deleteBusinessAndAllData(uid: string, businessId: string): Promise<void> {
  const subcollections = [
    'blueprintItems',
    'tasks',
    'obligations',
    'documents',
    'teamMembers',
    'financialEntries',
    'notifications',
    'auditLogs',
    'marketingCampaigns',
    'socialCalendarDays',
    'leads',
  ] as const;

  try {
    for (const sub of subcollections) {
      const snap = await getDocs(
        query(collection(db, 'businesses', businessId, sub), where('ownerUid', '==', uid))
      );
      const batch = writeBatch(db);
      snap.docs.forEach((d) => batch.delete(d.ref));
      if (!snap.empty) {
        await batch.commit();
      }
    }
    await deleteDoc(doc(db, 'businesses', businessId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `businesses/${businessId}`);
  }
}
