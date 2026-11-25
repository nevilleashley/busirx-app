import { describe, expect, it } from 'vitest';
import {
  addDaysIso,
  BLUEPRINT_CATEGORIES,
  buildReminderDedupeKey,
  buildTaskDedupeKey,
  inferConsequentialActionType,
  inferRecurrenceDays,
  SUBSCRIPTION_PLANS,
} from './domain.ts';

describe('Busi Rx domain logic', () => {
  it('defines all 10 required blueprint categories in order', () => {
    expect(BLUEPRINT_CATEGORIES).toHaveLength(10);
    expect(BLUEPRINT_CATEGORIES.map((c) => c.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(BLUEPRINT_CATEGORIES[0].name).toBe('Business formation and registration');
    expect(BLUEPRINT_CATEGORIES[9].name).toBe('Profitability and growth');
  });

  it('defines exact subscription pricing tiers ($8, $17, $26)', () => {
    expect(SUBSCRIPTION_PLANS.map((p) => [p.name, p.priceMonthlyUsd])).toEqual([
      ['Starter Rx', 8],
      ['Business Rx', 17],
      ['Growth Rx', 26],
    ]);
  });

  it('recalculates future recurrence dates deterministically', () => {
    expect(addDaysIso('2026-01-01', 30)).toBe('2026-01-31');
    expect(addDaysIso('2026-01-01', 90)).toBe('2026-04-01');
    expect(inferRecurrenceDays('recurring', 'Quarterly estimated tax')).toBe(90);
    expect(inferRecurrenceDays('one_time', 'Once')).toBe(0);
  });

  it('prevents duplicate tasks and reminders with stable dedupe keys', () => {
    const t1 = buildTaskDedupeKey('biz_1', 'bp_42');
    const t2 = buildTaskDedupeKey('biz_1', 'bp_42');
    expect(t1).toBe(t2);

    const r1 = buildReminderDedupeKey('obligation', 'obl_9', '2026-12-01', 'in_app');
    const r2 = buildReminderDedupeKey('obligation', 'obl_9', '2026-12-01', 'email');
    expect(r1).not.toBe(r2);
  });

  it('classifies consequential actions requiring explicit owner approval', () => {
    expect(inferConsequentialActionType('tax_finance', 'Pay quarterly federal tax', true)).toBe(
      'payment'
    );
    expect(inferConsequentialActionType('formation', 'File Articles of Organization', true)).toBe(
      'legal_filing'
    );
    expect(
      inferConsequentialActionType('marketing_growth', 'Send launch email blast', true)
    ).toBe('external_communication');
    expect(inferConsequentialActionType('daily_operations', 'Review weekly SOPs', false)).toBe(
      'none'
    );
  });
});
