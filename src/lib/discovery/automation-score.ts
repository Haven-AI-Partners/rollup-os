/**
 * Deterministic automation score calculator (0-100).
 * All scoring logic lives here — the LLM only extracts structured data.
 */

interface WorkflowScoreInput {
  ruleBasedNature: number | null;       // 0-100 scale
  standardizationLevel: string | null;  // high | medium | low
  timeSpentMinutes: number | null;      // parsed minutes
  frequency: string | null;             // daily | weekly | monthly | quarterly | annually | ad_hoc
  volume: string | null;                // high | medium | low
  riskLevel: string | null;             // low | medium | high
  businessImpact: string | null;        // low | medium | high (defaults to medium)
}

const STANDARDIZATION_POINTS: Record<string, number> = {
  high: 15,
  medium: 8,
  low: 0,
};

const RISK_POINTS: Record<string, number> = {
  low: 15,
  medium: 7,
  high: 0,
};

const FREQUENCY_POINTS: Record<string, number> = {
  daily: 10,
  weekly: 7,
  monthly: 3,
  quarterly: 1,
  annually: 1,
  ad_hoc: 0,
};

const VOLUME_POINTS: Record<string, number> = {
  high: 5,
  medium: 3,
  low: 0,
};

const BUSINESS_IMPACT_POINTS: Record<string, number> = {
  high: 10,
  medium: 5,
  low: 0,
};

function timeSpentPoints(minutes: number | null): number {
  if (minutes == null || minutes < 10) return 0;
  if (minutes <= 30) return 5;
  if (minutes <= 60) return 10;
  if (minutes <= 120) return 15;
  return 20;
}

export function calculateAutomationScore(input: WorkflowScoreInput): number {
  let score = 0;

  // Rule-Based Nature: 0-25 points (scaled from 0-100)
  score += Math.round(((input.ruleBasedNature ?? 0) / 100) * 25);

  // Time Spent: 0-20 points
  score += timeSpentPoints(input.timeSpentMinutes);

  // Standardization: 0-15 points
  score += STANDARDIZATION_POINTS[input.standardizationLevel ?? ""] ?? 0;

  // Risk (inverted): 0-15 points
  score += RISK_POINTS[input.riskLevel ?? ""] ?? 0;

  // Frequency: 0-10 points
  score += FREQUENCY_POINTS[input.frequency ?? ""] ?? 0;

  // Business Impact: 0-10 points (default to medium = 5)
  score += BUSINESS_IMPACT_POINTS[input.businessImpact ?? "medium"] ?? 5;

  // Volume: 0-5 points
  score += VOLUME_POINTS[input.volume ?? ""] ?? 0;

  return Math.min(100, Math.max(0, score));
}

/**
 * Parse a free-text time description into minutes.
 * Handles patterns like "30 minutes", "2 hours", "1.5h", "30分", "2時間" etc.
 */
export function parseTimeToMinutes(timeStr: string | null): number | null {
  if (!timeStr) return null;

  const s = timeStr.toLowerCase().trim();

  // Japanese patterns: 30分, 2時間, 1時間30分
  const jpHourMin = s.match(/(\d+(?:\.\d+)?)\s*時間(?:\s*(\d+)\s*分)?/);
  if (jpHourMin) {
    const hours = parseFloat(jpHourMin[1]);
    const mins = jpHourMin[2] ? parseInt(jpHourMin[2]) : 0;
    return Math.round(hours * 60 + mins);
  }
  const jpMin = s.match(/(\d+(?:\.\d+)?)\s*分/);
  if (jpMin) return Math.round(parseFloat(jpMin[1]));

  // English patterns
  const hourMin = s.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)(?:\s*(?:and\s*)?(\d+)\s*(?:minutes?|mins?|m))?/);
  if (hourMin) {
    const hours = parseFloat(hourMin[1]);
    const mins = hourMin[2] ? parseInt(hourMin[2]) : 0;
    return Math.round(hours * 60 + mins);
  }
  const minOnly = s.match(/(\d+(?:\.\d+)?)\s*(?:minutes?|mins?|m\b)/);
  if (minOnly) return Math.round(parseFloat(minOnly[1]));

  // Bracket patterns from scoring doc: "< 10 min", "10-30 min", "1-2 hours"
  const rangeHours = s.match(/(\d+)\s*-\s*(\d+)\s*(?:hours?|hrs?)/);
  if (rangeHours) return Math.round((parseInt(rangeHours[1]) + parseInt(rangeHours[2])) / 2 * 60);
  const rangeMin = s.match(/(\d+)\s*-\s*(\d+)\s*(?:minutes?|mins?)/);
  if (rangeMin) return Math.round((parseInt(rangeMin[1]) + parseInt(rangeMin[2])) / 2);

  // Plain number (assume minutes)
  const plainNum = s.match(/^(\d+(?:\.\d+)?)$/);
  if (plainNum) return Math.round(parseFloat(plainNum[1]));

  return null;
}
