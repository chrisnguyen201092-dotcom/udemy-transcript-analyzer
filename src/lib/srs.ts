/**
 * SM-2 Spaced Repetition Algorithm — Pure function implementation.
 *
 * Reference: https://en.wikipedia.org/wiki/SuperMemo#Description_of_SM-2_algorithm
 */

export interface SM2Input {
  quality: number; // 0-5
  repetitions: number;
  easinessFactor: number;
  interval: number; // days
}

export interface SM2Output {
  repetitions: number;
  easinessFactor: number;
  interval: number; // days
  nextReviewAt: Date;
}

/** Cards with interval >= this many days are considered "mastered". */
export const MASTERED_THRESHOLD = 21;

/**
 * Calculate the next SM-2 review parameters.
 *
 * @param input - Current card state + review quality
 * @param now   - Optional reference time (default: Date.now())
 * @returns Updated card state with next review date
 */
export function calculateSM2(input: SM2Input, now?: Date): SM2Output {
  const { quality, repetitions, easinessFactor, interval } = input;
  const referenceTime = now ?? new Date();

  let newRepetitions: number;
  let newInterval: number;

  if (quality >= 3) {
    // Correct response — advance the schedule
    const intervals = [1, 6, Math.round(interval * easinessFactor)];
    newInterval = intervals[Math.min(repetitions, 2)];
    newRepetitions = repetitions + 1;
  } else {
    // Incorrect — reset to beginning
    newRepetitions = 0;
    newInterval = 1;
  }

  // Adjust easiness factor (always applied regardless of quality)
  const q = quality;
  const newEF = Math.max(
    1.3,
    easinessFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
  );

  // Calculate next review date
  const nextReviewAt = new Date(
    referenceTime.getTime() + newInterval * 24 * 60 * 60 * 1000
  );

  return {
    repetitions: newRepetitions,
    easinessFactor: newEF,
    interval: newInterval,
    nextReviewAt,
  };
}
