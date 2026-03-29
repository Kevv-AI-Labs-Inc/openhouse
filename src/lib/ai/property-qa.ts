/**
 * Property Q&A Chatbot Service
 *
 * Best-practice hierarchy:
 * 1) structured listing facts
 * 2) agent-provided FAQ / nearby context
 * 3) imported MLS payload fallback
 * 4) optional constrained public-web search for missing public facts
 */
import type { EventPropertyFacts } from "@/lib/listing-import-shared";
import { buildPropertyQaRecoveryQuestions } from "@/lib/property-qa-insights";
import {
  detectPreferredQaLanguage,
  getQaLanguageDisplayName,
  getQaUiCopy,
  type SupportedQaLanguage,
} from "@/lib/property-qa-language";
import { chatCompletion } from "./openai";
import { hasWebSearchConfiguration, searchPublicWeb, type WebSearchResult } from "./web-search";
import type { PropertyQaSource } from "@/lib/db/schema";

interface PropertyContext {
  propertyAddress: string;
  listPrice?: string | null;
  propertyType?: string | null;
  bedrooms?: number | null;
  bathrooms?: string | null;
  sqft?: number | null;
  yearBuilt?: number | null;
  propertyDescription?: string | null;
  customFaq?: Array<{ question: string; answer: string }>;
  mlsData?: Record<string, unknown>;
  propertyFacts?: EventPropertyFacts | Record<string, unknown> | null;
  nearbyPoi?: Record<string, unknown>;
  agentNotes?: string | null;
}

interface ChatHistory {
  role: "user" | "assistant";
  content: string;
}

type SourceCatalogEntry = PropertyQaSource & {
  promptDescription: string;
};

type ModelQaResponse = {
  answer?: string;
  sourceKeys?: string[];
  answerQuality?: "direct" | "partial" | "uncertain";
  followUpQuestions?: string[];
};

type AnswerQuality = "direct" | "partial" | "uncertain";

function serializeJsonForPrompt(value: unknown, maxChars = 12000): string {
  try {
    const serialized = JSON.stringify(value, null, 2);
    if (serialized.length <= maxChars) {
      return serialized;
    }
    return `${serialized.slice(0, maxChars)}\n... [truncated for length]`;
  } catch {
    return String(value);
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => asString(item))
    .filter((item): item is string => Boolean(item));
}

function formatCurrency(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value)
    ? `$${Math.round(value).toLocaleString()}`
    : null;
}

function formatBoolean(value: boolean | null | undefined) {
  if (value === true) return "Yes";
  if (value === false) return "No";
  return null;
}

function parseDomainList(value: string | undefined) {
  return (value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatPropertyFacts(propertyFacts: PropertyContext["propertyFacts"]) {
  const facts = asRecord(propertyFacts);
  if (!facts) {
    return null;
  }

  const financial = asRecord(facts.financial);
  const schools = asRecord(facts.schools);
  const building = asRecord(facts.building);
  const interior = asRecord(facts.interior);
  const policies = asRecord(facts.policies);
  const neighborhood = asRecord(facts.neighborhood);
  const listing = asRecord(facts.listing);

  const sections: string[] = [];

  const financialLines = [
    formatCurrency(asNumber(financial?.annualTaxes))
      ? `Annual taxes: ${formatCurrency(asNumber(financial?.annualTaxes))}`
      : null,
    formatCurrency(asNumber(financial?.monthlyTaxes))
      ? `Monthly taxes: ${formatCurrency(asNumber(financial?.monthlyTaxes))}`
      : null,
    formatCurrency(asNumber(financial?.commonCharges))
      ? `Common charges: ${formatCurrency(asNumber(financial?.commonCharges))}/month`
      : null,
    formatCurrency(asNumber(financial?.maintenanceFee))
      ? `Maintenance: ${formatCurrency(asNumber(financial?.maintenanceFee))}/month`
      : null,
    formatCurrency(asNumber(financial?.hoaFee))
      ? `HOA fee: ${formatCurrency(asNumber(financial?.hoaFee))}/month`
      : null,
    formatCurrency(asNumber(financial?.assessmentFee))
      ? `Assessment fee: ${formatCurrency(asNumber(financial?.assessmentFee))}/month`
      : null,
    formatCurrency(asNumber(financial?.estimatedMonthlyCarry))
      ? `Estimated monthly carrying cost: ${formatCurrency(asNumber(financial?.estimatedMonthlyCarry))}`
      : null,
    asString(financial?.flipTax) ? `Flip tax: ${asString(financial?.flipTax)}` : null,
    asString(financial?.taxAbatement)
      ? `Tax abatement: ${asString(financial?.taxAbatement)}`
      : null,
    ...asStringArray(financial?.notes).map((item) => `Note: ${item}`),
  ].filter(Boolean);

  if (financialLines.length > 0) {
    sections.push(`## Financial Facts\n- ${financialLines.join("\n- ")}`);
  }

  const schoolLines = [
    asString(schools?.district) ? `District: ${asString(schools?.district)}` : null,
    asString(schools?.elementary)
      ? `Elementary school: ${asString(schools?.elementary)}`
      : null,
    asString(schools?.middle) ? `Middle school: ${asString(schools?.middle)}` : null,
    asString(schools?.high) ? `High school: ${asString(schools?.high)}` : null,
    ...asStringArray(schools?.schools).map((item) => `School reference: ${item}`),
  ].filter(Boolean);

  if (schoolLines.length > 0) {
    sections.push(`## School Facts\n- ${schoolLines.join("\n- ")}`);
  }

  const buildingLines = [
    asString(building?.buildingType) ? `Building type: ${asString(building?.buildingType)}` : null,
    asString(building?.petPolicy) ? `Pet policy: ${asString(building?.petPolicy)}` : null,
    formatBoolean(asBoolean(building?.doorman))
      ? `Doorman: ${formatBoolean(asBoolean(building?.doorman))}`
      : null,
    formatBoolean(asBoolean(building?.elevator))
      ? `Elevator: ${formatBoolean(asBoolean(building?.elevator))}`
      : null,
    formatBoolean(asBoolean(building?.gym))
      ? `Gym: ${formatBoolean(asBoolean(building?.gym))}`
      : null,
    formatBoolean(asBoolean(building?.pool))
      ? `Pool: ${formatBoolean(asBoolean(building?.pool))}`
      : null,
    formatBoolean(asBoolean(building?.storage))
      ? `Storage: ${formatBoolean(asBoolean(building?.storage))}`
      : null,
    ...asStringArray(building?.parking).map((item) => `Parking: ${item}`),
    ...asStringArray(building?.laundry).map((item) => `Laundry: ${item}`),
    ...asStringArray(building?.amenities).map((item) => `Amenity: ${item}`),
    ...asStringArray(building?.outdoorSpace).map((item) => `Outdoor space: ${item}`),
    ...asStringArray(building?.utilitiesIncluded).map((item) => `Included utility/service: ${item}`),
  ].filter(Boolean);

  if (buildingLines.length > 0) {
    sections.push(`## Building Facts\n- ${buildingLines.join("\n- ")}`);
  }

  const interiorLines = [
    ...asStringArray(interior?.appliances).map((item) => `Appliance: ${item}`),
    ...asStringArray(interior?.heating).map((item) => `Heating: ${item}`),
    ...asStringArray(interior?.cooling).map((item) => `Cooling: ${item}`),
  ].filter(Boolean);

  if (interiorLines.length > 0) {
    sections.push(`## Interior Facts\n- ${interiorLines.join("\n- ")}`);
  }

  const policyLines = [
    asString(policies?.subletAllowed)
      ? `Sublet policy: ${asString(policies?.subletAllowed)}`
      : null,
    asString(policies?.piedATerreAllowed)
      ? `Pied-a-terre policy: ${asString(policies?.piedATerreAllowed)}`
      : null,
    asString(policies?.financingAllowed)
      ? `Financing policy: ${asString(policies?.financingAllowed)}`
      : null,
    ...asStringArray(policies?.occupancyNotes).map((item) => `Occupancy note: ${item}`),
  ].filter(Boolean);

  if (policyLines.length > 0) {
    sections.push(`## Policy Facts\n- ${policyLines.join("\n- ")}`);
  }

  const neighborhoodLines = [
    asString(neighborhood?.name) ? `Neighborhood: ${asString(neighborhood?.name)}` : null,
    ...asStringArray(neighborhood?.nearbyTransit).map((item) => `Transit: ${item}`),
    ...asStringArray(neighborhood?.nearbyHighlights).map((item) => `Nearby highlight: ${item}`),
  ].filter(Boolean);

  if (neighborhoodLines.length > 0) {
    sections.push(`## Neighborhood Facts\n- ${neighborhoodLines.join("\n- ")}`);
  }

  const listingLines = [
    asString(listing?.status) ? `Listing status: ${asString(listing?.status)}` : null,
    asNumber(listing?.daysOnMarket) !== null
      ? `Days on market: ${asNumber(listing?.daysOnMarket)}`
      : null,
    asString(listing?.virtualTourUrl)
      ? `Virtual tour URL: ${asString(listing?.virtualTourUrl)}`
      : null,
    asString(listing?.source) ? `Source: ${asString(listing?.source)}` : null,
    listing?.fallbackUsed === true ? "Fallback provider was used for this import" : null,
  ].filter(Boolean);

  if (listingLines.length > 0) {
    sections.push(`## Listing Metadata\n- ${listingLines.join("\n- ")}`);
  }

  return sections.length > 0 ? sections.join("\n\n") : null;
}

function shouldUseWebSearch(question: string, context: PropertyContext) {
  if (!hasWebSearchConfiguration()) {
    return false;
  }

  const wantsSchools = /(school|district|学区|学校)/i.test(question);
  const wantsNeighborhood =
    /(neighborhood|area|restaurant|grocery|附近|周边|社区)/i.test(question);
  const wantsTransit = /(commute|subway|train|transit|地铁|通勤|曼哈顿|midtown|manhattan)/i.test(
    question
  );
  const wantsBuilding =
    /(parking|laundry|pet|doorman|elevator|amenit|gym|pool|storage|parking spot|车位|停车|洗衣|宠物)/i.test(question);
  const wantsFinancial =
    /(tax|taxes|property tax|maintenance|common charge|hoa|carrying cost|monthly cost|地税|物业费|管理费)/i.test(question);
  const wantsPolicies =
    /(sublet|sublease|pied-a-terre|pied a terre|financing|occupancy|rule|policy|board approval|出租|转租|政策|规定|贷款)/i.test(question);
  const wantsPublicContext =
    wantsSchools ||
    wantsNeighborhood ||
    wantsTransit ||
    wantsBuilding ||
    wantsFinancial ||
    wantsPolicies;

  if (!wantsPublicContext) {
    return false;
  }

  const facts = asRecord(context.propertyFacts);
  const building = asRecord(facts?.building);
  const financial = asRecord(facts?.financial);
  const nearbyPoi = asRecord(context.nearbyPoi);

  const needsFinancial =
    wantsFinancial &&
    asNumber(financial?.annualTaxes) === null &&
    asNumber(financial?.commonCharges) === null &&
    asNumber(financial?.maintenanceFee) === null &&
    asNumber(financial?.hoaFee) === null;
  const needsBuilding =
    wantsBuilding &&
    asStringArray(building?.parking).length === 0 &&
    asStringArray(building?.laundry).length === 0 &&
    asStringArray(building?.amenities).length === 0 &&
    !asString(building?.petPolicy);
  const needsNeighborhood =
    (wantsNeighborhood || wantsTransit) &&
    (!nearbyPoi || Object.keys(nearbyPoi).length === 0);

  // Public commute, school, and neighborhood questions benefit from live search even
  // when we already have partial local facts, because those topics change more often
  // than listing metadata and visitors expect concrete public-context answers.
  const shouldAugmentSchools = wantsSchools;
  const shouldAugmentNeighborhood = wantsNeighborhood || wantsTransit;
  const shouldAugmentBuilding = wantsBuilding;
  const shouldAugmentFinancial = wantsFinancial;
  const shouldAugmentPolicies = wantsPolicies;

  return (
    shouldAugmentSchools ||
    shouldAugmentNeighborhood ||
    shouldAugmentBuilding ||
    shouldAugmentFinancial ||
    shouldAugmentPolicies ||
    needsFinancial ||
    needsBuilding ||
    needsNeighborhood
  );
}

function buildWebSearchPlan(context: PropertyContext, userMessage: string) {
  const query = (() => {
    if (/(school|district|学区|学校)/i.test(userMessage)) {
      return `${context.propertyAddress} school district assigned schools`;
    }

    if (/(train|subway|transit|commute|地铁|通勤|曼哈顿|midtown|manhattan)/i.test(userMessage)) {
      return `${context.propertyAddress} commute transit subway train Manhattan`;
    }

    if (/(tax|taxes|property tax|maintenance|common charge|hoa|地税|物业费|管理费)/i.test(userMessage)) {
      return `${context.propertyAddress} property tax maintenance HOA common charges`;
    }

    if (/(parking|laundry|pet|doorman|elevator|amenit|gym|pool|storage|车位|停车|洗衣|宠物)/i.test(userMessage)) {
      return `${context.propertyAddress} building amenities parking laundry pet policy`;
    }

    if (/(sublet|sublease|pied-a-terre|pied a terre|financing|occupancy|rule|policy|board approval|出租|转租|政策|规定|贷款)/i.test(userMessage)) {
      return `${context.propertyAddress} building rules sublet financing occupancy policy`;
    }

    if (/(neighborhood|area|restaurant|grocery|附近|周边|社区)/i.test(userMessage)) {
      return `${context.propertyAddress} neighborhood nearby restaurants grocery transit`;
    }

    return `${context.propertyAddress} ${userMessage}`.trim();
  })();
  const includeDomains = (() => {
    if (/(school|district|学区|学校)/i.test(userMessage)) {
      return parseDomainList(process.env.PROPERTY_QA_SCHOOL_SEARCH_DOMAINS);
    }

    if (/(train|subway|transit|commute|地铁|通勤)/i.test(userMessage)) {
      return parseDomainList(process.env.PROPERTY_QA_TRANSIT_SEARCH_DOMAINS);
    }

    if (/(tax|taxes|property tax|maintenance|common charge|hoa|carrying cost|monthly cost|地税|物业费|管理费)/i.test(userMessage)) {
      return parseDomainList(process.env.PROPERTY_QA_TAX_SEARCH_DOMAINS);
    }

    if (/(neighborhood|area|restaurant|grocery|附近|周边|社区)/i.test(userMessage)) {
      return parseDomainList(process.env.PROPERTY_QA_NEIGHBORHOOD_SEARCH_DOMAINS);
    }

    return [];
  })();

  return {
    query,
    includeDomains,
  };
}

function buildSourceCatalog(
  context: PropertyContext,
  webSearchResults: WebSearchResult[]
): SourceCatalogEntry[] {
  const facts = asRecord(context.propertyFacts);
  const sources: SourceCatalogEntry[] = [
    {
      key: "core_listing",
      label: "Core listing facts",
      kind: "listing",
      promptDescription: "Address, price, bedrooms, bathrooms, square footage, year built, and description from the listing.",
    },
  ];

  const addIf = (condition: boolean, entry: SourceCatalogEntry) => {
    if (condition) {
      sources.push(entry);
    }
  };

  addIf(Boolean(asRecord(facts?.financial)), {
    key: "financial_facts",
    label: "Structured financial facts",
    kind: "listing",
    promptDescription: "Taxes, common charges, maintenance, HOA, assessments, and carrying-cost details normalized from imported listing data.",
  });

  addIf(Boolean(asRecord(facts?.schools)), {
    key: "school_facts",
    label: "Structured school facts",
    kind: "listing",
    promptDescription: "School district and school references normalized from imported listing data.",
  });

  addIf(Boolean(asRecord(facts?.building)), {
    key: "building_facts",
    label: "Structured building facts",
    kind: "listing",
    promptDescription: "Parking, laundry, pet policy, amenities, utilities, and building-service details from imported listing data.",
  });

  addIf(Boolean(asRecord(facts?.interior)), {
    key: "interior_facts",
    label: "Structured interior facts",
    kind: "listing",
    promptDescription: "Appliances, heating, cooling, and interior system details from imported listing data.",
  });

  addIf(Boolean(asRecord(facts?.policies)), {
    key: "policy_facts",
    label: "Structured policy facts",
    kind: "listing",
    promptDescription: "Sublet, pied-a-terre, financing, and occupancy rules normalized from imported listing data.",
  });

  addIf(Boolean(asRecord(facts?.neighborhood)), {
    key: "neighborhood_facts",
    label: "Structured neighborhood facts",
    kind: "listing",
    promptDescription: "Neighborhood name, nearby transit, and nearby highlights normalized from imported listing data.",
  });

  addIf(Array.isArray(context.customFaq) && context.customFaq.length > 0, {
    key: "agent_faq",
    label: "Agent-prepared FAQ",
    kind: "agent",
    promptDescription: "Answers explicitly prepared by the listing agent or import workflow.",
  });

  addIf(Boolean(asString(context.agentNotes)), {
    key: "agent_notes",
    label: "Agent notes",
    kind: "agent",
    promptDescription: "Additional guidance, context, and caveats entered manually by the listing agent.",
  });

  addIf(Boolean(context.nearbyPoi && Object.keys(context.nearbyPoi).length > 0), {
    key: "nearby_context",
    label: "Nearby context",
    kind: "listing",
    promptDescription: "Nearby points of interest or local context supplied in listing data or imports.",
  });

  addIf(Boolean(context.mlsData && Object.keys(context.mlsData).length > 0), {
    key: "imported_listing_data",
    label: "Imported listing data",
    kind: "listing",
    promptDescription: "Additional normalized MLS/provider data and raw listing context not covered by the structured facts sections.",
  });

  webSearchResults.forEach((result, index) => {
    sources.push({
      key: `web_${index + 1}`,
      label: result.title || `Public web source ${index + 1}`,
      kind: "public_web",
      url: result.url,
      note: result.snippet,
      promptDescription: `Public web result: ${result.title} (${result.url})`,
    });
  });

  return sources;
}

function formatSourceCatalog(sourceCatalog: SourceCatalogEntry[]) {
  return sourceCatalog
    .map((source) => {
      const parts = [
        `- ${source.key}: ${source.label}`,
        source.promptDescription,
        source.url ? `URL: ${source.url}` : null,
      ].filter(Boolean);

      return parts.join("\n  ");
    })
    .join("\n");
}

function formatWebSearchResults(results: WebSearchResult[]) {
  if (results.length === 0) {
    return null;
  }

  return results
    .map(
      (item, index) =>
        `${index + 1}. ${item.title}\nURL: ${item.url}\nSnippet: ${item.snippet}`
    )
    .join("\n\n");
}

function buildSystemPrompt(params: {
  context: PropertyContext;
  webSearchResults: WebSearchResult[];
  sourceCatalog: SourceCatalogEntry[];
  secondPass?: boolean;
  visitorLanguage: SupportedQaLanguage;
}) {
  const {
    context,
    webSearchResults,
    sourceCatalog,
    secondPass = false,
    visitorLanguage,
  } = params;
  const propertyFactsText = formatPropertyFacts(context.propertyFacts);

  let prompt = `You are a helpful and accurate AI property assistant for:
**${context.propertyAddress}**

Your job is to answer visitor questions about this listing. Keep answers concise, factual, and practical.

## Visitor Language
- Detected visitor language: ${getQaLanguageDisplayName(visitorLanguage)}
- Write the full answer in that language.
- Write followUpQuestions in that same language.
- If the visitor mixes languages, follow the latest user message.

## Core Listing Facts
- Address: ${context.propertyAddress}`;

  if (context.listPrice) prompt += `\n- Listed Price: $${Number(context.listPrice).toLocaleString()}`;
  if (context.propertyType) prompt += `\n- Type: ${context.propertyType.replace(/_/g, " ")}`;
  if (context.bedrooms) prompt += `\n- Bedrooms: ${context.bedrooms}`;
  if (context.bathrooms) prompt += `\n- Bathrooms: ${context.bathrooms}`;
  if (context.sqft) prompt += `\n- Square Feet: ${Number(context.sqft).toLocaleString()}`;
  if (context.yearBuilt) prompt += `\n- Year Built: ${context.yearBuilt}`;

  if (context.propertyDescription) {
    prompt += `\n\n## Listing Description\n${context.propertyDescription}`;
  }

  if (propertyFactsText) {
    prompt += `\n\n${propertyFactsText}`;
  }

  if (context.customFaq && context.customFaq.length > 0) {
    prompt += "\n\n## Agent-Prepared FAQ";
    context.customFaq.forEach((faq) => {
      prompt += `\nQ: ${faq.question}\nA: ${faq.answer}`;
    });
  }

  if (asString(context.agentNotes)) {
    prompt += `\n\n## Agent Notes\n${asString(context.agentNotes)}`;
  }

  if (context.nearbyPoi && Object.keys(context.nearbyPoi).length > 0) {
    prompt += `\n\n## Nearby Context\n${serializeJsonForPrompt(context.nearbyPoi, 3500)}`;
  }

  if (context.mlsData && Object.keys(context.mlsData).length > 0) {
    const { sourcePayload, ...restMlsData } = context.mlsData as Record<string, unknown>;

    if (Object.keys(restMlsData).length > 0) {
      prompt += `\n\n## Normalized MLS Context\n${serializeJsonForPrompt(restMlsData, 4000)}`;
    }

    if (sourcePayload) {
      prompt += `\n\n## Raw MLS Source Payload\nUse this only as a factual fallback when the structured sections above do not answer the question.\n${serializeJsonForPrompt(
        sourcePayload,
        8000
      )}`;
    }
  }

  if (webSearchResults.length > 0) {
    prompt += `\n\n## Live Public Web Results\nThese are optional public-web context snippets gathered for questions about schools, neighborhood, commute, taxes, or building details that may not be present in MLS data.\n${formatWebSearchResults(
      webSearchResults
    )}`;
  }

  prompt += `\n\n## Source Catalog\n${formatSourceCatalog(sourceCatalog)}`;

  if (secondPass) {
    prompt += `\n\n## Recovery Mode
- This is a second pass because the first answer was incomplete or too hesitant.
- Give the best verified partial answer you can from the trusted sources above.
- If part of the visitor's question is still unknown, say exactly which part remains unconfirmed after answering the portion you can support.`;
  }

  prompt += `\n\n## Response Rules
- Answer in the same language as the visitor.
- Prefer structured facts over raw payload.
- Use public web results only for missing public information, never to override listing facts.
- Never invent taxes, fees, school assignments, or building rules.
- If exact information is missing, answer the supported portion first, then clearly note what still needs confirmation from the listing agent.
- Do not refuse the whole question when you can answer part of it reliably.
- Keep answers short: normally 2 to 5 sentences.
- Never switch back to English unless the visitor asked in English.
- For financing, legal, tax, or offer strategy questions, stay helpful but do not provide professional advice.
- If you use public web results, include the relevant public web source keys.
- Return JSON only in this shape:
  {"answer": string, "sourceKeys": string[], "answerQuality": "direct" | "partial" | "uncertain", "followUpQuestions": string[]}
- sourceKeys must only contain keys from the Source Catalog.
- Include only the source keys actually used to answer the question.`;

  return prompt;
}

function parseModelResponse(raw: string): ModelQaResponse {
  try {
    const parsed = JSON.parse(raw) as ModelQaResponse;
    return {
      answer: typeof parsed.answer === "string" ? parsed.answer.trim() : "",
      sourceKeys: Array.isArray(parsed.sourceKeys)
        ? parsed.sourceKeys.filter((item): item is string => typeof item === "string")
        : [],
      answerQuality:
        parsed.answerQuality === "direct" ||
        parsed.answerQuality === "partial" ||
        parsed.answerQuality === "uncertain"
          ? parsed.answerQuality
          : undefined,
      followUpQuestions: Array.isArray(parsed.followUpQuestions)
        ? parsed.followUpQuestions.filter((item): item is string => typeof item === "string")
        : [],
    };
  } catch {
    return {
      answer: raw.trim(),
      sourceKeys: [],
      answerQuality: undefined,
      followUpQuestions: [],
    };
  }
}

function isLowConfidenceAnswer(answer: string | undefined) {
  if (!answer) {
    return true;
  }

  const normalized = answer.trim().toLowerCase();
  return (
    normalized.length < 48 ||
    /i do not have enough reliable information|i don't have enough reliable information|i don't have reliable information|please confirm with the listing agent|i can't confirm|i cannot confirm/.test(
      normalized
    )
  );
}

function normalizeAnswerQuality(
  parsed: ModelQaResponse,
  sourceKeys: string[]
): AnswerQuality {
  if (
    parsed.answerQuality === "direct" ||
    parsed.answerQuality === "partial" ||
    parsed.answerQuality === "uncertain"
  ) {
    return parsed.answerQuality;
  }

  if (isLowConfidenceAnswer(parsed.answer)) {
    return sourceKeys.length > 0 ? "partial" : "uncertain";
  }

  return sourceKeys.length > 0 ? "direct" : "partial";
}

function normalizeSuggestedPrompts(
  value: string[] | undefined,
  fallback: string[]
) {
  const sanitized = (value || [])
    .map((item) => item.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .filter((item) => item.endsWith("?"))
    .slice(0, 3);

  return Array.from(new Set(sanitized.length > 0 ? sanitized : fallback)).slice(0, 3);
}

function deriveFallbackSourceKeys(
  userMessage: string,
  sourceCatalog: SourceCatalogEntry[]
): string[] {
  const available = new Set(sourceCatalog.map((item) => item.key));

  if (/(school|district|学区|学校)/i.test(userMessage)) {
    if (available.has("school_facts")) return ["school_facts"];
  }

  if (/(tax|taxes|property tax|maintenance|common charge|hoa|地税|物业费|管理费)/i.test(userMessage)) {
    if (available.has("financial_facts")) return ["financial_facts"];
  }

  if (/(parking|laundry|pet|doorman|elevator|amenit|gym|pool|停车|洗衣|宠物)/i.test(userMessage)) {
    if (available.has("building_facts")) return ["building_facts"];
  }

  if (/(neighborhood|area|commute|subway|train|transit|附近|周边|通勤|地铁|社区)/i.test(userMessage)) {
    if (available.has("neighborhood_facts")) return ["neighborhood_facts"];
    if (available.has("nearby_context")) return ["nearby_context"];
  }

  return available.has("core_listing") ? ["core_listing"] : [];
}

function mergeWebSearchResults(
  primary: WebSearchResult[],
  secondary: WebSearchResult[]
) {
  const seen = new Set<string>();
  const merged: WebSearchResult[] = [];

  for (const item of [...primary, ...secondary]) {
    const key = item.url || item.title;
    if (!key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    merged.push(item);
  }

  return merged.slice(0, 6);
}

function shouldRetryWithBroaderSearch(
  parsed: ModelQaResponse,
  sourceKeys: string[],
  webSearchResults: WebSearchResult[]
) {
  const quality = normalizeAnswerQuality(parsed, sourceKeys);
  return quality === "uncertain" || (quality === "partial" && webSearchResults.length === 0);
}

function buildRecoveryWebSearchPlan(context: PropertyContext, userMessage: string) {
  const basePlan = buildWebSearchPlan(context, userMessage);
  const broadenedQuery = `${context.propertyAddress} ${userMessage}`.trim();
  const includeDomains = basePlan.includeDomains;

  return {
    query: broadenedQuery,
    includeDomains,
  };
}

async function runModelAnswer(params: {
  context: PropertyContext;
  userMessage: string;
  history: ChatHistory[];
  webSearchResults: WebSearchResult[];
  secondPass?: boolean;
  language: SupportedQaLanguage;
}) {
  const sourceCatalog = buildSourceCatalog(params.context, params.webSearchResults);
  const systemPrompt = buildSystemPrompt({
    context: params.context,
    webSearchResults: params.webSearchResults,
    sourceCatalog,
    secondPass: params.secondPass,
    visitorLanguage: params.language,
  });

  const messages = [
    { role: "system" as const, content: systemPrompt },
    ...params.history.map((h) => ({
      role: h.role as "user" | "assistant",
      content: h.content,
    })),
    { role: "user" as const, content: params.userMessage },
  ];

  const result = await chatCompletion({
    messages,
    maxTokens: 520,
    temperature: 0.4,
    responseFormat: "json",
  });

  const parsed = parseModelResponse(result.content);
  const sourceKeys =
    parsed.sourceKeys && parsed.sourceKeys.length > 0
      ? Array.from(new Set(parsed.sourceKeys))
      : deriveFallbackSourceKeys(params.userMessage, sourceCatalog);
  const answerQuality = normalizeAnswerQuality(parsed, sourceKeys);
  const suggestedPrompts = normalizeSuggestedPrompts(
    parsed.followUpQuestions,
    buildPropertyQaRecoveryQuestions(
      {
        propertyAddress: params.context.propertyAddress,
        listPrice: params.context.listPrice,
        propertyDescription: params.context.propertyDescription,
        bedrooms: params.context.bedrooms,
        bathrooms: params.context.bathrooms,
        sqft: params.context.sqft,
        yearBuilt: params.context.yearBuilt,
        aiQaContext: {
          customFaq: params.context.customFaq,
          mlsData: params.context.mlsData,
          propertyFacts: params.context.propertyFacts as EventPropertyFacts | undefined,
          nearbyPoi: params.context.nearbyPoi,
          agentNotes: params.context.agentNotes ?? undefined,
        },
      },
      params.userMessage,
      params.language
    )
  );

  const sources = sourceKeys
    .map((key) => sourceCatalog.find((item) => item.key === key))
    .filter((item): item is SourceCatalogEntry => Boolean(item))
    .map((item) => ({
      key: item.key,
      label: item.label,
      kind: item.kind,
      url: item.url,
      note: item.note,
    }));

  return {
    parsed,
    answerQuality,
    suggestedPrompts,
    reply:
      parsed.answer ||
      getQaUiCopy(params.language).fallbackReply,
    sources,
    tokensUsed: result.tokensUsed,
  };
}

export async function chatWithProperty(
  context: PropertyContext,
  userMessage: string,
  history: ChatHistory[] = []
): Promise<{
  reply: string;
  tokensUsed: number;
  sources: PropertyQaSource[];
  suggestedPrompts: string[];
  answerQuality: AnswerQuality;
  usedWebSearch: boolean;
  language: SupportedQaLanguage;
}> {
  const conversationLanguage = detectPreferredQaLanguage({
    text: [...history.filter((item) => item.role === "user").map((item) => item.content), userMessage]
      .filter(Boolean)
      .join("\n"),
  });
  let webSearchResults: WebSearchResult[] = [];

  if (shouldUseWebSearch(userMessage, context)) {
    const webSearchPlan = buildWebSearchPlan(context, userMessage);
    try {
      webSearchResults = await searchPublicWeb(webSearchPlan.query, {
        includeDomains: webSearchPlan.includeDomains,
      });
    } catch {
      webSearchResults = [];
    }
  }

  let attempt = await runModelAnswer({
    context,
    userMessage,
    history,
    webSearchResults,
    language: conversationLanguage,
  });

  let totalTokens = attempt.tokensUsed;

  if (hasWebSearchConfiguration() && shouldRetryWithBroaderSearch(attempt.parsed, attempt.sources.map((item) => item.key), webSearchResults)) {
    const recoveryPlan = buildRecoveryWebSearchPlan(context, userMessage);

    try {
      const recoverySearchResults = await searchPublicWeb(recoveryPlan.query, {
        includeDomains: recoveryPlan.includeDomains,
      });
      webSearchResults = mergeWebSearchResults(webSearchResults, recoverySearchResults);
    } catch {}

    if (webSearchResults.length > 0) {
      const recoveryAttempt = await runModelAnswer({
        context,
        userMessage,
        history,
        webSearchResults,
        secondPass: true,
        language: conversationLanguage,
      });

      totalTokens += recoveryAttempt.tokensUsed;
      attempt = recoveryAttempt;
    }
  }

  return {
    reply: attempt.reply,
    tokensUsed: totalTokens,
    sources: attempt.sources,
    suggestedPrompts: attempt.suggestedPrompts,
    answerQuality: attempt.answerQuality,
    usedWebSearch: attempt.sources.some((source) => source.kind === "public_web"),
    language: conversationLanguage,
  };
}
