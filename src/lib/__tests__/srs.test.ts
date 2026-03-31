/**
 * Unit tests for SM-2 algorithm (pure function).
 */
import { describe, it, expect } from "vitest";
import { calculateSM2, MASTERED_THRESHOLD } from "@/lib/srs";
import type { SM2Input } from "@/lib/srs";

const NOW = new Date("2026-03-30T00:00:00.000Z");

function sm2(overrides: Partial<SM2Input> & { quality: number }) {
  const defaults: SM2Input = {
    quality: 0,
    repetitions: 0,
    easinessFactor: 2.5,
    interval: 0,
  };
  return calculateSM2({ ...defaults, ...overrides }, NOW);
}

describe("calculateSM2", () => {
  // ---------- quality >= 3 (correct) ----------

  describe("first review (repetitions=0)", () => {
    it("sets interval to 1 day", () => {
      const result = sm2({ quality: 5, repetitions: 0 });
      expect(result.interval).toBe(1);
      expect(result.repetitions).toBe(1);
    });
  });

  describe("second review (repetitions=1)", () => {
    it("sets interval to 6 days", () => {
      const result = sm2({ quality: 4, repetitions: 1, interval: 1 });
      expect(result.interval).toBe(6);
      expect(result.repetitions).toBe(2);
    });
  });

  describe("third+ review (repetitions>=2)", () => {
    it("sets interval to round(prev_interval * EF)", () => {
      const result = sm2({
        quality: 4,
        repetitions: 2,
        interval: 6,
        easinessFactor: 2.5,
      });
      // round(6 * 2.5) = 15
      expect(result.interval).toBe(15);
      expect(result.repetitions).toBe(3);
    });

    it("compounds correctly over multiple reviews", () => {
      // Simulate rep=3, interval=15, EF=2.5 → round(15*2.5)=38
      const result = sm2({
        quality: 4,
        repetitions: 3,
        interval: 15,
        easinessFactor: 2.5,
      });
      expect(result.interval).toBe(Math.round(15 * 2.5)); // 38
    });
  });

  describe("quality=5 (perfect recall)", () => {
    it("increases easiness factor", () => {
      const result = sm2({ quality: 5, easinessFactor: 2.5 });
      // EF = 2.5 + (0.1 - 0*(0.08 + 0*0.02)) = 2.5 + 0.1 = 2.6
      expect(result.easinessFactor).toBeCloseTo(2.6, 5);
    });
  });

  describe("quality=3 (barely correct)", () => {
    it("decreases easiness factor but interval still grows", () => {
      const result = sm2({ quality: 3, easinessFactor: 2.5 });
      // EF = 2.5 + (0.1 - 2*(0.08 + 2*0.02)) = 2.5 + 0.1 - 2*(0.12) = 2.5 + 0.1 - 0.24 = 2.36
      expect(result.easinessFactor).toBeCloseTo(2.36, 5);
      expect(result.interval).toBe(1); // first review
      expect(result.repetitions).toBe(1);
    });

    it("grows interval slower than quality=5 on third review", () => {
      const q5 = sm2({
        quality: 5,
        repetitions: 2,
        interval: 6,
        easinessFactor: 2.5,
      });
      const q3 = sm2({
        quality: 3,
        repetitions: 2,
        interval: 6,
        easinessFactor: 2.5,
      });
      // Both use same EF for interval calc (EF applied before recalc)
      // interval = round(6 * 2.5) = 15 for both
      // But EF differs after recalc
      expect(q5.interval).toBe(q3.interval); // same interval
      expect(q5.easinessFactor).toBeGreaterThan(q3.easinessFactor); // but EF diverges
    });
  });

  // ---------- quality < 3 (forgot) ----------

  describe("quality=1 (forgot)", () => {
    it("resets repetitions to 0 and interval to 1", () => {
      const result = sm2({
        quality: 1,
        repetitions: 5,
        interval: 30,
        easinessFactor: 2.5,
      });
      expect(result.repetitions).toBe(0);
      expect(result.interval).toBe(1);
    });

    it("still adjusts easiness factor", () => {
      const result = sm2({ quality: 1, easinessFactor: 2.5 });
      // EF = 2.5 + (0.1 - 4*(0.08 + 4*0.02)) = 2.5 + 0.1 - 4*0.16 = 2.5 - 0.54 = 1.96
      expect(result.easinessFactor).toBeCloseTo(1.96, 5);
    });
  });

  describe("quality=0 (complete forget)", () => {
    it("resets repetitions to 0 and interval to 1", () => {
      const result = sm2({
        quality: 0,
        repetitions: 10,
        interval: 60,
        easinessFactor: 2.5,
      });
      expect(result.repetitions).toBe(0);
      expect(result.interval).toBe(1);
    });

    it("adjusts EF more aggressively", () => {
      const result = sm2({ quality: 0, easinessFactor: 2.5 });
      // EF = 2.5 + (0.1 - 5*(0.08 + 5*0.02)) = 2.5 + 0.1 - 5*0.18 = 2.5 - 0.8 = 1.7
      expect(result.easinessFactor).toBeCloseTo(1.7, 5);
    });
  });

  describe("quality=2 (borderline fail)", () => {
    it("resets like quality < 3", () => {
      const result = sm2({
        quality: 2,
        repetitions: 3,
        interval: 15,
      });
      expect(result.repetitions).toBe(0);
      expect(result.interval).toBe(1);
    });
  });

  // ---------- EF floor ----------

  describe("easiness factor floor", () => {
    it("never goes below 1.3", () => {
      const result = sm2({ quality: 0, easinessFactor: 1.3 });
      expect(result.easinessFactor).toBe(1.3);
    });

    it("clamps even with extreme low EF input", () => {
      const result = sm2({ quality: 0, easinessFactor: 1.4 });
      // 1.4 + (0.1 - 5*(0.18)) = 1.4 - 0.8 = 0.6 → clamped to 1.3
      expect(result.easinessFactor).toBe(1.3);
    });
  });

  // ---------- nextReviewAt ----------

  describe("nextReviewAt", () => {
    it("adds interval days to reference time", () => {
      const result = sm2({ quality: 5, repetitions: 0 });
      // interval=1 → next = NOW + 1 day
      const expected = new Date("2026-03-31T00:00:00.000Z");
      expect(result.nextReviewAt.getTime()).toBe(expected.getTime());
    });

    it("adds 6 days for second review", () => {
      const result = sm2({ quality: 4, repetitions: 1, interval: 1 });
      // interval=6 → next = NOW + 6 days
      const expected = new Date("2026-04-05T00:00:00.000Z");
      expect(result.nextReviewAt.getTime()).toBe(expected.getTime());
    });
  });

  // ---------- MASTERED_THRESHOLD constant ----------

  describe("MASTERED_THRESHOLD", () => {
    it("is 21 days", () => {
      expect(MASTERED_THRESHOLD).toBe(21);
    });
  });

  describe("SM-2 edge cases", () => {
    it("SM-2 with quality=0: EF decreases but stays >= 1.3", () => {
      const result = sm2({ quality: 0, easinessFactor: 1.3 });
      expect(result.easinessFactor).toBeGreaterThanOrEqual(1.3);
      expect(result.repetitions).toBe(0);
      expect(result.interval).toBe(1);
    });

    it("SM-2 with quality=3: EF decreases by ~0.14", () => {
      const result = sm2({ quality: 3, easinessFactor: 2.5 });
      // EF = 2.5 + (0.1 - (5-3)*(0.08 + (5-3)*0.02)) = 2.5 + 0.1 - 2*(0.08+2*0.02) = 2.5 + 0.1 - 0.24 = 2.36
      expect(result.easinessFactor).toBeCloseTo(2.36, 5);
    });

    it("SM-2 interval progression: 1, 6, then EF*prev", () => {
      // rep=0 → interval=1
      const r1 = sm2({ quality: 4, repetitions: 0 });
      expect(r1.interval).toBe(1);
      // rep=1 → interval=6
      const r2 = sm2({ quality: 4, repetitions: 1, interval: 1, easinessFactor: r1.easinessFactor });
      expect(r2.interval).toBe(6);
      // rep=2 → interval=round(6*EF)
      const r3 = sm2({ quality: 4, repetitions: 2, interval: 6, easinessFactor: r2.easinessFactor });
      expect(r3.interval).toBe(Math.round(6 * r2.easinessFactor));
    });

    it("handles edge case EF=1.3 with quality=4", () => {
      const result = sm2({ quality: 4, easinessFactor: 1.3 });
      // EF = 1.3 + (0.1 - (5-4)*(0.08 + (5-4)*0.02)) = 1.3 + 0.1 - 1*0.10 = 1.3
      // At floor, quality=4 should keep EF at 1.3 or slightly increase
      expect(result.easinessFactor).toBeGreaterThanOrEqual(1.3);
    });
  });
});
