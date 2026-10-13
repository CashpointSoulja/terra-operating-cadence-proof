// Synthetic policy for this concept. Thresholds are illustrative, not Terra's.
export const POLICY = {
  homeCurrency: 'GBP' as const,
  financeLeadThresholdAnnualMinor: 2_500_000, // £25,000 a year
  approvalMaxAgeDays: 90,
  agreementExpiryWarningDays: 30,
  maxCostAmountMinor: 50_000_000, // £500,000 cap on any single input
  followThroughMinSample: 3,
  briefWindowDays: 7,
};

export const LIMITS = {
  maxMilestones: 20,
  maxActions: 60,
  maxEvents: 300,
  maxBriefs: 12,
  maxStateBytes: 96_000,
  maxBodyBytes: 8_192,
  maxTitle: 120,
  maxName: 80,
  maxScope: 240,
  maxDocRef: 40,
};
