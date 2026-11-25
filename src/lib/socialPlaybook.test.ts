import { describe, expect, it } from 'vitest';
import { buildStarterSocialCalendarDays } from './socialPlaybook.ts';
import type { BusinessAssessmentInput } from '../types/busirx.ts';

const SAMPLE_ASSESSMENT: BusinessAssessmentInput = {
  name: 'Oakwood Wellness Studio',
  industry: 'Health & Wellness',
  activity: 'Personalized massage and mobility recovery sessions',
  country: 'United States',
  stateProvince: 'Colorado',
  city: 'Boulder',
  jurisdictions: ['City of Boulder'],
  stage: 'existing',
  legalStructure: 'llc',
  employeeCount: 3,
  operatingModel: 'physical',
  existingRegistrations: ['Colorado LLC'],
  bankingEstablished: true,
  bookkeepingEstablished: true,
  offeringType: 'services',
  workerTypes: 'employees',
  marketingChannels: ['Instagram', 'Google Business Profile', 'LinkedIn'],
  goals: ['Book 25 monthly recurring recovery clients'],
};

describe('30-Day Ready-to-Use Social Playbook', () => {
  it('generates exactly 30 sequential days with ready-to-post copy and 4 mini-tasks each', () => {
    const result = buildStarterSocialCalendarDays(SAMPLE_ASSESSMENT, '2026-12-01');
    expect(result.days).toHaveLength(30);
    expect(result.days[0].dayNumber).toBe(1);
    expect(result.days[0].scheduledDate).toBe('2026-12-01');
    expect(result.days[29].dayNumber).toBe(30);
    expect(result.days[29].scheduledDate).toBe('2026-12-30');

    for (const day of result.days) {
      expect(day.platform.length).toBeGreaterThan(0);
      expect(day.contentPillar.length).toBeGreaterThan(0);
      expect(day.topicTitle.length).toBeGreaterThan(0);
      expect(day.topicTitle.length).toBeLessThanOrEqual(200);
      expect(day.hookOrAngle.length).toBeGreaterThan(0);
      expect(day.captionDraft.length).toBeGreaterThan(40);
      expect(day.captionDraft.length).toBeLessThanOrEqual(2000);
      expect(day.callToAction.length).toBeGreaterThan(0);
      expect(day.miniTasks.length).toBe(4);
      expect(result.days[0].captionDraft).toContain('Oakwood Wellness Studio');
    }
  });
});
