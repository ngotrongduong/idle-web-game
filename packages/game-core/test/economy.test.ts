import { describe, expect, it } from "vitest";
import { HALL_MAX_LEVEL, heroCapacityForHall, teamLimitForHall } from "../src/index";

describe("foundation economy", () => {
  it("grows hero capacity by one per hall level", () => {
    expect(heroCapacityForHall(1)).toBe(4);
    expect(heroCapacityForHall(HALL_MAX_LEVEL)).toBe(13);
  });

  it("opens parallel teams at hall levels 1, 3, 6 and 9", () => {
    const limits = Array.from({ length: HALL_MAX_LEVEL }, (_, index) =>
      teamLimitForHall(index + 1),
    );
    expect(limits).toEqual([1, 1, 2, 2, 2, 3, 3, 3, 4, 4]);
  });

  it("rejects hall levels outside 1..max", () => {
    expect(() => teamLimitForHall(0)).toThrow("hallLevel");
    expect(() => heroCapacityForHall(HALL_MAX_LEVEL + 1)).toThrow("hallLevel");
  });
});
