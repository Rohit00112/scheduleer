import { describe, expect, it } from "vitest";
import {
  excelSerialToDate,
  parseDayToIndex,
  toMinutesFromExcelFraction,
  toMinutesFromRange
} from "./normalizers";
import { detectConflicts } from "./conflicts";

describe("normalizers", () => {
  it("converts excel fractions to minutes", () => {
    expect(toMinutesFromExcelFraction(0.3333333333)).toBe(480);
    expect(toMinutesFromExcelFraction(0.3958333333)).toBe(570);
  });

  it("parses time ranges", () => {
    expect(toMinutesFromRange("08:00 AM - 09:30 AM")).toEqual({ start: 480, end: 570 });
  });

  it("converts excel day serial", () => {
    expect(excelSerialToDate(46061)).toBe("2026-02-08");
    expect(parseDayToIndex(46061)).toBe(0);
  });
});

describe("conflicts", () => {
  it("detects room, lecturer, and group conflicts", () => {
    const conflicts = detectConflicts(
      [
        {
          weeklyDay: 1,
          startMinute: 480,
          endMinute: 570,
          classType: "Lecture",
          yearLevel: "1",
          courseCode: "BIT",
          specialization: "C [S2]",
          moduleCode: "CS4001NT",
          moduleTitle: "Programming",
          lecturerName: "Mr. X",
          groupLabel: "C1",
          groupTokens: ["C1"],
          block: "UK",
          level: "1",
          roomName: "Room A",
          sourceSheet: "X",
          sourceRow: 1
        },
        {
          weeklyDay: 1,
          startMinute: 480,
          endMinute: 570,
          classType: "Lecture",
          yearLevel: "1",
          courseCode: "BIT",
          specialization: "C [S2]",
          moduleCode: "CS4002NT",
          moduleTitle: "Programming 2",
          lecturerName: "Mr. X",
          groupLabel: "C1",
          groupTokens: ["C1"],
          block: "UK",
          level: "1",
          roomName: "Room A",
          sourceSheet: "X",
          sourceRow: 2
        }
      ],
      []
    );

    const types = new Set(conflicts.map((item) => item.type));
    expect(types.has("room")).toBe(true);
    expect(types.has("lecturer")).toBe(true);
    expect(types.has("group")).toBe(true);
  });
});
