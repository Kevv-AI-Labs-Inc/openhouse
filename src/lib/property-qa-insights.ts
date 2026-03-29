import type { EventAiQaContext } from "@/lib/listing-import-shared";
import {
  type SupportedQaLanguage,
  getLocalizedQaQuestion,
} from "@/lib/property-qa-language";

type PropertyQaInput = {
  propertyAddress?: string | null;
  listPrice?: string | null;
  propertyDescription?: string | null;
  bedrooms?: number | null;
  bathrooms?: string | null;
  sqft?: number | null;
  yearBuilt?: number | null;
  aiQaContext?: EventAiQaContext | null;
};

type PropertyQaCoverageKey =
  | "core"
  | "financial"
  | "building"
  | "schools"
  | "neighborhood"
  | "interior"
  | "policies"
  | "agentPrep";

export type PropertyQaCoverageCategory = {
  key: PropertyQaCoverageKey;
  label: string;
  ready: boolean;
  summary: string;
};

export type PropertyQaCoverageLevel = "strong" | "partial" | "thin";

export type PropertyQaInsights = {
  score: number;
  level: PropertyQaCoverageLevel;
  readyCount: number;
  totalCount: number;
  categories: PropertyQaCoverageCategory[];
  missingLabels: string[];
  suggestedQuestions: string[];
  publishReadiness: PropertyQaPublishReadiness;
};

export type PropertyQaPublishReadiness = {
  status: "ready" | "review" | "blocked";
  label: string;
  summary: string;
  warnings: string[];
  recommendedActions: string[];
};

export type PropertyQaTopic =
  | "financial"
  | "building"
  | "schools"
  | "neighborhood"
  | "interior"
  | "policies"
  | "core";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asBoolean(value: unknown) {
  return typeof value === "boolean" ? value : null;
}

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => asString(item))
    .filter((item): item is string => Boolean(item));
}

function hasAny(values: Array<unknown>) {
  return values.some((value) => {
    if (Array.isArray(value)) {
      return value.length > 0;
    }

    if (typeof value === "boolean") {
      return true;
    }

    return value !== null && value !== undefined && value !== "";
  });
}

export function detectPropertyQaTopic(question: string): PropertyQaTopic {
  if (/(tax|taxes|property tax|maintenance|common charge|hoa|assessment|carry|monthly cost|地税|物业费|管理费)/i.test(question)) {
    return "financial";
  }

  if (/(parking|laundry|pet|doorman|elevator|amenit|gym|pool|storage|停车|洗衣|宠物)/i.test(question)) {
    return "building";
  }

  if (/(school|district|elementary|middle school|high school|学区|学校)/i.test(question)) {
    return "schools";
  }

  if (/(neighborhood|area|restaurant|grocery|commute|subway|train|transit|附近|周边|社区|地铁|通勤)/i.test(question)) {
    return "neighborhood";
  }

  if (/(appliance|heating|cooling|hvac|kitchen|interior|系统|暖气|空调)/i.test(question)) {
    return "interior";
  }

  if (/(sublet|pied-a-terre|pied a terre|financing|occupancy|rule|policy|规定|限制)/i.test(question)) {
    return "policies";
  }

  return "core";
}

export function getPropertyQaInsights(
  input: PropertyQaInput,
  language: SupportedQaLanguage = "en"
): PropertyQaInsights {
  const facts = asRecord(input.aiQaContext?.propertyFacts);
  const financial = asRecord(facts?.financial);
  const schools = asRecord(facts?.schools);
  const building = asRecord(facts?.building);
  const interior = asRecord(facts?.interior);
  const policies = asRecord(facts?.policies);
  const neighborhood = asRecord(facts?.neighborhood);
  const nearbyPoi = asRecord(input.aiQaContext?.nearbyPoi);
  const mlsData = asRecord(input.aiQaContext?.mlsData);
  const faqCount = Array.isArray(input.aiQaContext?.customFaq) ? input.aiQaContext?.customFaq.length : 0;
  const hasAgentNotes = Boolean(asString(input.aiQaContext?.agentNotes));

  const categories: PropertyQaCoverageCategory[] = [
    {
      key: "core",
      label: "Core facts",
      ready: hasAny([
        asString(input.propertyAddress),
        asString(input.listPrice),
        asString(input.propertyDescription),
        input.bedrooms,
        asString(input.bathrooms),
        input.sqft,
        input.yearBuilt,
      ]),
      summary: "Address, price, layout, and listing basics",
    },
    {
      key: "financial",
      label: "Taxes and carry",
      ready: hasAny([
        asNumber(financial?.annualTaxes),
        asNumber(financial?.monthlyTaxes),
        asNumber(financial?.commonCharges),
        asNumber(financial?.maintenanceFee),
        asNumber(financial?.hoaFee),
        asNumber(financial?.assessmentFee),
        asNumber(financial?.estimatedMonthlyCarry),
        asString(financial?.flipTax),
        asString(financial?.taxAbatement),
      ]),
      summary: "Taxes, HOA, maintenance, and monthly carrying costs",
    },
    {
      key: "building",
      label: "Building amenities",
      ready: hasAny([
        asStringArray(building?.parking),
        asStringArray(building?.laundry),
        asStringArray(building?.amenities),
        asStringArray(building?.outdoorSpace),
        asStringArray(building?.utilitiesIncluded),
        asString(building?.petPolicy),
        asBoolean(building?.doorman),
        asBoolean(building?.elevator),
        asBoolean(building?.gym),
        asBoolean(building?.pool),
        asBoolean(building?.storage),
      ]),
      summary: "Amenities, parking, laundry, pets, and services",
    },
    {
      key: "schools",
      label: "Schools",
      ready: hasAny([
        asString(schools?.district),
        asString(schools?.elementary),
        asString(schools?.middle),
        asString(schools?.high),
        asStringArray(schools?.schools),
        asString(nearbyPoi?.schoolDistrict),
        asString(mlsData?.schoolDistrict),
      ]),
      summary: "School district and nearby school references",
    },
    {
      key: "neighborhood",
      label: "Neighborhood and transit",
      ready: hasAny([
        asString(neighborhood?.name),
        asStringArray(neighborhood?.nearbyTransit),
        asStringArray(neighborhood?.nearbyHighlights),
        asString(mlsData?.neighborhood),
        asStringArray(nearbyPoi?.highlights),
      ]),
      summary: "Neighborhood context, transit, and nearby conveniences",
    },
    {
      key: "interior",
      label: "Interior systems",
      ready: hasAny([
        asStringArray(interior?.appliances),
        asStringArray(interior?.heating),
        asStringArray(interior?.cooling),
      ]),
      summary: "Appliances, heating, cooling, and system details",
    },
    {
      key: "policies",
      label: "Rules and policies",
      ready: hasAny([
        asString(policies?.subletAllowed),
        asString(policies?.piedATerreAllowed),
        asString(policies?.financingAllowed),
        asStringArray(policies?.occupancyNotes),
      ]),
      summary: "Financing, occupancy, sublet, and building-rule guidance",
    },
    {
      key: "agentPrep",
      label: "Agent prep",
      ready: faqCount > 0 || hasAgentNotes,
      summary: faqCount > 0
        ? `${faqCount} prepared Q&A pair${faqCount === 1 ? "" : "s"} plus agent notes`
        : "Prepared FAQ answers and custom agent notes",
    },
  ];

  const readyCount = categories.filter((category) => category.ready).length;
  const totalCount = categories.length;
  const score = Math.round((readyCount / totalCount) * 100);
  const level: PropertyQaCoverageLevel =
    score >= 75 ? "strong" : score >= 45 ? "partial" : "thin";
  const publishReadiness = buildPropertyQaPublishReadiness(categories, score);

  return {
    score,
    level,
    readyCount,
    totalCount,
    categories,
    missingLabels: categories.filter((category) => !category.ready).map((category) => category.label),
    suggestedQuestions: buildSuggestedQuestionsFromCategories(categories, language),
    publishReadiness,
  };
}

function buildPropertyQaPublishReadiness(
  categories: PropertyQaCoverageCategory[],
  score: number
): PropertyQaPublishReadiness {
  const categoryMap = new Map(categories.map((category) => [category.key, category]));
  const ready = (key: PropertyQaCoverageKey) => categoryMap.get(key)?.ready ?? false;
  const missing = (key: PropertyQaCoverageKey) => categoryMap.get(key)?.label ?? key;
  const warnings: string[] = [];
  const recommendedActions: string[] = [];

  const addAction = (action: string) => {
    if (!recommendedActions.includes(action)) {
      recommendedActions.push(action);
    }
  };

  if (!ready("core")) {
    warnings.push("Core listing facts are still too thin for reliable public AI answers.");
    addAction("Confirm the address, price, description, beds, baths, and square footage before publishing.");
  }

  if (!ready("agentPrep")) {
    warnings.push("The AI still lacks agent-prepared FAQ answers or notes for common buyer questions.");
    addAction("Add at least a few custom FAQ answers or agent notes before relying on the public chat.");
  }

  if (!ready("financial")) {
    addAction("Add taxes, HOA, maintenance, or monthly carrying cost details.");
  }

  if (!ready("building")) {
    addAction("Add amenities, laundry, parking, pet, and service details.");
  }

  if (!ready("neighborhood")) {
    addAction("Add neighborhood highlights, nearby transit, and convenience context.");
  }

  if (!ready("schools")) {
    addAction("Add school district references if buyers are likely to ask about them.");
  }

  if (!ready("policies")) {
    addAction("Document sublet, financing, pied-a-terre, or occupancy policies if they matter for this listing.");
  }

  if (!ready("interior")) {
    addAction("Add appliances and major system details so the AI can answer interior questions more confidently.");
  }

  const missingSupport = ["financial", "building", "neighborhood", "schools", "policies", "interior"].filter(
    (key) => !ready(key as PropertyQaCoverageKey)
  );
  const hasBlockingGap = !ready("core") || score < 45;
  const needsReview =
    !hasBlockingGap &&
    (!ready("agentPrep") || missingSupport.length >= 3 || score < 70);

  if (hasBlockingGap) {
    if (missingSupport.length > 0) {
      warnings.push(
        `Public AI chat is likely to miss buyer questions about ${missingSupport
          .slice(0, 3)
          .map((key) => missing(key as PropertyQaCoverageKey).toLowerCase())
          .join(", ")}.`
      );
    }

    return {
      status: "blocked",
      label: "Blocked",
      summary: "Publish-time AI coverage is too thin to trust for public buyer Q&A.",
      warnings,
      recommendedActions: recommendedActions.slice(0, 5),
    };
  }

  if (needsReview) {
    if (missingSupport.length > 0) {
      warnings.push(
        `Public AI chat can launch, but it still has visible gaps in ${missingSupport
          .slice(0, 3)
          .map((key) => missing(key as PropertyQaCoverageKey).toLowerCase())
          .join(", ")}.`
      );
    }

    return {
      status: "review",
      label: "Needs review",
      summary: "Coverage is usable, but you should tighten a few buyer-facing answers before publishing.",
      warnings,
      recommendedActions: recommendedActions.slice(0, 5),
    };
  }

  return {
    status: "ready",
    label: "Ready",
    summary: "Coverage is strong enough to publish the public AI chat with confidence.",
    warnings: [],
    recommendedActions: [
      "Keep the prepared FAQ answers current as pricing, availability, or property details change.",
    ],
  };
}

function buildSuggestedQuestionsFromCategories(
  categories: PropertyQaCoverageCategory[],
  language: SupportedQaLanguage = "en"
) {
  const ready = new Set(
    categories.filter((category) => category.ready).map((category) => category.key)
  );
  const suggestions: string[] = [];

  const add = (question: string, shouldAdd = true) => {
    if (!shouldAdd || suggestions.includes(question)) {
      return;
    }

    suggestions.push(question);
  };

  add(getLocalizedQaQuestion(language, "summary"), ready.has("core"));
  add(
    getLocalizedQaQuestion(language, "financial"),
    ready.has("financial")
  );
  add(
    getLocalizedQaQuestion(language, "building"),
    ready.has("building")
  );
  add(
    getLocalizedQaQuestion(language, "schools"),
    ready.has("schools")
  );
  add(
    getLocalizedQaQuestion(language, "neighborhood"),
    ready.has("neighborhood") || ready.has("schools")
  );
  add(
    getLocalizedQaQuestion(language, "policies"),
    ready.has("policies")
  );
  add(
    getLocalizedQaQuestion(language, "interior"),
    ready.has("interior")
  );
  add(
    getLocalizedQaQuestion(language, "agentPrep"),
    ready.has("agentPrep")
  );

  if (suggestions.length < 3) {
    suggestions.push(
      getLocalizedQaQuestion(language, "summary"),
      getLocalizedQaQuestion(language, "neighborhood"),
      getLocalizedQaQuestion(language, "confirmCosts")
    );
  }

  return suggestions.slice(0, 5);
}

export function buildPropertyQaRecoveryQuestions(
  input: PropertyQaInput,
  question: string,
  language: SupportedQaLanguage = "en"
) {
  const insights = getPropertyQaInsights(input, language);
  const topic = detectPropertyQaTopic(question);
  const ready = new Set(
    insights.categories.filter((category) => category.ready).map((category) => category.key)
  );

  const prioritized = [
    topic === "core" && ready.has("core")
      ? getLocalizedQaQuestion(language, "summary")
      : null,
    topic !== "financial" && ready.has("financial")
      ? getLocalizedQaQuestion(language, "financial")
      : null,
    topic !== "building" && ready.has("building")
      ? getLocalizedQaQuestion(language, "building")
      : null,
    topic !== "schools" && ready.has("schools")
      ? getLocalizedQaQuestion(language, "schools")
      : null,
    topic !== "neighborhood" && ready.has("neighborhood")
      ? getLocalizedQaQuestion(language, "neighborhood")
      : null,
    topic !== "policies" && ready.has("policies")
      ? getLocalizedQaQuestion(language, "policies")
      : null,
    topic !== "interior" && ready.has("interior")
      ? getLocalizedQaQuestion(language, "interior")
      : null,
  ].filter((item): item is string => Boolean(item));

  return Array.from(
    new Set([...prioritized, ...buildSuggestedQuestionsFromCategories(insights.categories, language)])
  ).slice(0, 3);
}
