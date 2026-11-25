# Busi Rx Security Specification (Phase 0 TDD)

## 1. Data Invariants
1. **Strict Ownership Isolation**: Every user document (`/users/{userId}`) is readable and writable exclusively by `request.auth.uid == userId` with `request.auth.token.email_verified == true`.
2. **Master Gate Business Ownership**: Every business document (`/businesses/{businessId}`) has an immutable `ownerUid == request.auth.uid`. Every subcollection document (`blueprintItems`, `tasks`, `obligations`, `documents`, `teamMembers`, `financialEntries`, `notifications`, `auditLogs`, `marketingCampaigns`) MUST verify parent business ownership via `get(/databases/$(database)/documents/businesses/$(businessId)).data.ownerUid == request.auth.uid` on single-document operations (`get`, `create`, `update`, `delete`), and enforce `resource.data.ownerUid == request.auth.uid` on `list` queries without `get()` lookups.
3. **Email Verification Gate**: Unverified email accounts (`email_verified == false`) cannot create, update, or delete any business records.
4. **Consequential Action Approval Invariant**: Tasks marked `requiresExplicitApproval == true` cannot transition to `completed` unless `explicitlyApproved == true`.
5. **Immutable Audit Trail**: `/businesses/{businessId}/auditLogs/{logId}` cannot be updated (`allow update: if false`), preserving forensic integrity.
6. **Temporal & Schema Integrity**: `createdAt == request.time` on creation and remains immutable on update; `updatedAt == request.time` on both create and update. Exact `keys().hasAll(...)` and `keys().hasOnly(...)` prevent shadow fields.

## 2. The "Dirty Dozen" Adversarial Payloads (Must Return PERMISSION_DENIED)
1. **Unauthenticated Read/Write**: `GET /businesses/biz_1` with `auth == null`.
2. **Unverified Email Write**: `CREATE /businesses/biz_1` with `auth.token.email_verified == false`.
3. **Cross-Tenant Business Read**: User B (`uid: "user_b"`) reads `/businesses/biz_a` owned by `user_a`.
4. **Cross-Tenant Subcollection Write**: User B writes `/businesses/biz_a/tasks/task_1` even if setting `ownerUid: "user_b"`.
5. **Identity Spoofing on Create**: User A creates `/businesses/biz_new` with `ownerUid: "user_b"`.
6. **Shadow Field Injection**: User A creates `/users/user_a` with an extra shadow field `isAdmin: true`.
7. **Owner Mutation / Privilege Escalation**: User A updates `/businesses/biz_a` changing `ownerUid` to `"user_b"`.
8. **ID Poisoning (Oversized / Invalid Path ID)**: User A creates `/businesses/` + 200-char ID or `/businesses/bad$id`.
9. **Client Timestamp Forgery**: User A creates `/businesses/biz_a/tasks/t1` with a backdated `createdAt` (`!= request.time`).
10. **Blanket List Query Scraping**: User B executes `list` on `/businesses` without matching `ownerUid == "user_b"`.
11. **Audit Log Tampering**: User A attempts `UPDATE` on `/businesses/biz_a/auditLogs/log_1` to alter history.
12. **Unapproved Consequential Completion**: User A updates a consequential task (`requiresExplicitApproval: true`, `explicitlyApproved: false`) directly to `status: "completed"`.
