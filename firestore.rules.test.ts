import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

const rulesText = fs.readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf8');
const blueprint = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), 'firebase-blueprint.json'), 'utf8')
) as { firestore: Record<string, unknown> };

describe('Firestore Security Rules & Blueprint Parity (Dirty Dozen Guards)', () => {
  it('begins with a default-deny catch-all rule', () => {
    expect(rulesText).toContain('match /{document=**}');
    expect(rulesText).toContain('allow read, write: if false;');
  });

  it('enforces verified email on user and business writes', () => {
    expect(rulesText).toContain('request.auth.token.email_verified == true');
  });

  it('covers every collection declared in firebase-blueprint.json', () => {
    const expectedPaths = [
      'match /users/{userId}',
      'match /businesses/{businessId}',
      'match /blueprintItems/{itemId}',
      'match /tasks/{taskId}',
      'match /obligations/{obligationId}',
      'match /documents/{docId}',
      'match /teamMembers/{memberId}',
      'match /financialEntries/{entryId}',
      'match /notifications/{notifId}',
      'match /auditLogs/{logId}',
      'match /marketingCampaigns/{campaignId}',
      'match /socialCalendarDays/{dayId}',
    ];
    for (const p of expectedPaths) {
      expect(rulesText).toContain(p);
    }
    expect(Object.keys(blueprint.firestore)).toHaveLength(12);
  });

  it('enforces PII isolation (no blanket list on /users)', () => {
    const usersBlock = rulesText.split('match /users/{userId}')[1].split('match /businesses/{businessId}')[0];
    expect(usersBlock).toContain('allow list: if false;');
  });

  it('enforces Master Gate business ownership and Query Enforcer on list rules', () => {
    expect(rulesText).toContain('function isBusinessOwner(businessId)');
    expect(rulesText).toContain('allow list: if isVerifiedUser() && resource.data.ownerUid == request.auth.uid;');
  });

  it('enforces immutable auditLogs and consequential approval gate on tasks', () => {
    const auditBlock = rulesText.split('match /auditLogs/{logId}')[1].split('match /marketingCampaigns/{campaignId}')[0];
    expect(auditBlock).toContain('allow update: if false;');
    expect(rulesText).toContain(
      "(!(data.requiresExplicitApproval && data.status == 'completed') || data.explicitlyApproved == true)"
    );
  });
});
