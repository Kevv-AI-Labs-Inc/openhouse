import type { EventPropertyFacts } from "./listing-import-shared";

/** Strict financial parsing: blank, qualified, negative and non-finite values are unknown. */
export function sourceAmount(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) && value >= 0 ? value : null;
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(raw)) return null;
  const amount = Number(raw.replaceAll(",", ""));
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

const periods: Record<string, string> = {
  Monthly: "month", Quarterly: "quarter", Annually: "year", SemiAnnually: "half-year", Weekly: "week", Daily: "day",
};
const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);

export function isCooperativeOwnership(value: unknown): boolean {
  const normalized = text(value).toLowerCase().replace(/[^a-z]/g, "");
  return normalized.includes("cooperative") || normalized === "coop";
}

/** Also safe for old persisted facts: no frequency means no monthly assertion.
 * Historical estimatedMonthlyCarry was derived from incomplete/overlapping fees,
 * so it is deliberately not presented as a verified property cost. */
export function financialFactLines(
  financial: EventPropertyFacts["financial"] | Record<string, unknown> | null | undefined,
  propertyType?: unknown,
): string[] {
  if (!financial) return [];
  const f = financial;
  const isCoop = f.isCoop === true || isCooperativeOwnership(propertyType);
  const result: string[] = [];
  const add = (label: string, raw: unknown, frequency?: unknown) => {
    const value = sourceAmount(raw);
    if (value === null) return;
    const sourcePeriod = text(frequency);
    const period = periods[sourcePeriod];
    result.push(`${label}: ${money(value)}${period ? ` / ${period}` : sourcePeriod ? ` (${sourcePeriod})` : " (billing period not provided)"}`);
  };
  const year = typeof f.taxYear === "number" && Number.isInteger(f.taxYear) && f.taxYear >= 1900 && f.taxYear <= 2200 ? ` (${f.taxYear})` : "";
  add(`${isCoop ? "Reported annual tax" : "Annual taxes"}${year}`, f.annualTaxes, "Annually");
  add(isCoop ? "Reported monthly tax" : "Monthly taxes", f.monthlyTaxes, "Monthly");
  add("Common charges", f.commonCharges, f.commonChargesFrequency);
  add(f.maintenanceFeeEstimated === true ? "Estimated maintenance" : "Maintenance", f.maintenanceFee, f.maintenanceFeeFrequency);
  add("HOA fee", f.hoaFee, f.hoaFeeFrequency);
  add("Additional association fee", f.hoaFee2, f.hoaFee2Frequency);
  add("Assessment fee", f.assessmentFee, f.assessmentFeeFrequency);
  if (Array.isArray(f.feeIncludes)) {
    const includes = f.feeIncludes.map(text).filter(Boolean);
    if (includes.length) result.push(`Fee includes: ${includes.join(", ")}`);
  }
  if (isCoop && (sourceAmount(f.annualTaxes) !== null || sourceAmount(f.monthlyTaxes) !== null)) {
    result.push("Co-op tax may be building-level or included in maintenance; confirm unit costs with management.");
  }
  return result;
}
