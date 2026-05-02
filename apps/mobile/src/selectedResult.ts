import type { TestResult } from "./api/auth";

let _result: TestResult | null = null;

export function setSelectedResult(r: TestResult) { _result = r; }
export function getSelectedResult(): TestResult | null { return _result; }
