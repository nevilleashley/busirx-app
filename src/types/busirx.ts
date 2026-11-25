export type PlanTier = 'free' | 'starter_rx' | 'business_rx' | 'growth_rx';
export type SubscriptionStatus = 'inactive' | 'active' | 'past_due' | 'canceled' | 'unconfigured';

export type LegalStructure =
  | 'sole_proprietorship'
  | 'llc'
  | 'corporation'
  | 's_corp'
  | 'partnership'
  | 'nonprofit'
  | 'undecided';

export type BusinessStage = 'new' | 'existing';
export type OperatingModel = 'physical' | 'online' | 'both';
export type OfferingType = 'products' | 'services' | 'both';
export type WorkerTypes = 'none' | 'employees' | 'contractors' | 'both';

export type BlueprintCategoryId =
  | 'formation'
  | 'licenses'
  | 'tax_finance'
  | 'banking_bookkeeping'
  | 'insurance_risk'
  | 'employees_hr'
  | 'daily_operations'
  | 'contracts_documents'
  | 'marketing_growth'
  | 'profitability_growth';

export type PriorityLevel = 'critical' | 'high' | 'medium' | 'low';
export type CadenceType = 'one_time' | 'recurring';
export type VerificationStatus = 'verified_requirement' | 'recommendation' | 'needs_confirmation';
export type BlueprintCompletionStatus =
  | 'pending_approval'
  | 'approved'
  | 'in_progress'
  | 'completed'
  | 'dismissed';

export type TaskStatus = 'todo' | 'in_progress' | 'awaiting_approval' | 'completed';
export type ConsequentialActionType = 'none' | 'payment' | 'legal_filing' | 'external_communication';

export type ObligationType = 'bill' | 'license' | 'insurance' | 'certification';
export type ObligationStatus = 'active' | 'due_soon' | 'overdue' | 'paid_or_renewed' | 'needs_confirmation';

export type DocCategory =
  | 'formation'
  | 'license'
  | 'tax'
  | 'insurance'
  | 'contract'
  | 'hr'
  | 'financial'
  | 'other';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  planTier: PlanTier;
  subscriptionStatus: SubscriptionStatus;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  reminderEmailEnabled: boolean;
  reminderInAppEnabled: boolean;
  reminderLeadDays: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface BusinessAssessmentInput {
  name: string;
  industry: string;
  activity: string;
  country: string;
  stateProvince: string;
  city: string;
  jurisdictions: string[];
  stage: BusinessStage;
  legalStructure: LegalStructure;
  employeeCount: number;
  operatingModel: OperatingModel;
  existingRegistrations: string[];
  bankingEstablished: boolean;
  bookkeepingEstablished: boolean;
  offeringType: OfferingType;
  workerTypes: WorkerTypes;
  marketingChannels: string[];
  goals: string[];
}

export interface BusinessRecord extends BusinessAssessmentInput {
  id: string;
  ownerUid: string;
  assessmentVersion: number;
  onboardingComplete: boolean;
  blueprintApprovedAt: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface BlueprintItem {
  id: string;
  businessId: string;
  ownerUid: string;
  categoryId: BlueprintCategoryId;
  categoryNumber: number;
  categoryName: string;
  title: string;
  description: string;
  whyItMatters: string;
  priority: PriorityLevel;
  cadenceType: CadenceType;
  suggestedDeadlineOrFrequency: string;
  recurrenceIntervalDays: number;
  responsiblePerson: string;
  applicableJurisdiction: string;
  officialSourceUrl: string;
  verificationStatus: VerificationStatus;
  completionStatus: BlueprintCompletionStatus;
  requiresExplicitApproval: boolean;
  approvedByOwner: boolean;
  assessmentVersion: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface TaskItem {
  id: string;
  businessId: string;
  ownerUid: string;
  blueprintItemId: string;
  title: string;
  description: string;
  categoryId: string;
  priority: PriorityLevel;
  taskType: CadenceType;
  recurrenceIntervalDays: number;
  dueDate: string;
  nextDueDate: string;
  assignee: string;
  status: TaskStatus;
  requiresExplicitApproval: boolean;
  explicitlyApproved: boolean;
  consequentialActionType: ConsequentialActionType;
  dedupeKey: string;
  completedAt: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ObligationRecord {
  id: string;
  businessId: string;
  ownerUid: string;
  recordType: ObligationType;
  title: string;
  issuerOrVendor: string;
  jurisdiction: string;
  referenceNumber: string;
  amountCents: number;
  currency: string;
  dueOrExpiryDate: string;
  recurrenceIntervalDays: number;
  status: ObligationStatus;
  officialSourceUrl: string;
  requiresExplicitApproval: boolean;
  approvedForAction: boolean;
  notes: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface DocumentRecord {
  id: string;
  businessId: string;
  ownerUid: string;
  title: string;
  docCategory: DocCategory;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  linkedObligationId: string;
  uploadedAt?: unknown;
  updatedAt?: unknown;
}

export interface TeamMemberRecord {
  id: string;
  businessId: string;
  ownerUid: string;
  fullName: string;
  email: string;
  roleTitle: string;
  workerClassification: 'employee_w2' | 'contractor_1099' | 'owner';
  certificationName: string;
  certificationExpiry: string;
  status: 'active' | 'onboarding' | 'offboarded';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface FinancialEntryRecord {
  id: string;
  businessId: string;
  ownerUid: string;
  entryType: 'revenue' | 'expense' | 'tax_reserve';
  category: string;
  description: string;
  amountCents: number;
  entryDate: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface NotificationLogRecord {
  id: string;
  businessId: string;
  ownerUid: string;
  dedupeKey: string;
  channel: 'in_app' | 'email';
  title: string;
  message: string;
  relatedEntityType: 'task' | 'obligation' | 'certification' | 'blueprint' | 'lead';
  relatedEntityId: string;
  deliveryStatus: 'delivered' | 'read' | 'skipped_no_email_provider' | 'failed';
  scheduledFor: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AuditLogRecord {
  id: string;
  businessId: string;
  ownerUid: string;
  action: string;
  actorEmail: string;
  entityType: string;
  entityId: string;
  summary: string;
  createdAt?: unknown;
}

export interface MarketingCampaignRecord {
  id: string;
  businessId: string;
  ownerUid: string;
  channel: string;
  campaignName: string;
  goal: string;
  targetMetric: string;
  status: 'planned' | 'active' | 'paused' | 'completed';
  requiresExternalSendApproval: boolean;
  approvedByOwner: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface SocialCalendarDay {
  id: string;
  businessId: string;
  ownerUid: string;
  dayNumber: number;
  scheduledDate: string;
  platform: string;
  contentPillar: string;
  topicTitle: string;
  hookOrAngle: string;
  captionDraft: string;
  callToAction: string;
  miniTasks: string[];
  completedMiniTasks: string[];
  requiresExternalPublishApproval: boolean;
  approvedToPublish: boolean;
  dayStatus: 'planned' | 'ready' | 'published';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type LeadStage = 'new' | 'contacted' | 'qualified' | 'proposal_sent' | 'won' | 'lost';

export interface LeadRecord {
  id: string;
  businessId: string;
  ownerUid: string;
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
  requiresOutreachApproval: boolean;
  approvedForOutreach: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface SystemReadinessStatus {
  geminiConfigured: boolean;
  firebaseClientConfigured: boolean;
  stripeConfigured: boolean;
  stripeWebhookConfigured: boolean;
  emailProviderConfigured: boolean;
  schedulerActive: boolean;
}
