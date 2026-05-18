import test from "node:test";
import assert from "node:assert/strict";
import { parseWorkerCsv, sampleCsvTemplate, serializeWorkerCsv } from "../lib/csv.ts";

test("parseWorkerCsv parses the bundled sample template", () => {
  const workers = parseWorkerCsv(sampleCsvTemplate);
  assert.equal(workers.length, 2);
  assert.equal(workers[0].team, "Commerce Platform");
  assert.equal(typeof workers[0].focusHoursPerDay, "number");
});

test("parseWorkerCsv rejects unsupported columns", () => {
  assert.throws(
    () => parseWorkerCsv("bad_column\nvalue"),
    /Unsupported CSV columns/
  );
});

test("serializeWorkerCsv round-trips parsed worker signals", () => {
  const workers = parseWorkerCsv(sampleCsvTemplate);
  const serialized = serializeWorkerCsv(workers);
  assert.deepEqual(parseWorkerCsv(serialized), workers);
});
