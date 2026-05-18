import test from "node:test";
import assert from "node:assert/strict";
import { buildHeuristicReport, scoreWorker } from "../lib/analysis.ts";
import { workerSignals } from "../lib/mock-data.ts";

test("scoreWorker marks clearly overloaded developers as high risk", () => {
  const risk = scoreWorker(workerSignals[0]);
  assert.equal(risk.riskLevel, "high");
  assert.ok(risk.riskScore >= 65);
  assert.ok(risk.factors.includes("elevated release failure risk"));
  assert.equal(risk.category, "incident");
});

test("buildHeuristicReport returns forecast, team metrics, and readiness data", () => {
  const report = buildHeuristicReport(workerSignals, "Test prompt");
  assert.equal(report.mode, "heuristic");
  assert.equal(report.teamMetrics.length > 0, true);
  assert.equal(report.forecast.length, 3);
  assert.equal(report.managerBriefs.length > 0, true);
  assert.equal(report.auditTrail.length >= 4, true);
  assert.equal(report.readiness.dataQualityScore > 0, true);
  assert.equal(report.readiness.connectedSources.length > 0, true);
});

test("release-focused prompts keep explicit release lanes in the release category", () => {
  const report = buildHeuristicReport(
    [
      {
        id: "release-lane",
        name: "Rust Bitcoin Release Lane",
        team: "rust-bitcoin/rust-bitcoin",
        role: "Live GitHub Release Stream",
        location: "github-api",
        manager: "rust-bitcoin maintainers",
        timezone: "master",
        prsOpenedLast14Days: 22,
        reviewLatencyHours: 72,
        afterHoursWorkPct: 96,
        meetingLoadHours: 6,
        focusHoursPerDay: 2.4,
        onCallPagesLast14Days: 0,
        manager1to1GapDays: 0,
        vacationDaysNext30: 5,
        asyncSentimentScore: 3.8,
        note: "Release lane pressure from open PRs and merge backlog."
      }
    ],
    "Detect merged PRs, open PRs, and releases."
  );

  assert.equal(report.risks[0]?.category, "release");
});
