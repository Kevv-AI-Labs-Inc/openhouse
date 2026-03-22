/**
 * AI Lead Scoring Service
 *
 * Principle:
 * - Intake fields are useful, but observed behavior should outweigh self-reported answers.
 * - Property Q&A engagement is a high-signal proxy for seriousness, diligence, and follow-up priority.
 */

export interface SignInData {
  fullName: string;
  phone?: string | null;
  email?: string | null;
  hasAgent?: boolean;
  isPreApproved?: string | null;
  interestLevel?: string | null;
  buyingTimeline?: string | null;
  priceRange?: string | null;
  customAnswers?: Record<string, string> | null;
  signedInAt?: Date | string | null;
}

export interface ConversationSignalInput {
  role: "user" | "assistant" | "system";
  content: string;
  sessionId: string;
  createdAt?: Date | string | null;
}

export interface LeadBehaviorSignals {
  userMessageCount: number;
  assistantMessageCount: number;
  totalTurns: number;
  sessionCount: number;
  totalUserCharacters: number;
  avgUserMessageLength: number;
  questionCategories: string[];
  questionCategoryCounts: Record<string, number>;
  actionIntents: string[];
  actionIntentCounts: Record<string, number>;
  diligenceScore: number;
  strongIntent: boolean;
  followUpLikelihood: "low" | "medium" | "high";
  recentQuestionHighlights: string[];
}

export interface LeadScore {
  overallScore: number; // 0-100
  buyReadiness: number; // 0-25
  financialStrength: number; // 0-25
  engagementLevel: number; // 0-25
  urgency: number; // 0-25
  tier: "hot" | "warm" | "cold";
  signals: Record<string, unknown>;
  recommendation: string;
}

const CATEGORY_RULES = [
  {
    key: "pricing_fees",
    label: "pricing and monthly costs",
    patterns: [
      /\bprice\b/i,
      /\basking\b/i,
      /\btax(es)?\b/i,
      /\bhoa\b/i,
      /\bmaintenance\b/i,
      /\bcommon charges?\b/i,
      /\bmonthly\b/i,
      /\bassessment\b/i,
      /\bflip tax\b/i,
      /\babatement\b/i,
      /\butilities?\b/i,
    ],
  },
  {
    key: "showing_next_steps",
    label: "showing and next steps",
    patterns: [
      /\bshow(ing)?\b/i,
      /\btour\b/i,
      /\bvisit\b/i,
      /\bsee it\b/i,
      /\bcome by\b/i,
      /\bnext steps?\b/i,
      /\bavailable\b/i,
      /\bschedule\b/i,
      /\bappointment\b/i,
    ],
  },
  {
    key: "offer_financing",
    label: "offer and financing",
    patterns: [
      /\boffer\b/i,
      /\bclosing\b/i,
      /\bdeposit\b/i,
      /\bmortgage\b/i,
      /\bloan\b/i,
      /\bpre-?approval\b/i,
      /\bfinance|financing\b/i,
      /\bcash\b/i,
      /\bqualif(y|ied)\b/i,
    ],
  },
  {
    key: "building_rules",
    label: "building rules and constraints",
    patterns: [
      /\bpet(s)?\b/i,
      /\bsublet\b/i,
      /\bpied[- ]a[- ]terre\b/i,
      /\brental\b/i,
      /\bboard\b/i,
      /\bapplication\b/i,
      /\bapproval\b/i,
      /\bdoorman\b/i,
      /\belevator\b/i,
      /\bcondo\b/i,
      /\bco-op\b/i,
    ],
  },
  {
    key: "layout_condition",
    label: "layout and condition",
    patterns: [
      /\bbed(room)?s?\b/i,
      /\bbath(room)?s?\b/i,
      /\bsq\.?\s?ft\b/i,
      /\bsquare feet\b/i,
      /\blayout\b/i,
      /\brenovat(ed|ion)\b/i,
      /\bcondition\b/i,
      /\bkitchen\b/i,
      /\blaundry\b/i,
      /\bparking\b/i,
      /\boutdoor\b/i,
      /\brooftop\b/i,
      /\bstorage\b/i,
    ],
  },
  {
    key: "schools_neighborhood",
    label: "schools and neighborhood",
    patterns: [
      /\bschool\b/i,
      /\bdistrict\b/i,
      /\bnearby\b/i,
      /\bneighborhood\b/i,
      /\bcommute\b/i,
      /\bsubway\b/i,
      /\btrain\b/i,
      /\btransit\b/i,
      /\brestaurants?\b/i,
      /\bgrocery\b/i,
      /\bpark\b/i,
    ],
  },
] as const;

const ACTION_RULES = [
  {
    key: "schedule_showing",
    patterns: [/\bschedule\b/i, /\bshow(ing)?\b/i, /\btour\b/i, /\bsee it\b/i, /\bvisit\b/i],
  },
  {
    key: "ask_for_disclosures",
    patterns: [/\bdisclosure\b/i, /\bfinancials?\b/i, /\boffer sheet\b/i, /\bapplication package\b/i],
  },
  {
    key: "ready_to_offer",
    patterns: [/\boffer\b/i, /\bsubmit\b/i, /\bmove forward\b/i, /\bnext steps\b/i, /\bserious\b/i],
  },
  {
    key: "wants_agent_follow_up",
    patterns: [/\bcall me\b/i, /\btext me\b/i, /\breach out\b/i, /\bfollow up\b/i, /\bcontact me\b/i],
  },
] as const;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}

function getTier(overallScore: number): LeadScore["tier"] {
  if (overallScore >= 72) return "hot";
  if (overallScore >= 42) return "warm";
  return "cold";
}

function buildRecommendation(score: Omit<LeadScore, "signals" | "recommendation">, behavior: LeadBehaviorSignals) {
  if (score.tier === "hot") {
    if (behavior.actionIntents.includes("schedule_showing") || behavior.actionIntents.includes("ready_to_offer")) {
      return "Fast-track this lead. Reach out within 15 minutes, reference their property questions, and offer a private tour or offer guidance right away.";
    }
    return "High-priority lead. Follow up the same day with answers to their key questions and a clear next step such as a private showing or financing conversation.";
  }

  if (score.tier === "warm") {
    if (behavior.userMessageCount > 0) {
      return "Engaged lead with meaningful research behavior. Follow up within 24 hours and mirror the topics they asked about to move them toward a showing or financing decision.";
    }
    return "Promising lead. Send a same-day follow-up that acknowledges their visit and invites a concrete next step.";
  }

  return "Lower-priority lead for now. Add to a nurture sequence, keep the listing link handy, and watch for renewed Q&A activity before investing manual follow-up time.";
}

export function analyzeConversationBehavior(
  conversations: ConversationSignalInput[]
): LeadBehaviorSignals {
  const userMessages = conversations.filter(
    (item) => item.role === "user" && typeof item.content === "string" && item.content.trim().length > 0
  );
  const assistantMessages = conversations.filter((item) => item.role === "assistant");
  const sessionIds = new Set(userMessages.map((item) => item.sessionId).filter(Boolean));
  const questionCategoryCounts: Record<string, number> = {};
  const actionIntentCounts: Record<string, number> = {};
  const recentQuestionHighlights: string[] = [];

  for (const message of userMessages) {
    const normalized = message.content.trim();
    if (!normalized) continue;

    if (recentQuestionHighlights.length < 4) {
      recentQuestionHighlights.push(normalized.slice(0, 180));
    }

    for (const category of CATEGORY_RULES) {
      if (category.patterns.some((pattern) => pattern.test(normalized))) {
        questionCategoryCounts[category.key] = (questionCategoryCounts[category.key] ?? 0) + 1;
      }
    }

    for (const actionRule of ACTION_RULES) {
      if (actionRule.patterns.some((pattern) => pattern.test(normalized))) {
        actionIntentCounts[actionRule.key] = (actionIntentCounts[actionRule.key] ?? 0) + 1;
      }
    }
  }

  const questionCategories = Object.keys(questionCategoryCounts);
  const actionIntents = Object.keys(actionIntentCounts);
  const totalUserCharacters = userMessages.reduce((sum, item) => sum + item.content.trim().length, 0);
  const avgUserMessageLength =
    userMessages.length > 0 ? totalUserCharacters / userMessages.length : 0;
  const diligenceScore = clamp(
    questionCategories.length * 3 +
      Math.min(6, userMessages.length * 1.5) +
      (avgUserMessageLength >= 90 ? 4 : avgUserMessageLength >= 45 ? 2 : 0),
    0,
    15
  );
  const strongIntent =
    actionIntents.includes("schedule_showing") ||
    actionIntents.includes("ready_to_offer") ||
    (userMessages.length >= 3 && questionCategories.length >= 2);

  let followUpLikelihood: LeadBehaviorSignals["followUpLikelihood"] = "low";
  if (strongIntent || userMessages.length >= 4 || sessionIds.size >= 2) {
    followUpLikelihood = "high";
  } else if (userMessages.length >= 2 || questionCategories.length >= 2) {
    followUpLikelihood = "medium";
  }

  return {
    userMessageCount: userMessages.length,
    assistantMessageCount: assistantMessages.length,
    totalTurns: userMessages.length + assistantMessages.length,
    sessionCount: sessionIds.size || (userMessages.length > 0 ? 1 : 0),
    totalUserCharacters,
    avgUserMessageLength: round(avgUserMessageLength),
    questionCategories,
    questionCategoryCounts,
    actionIntents,
    actionIntentCounts,
    diligenceScore,
    strongIntent,
    followUpLikelihood,
    recentQuestionHighlights,
  };
}

export function calculateRuleBasedScore(
  data: SignInData,
  behavior?: LeadBehaviorSignals
): LeadScore {
  const activeBehavior =
    behavior ??
    analyzeConversationBehavior([]);

  let buyReadiness = 0;
  let financialStrength = 0;
  let engagementLevel = 0;
  let urgency = 0;
  const signals: Record<string, unknown> = {
    intake: {
      hasAgent: data.hasAgent ?? false,
      isPreApproved: data.isPreApproved ?? null,
      interestLevel: data.interestLevel ?? null,
      buyingTimeline: data.buyingTimeline ?? null,
    },
    behavior: activeBehavior,
  };

  // Buy readiness is now primarily behavior-driven.
  if (!data.hasAgent) {
    buyReadiness += 4;
    signals.noAgent = true;
  }
  if (data.isPreApproved === "yes") {
    buyReadiness += 5;
    signals.preApproved = true;
  } else if (data.isPreApproved === "not_yet") {
    buyReadiness += 2;
  }
  if (activeBehavior.strongIntent) {
    buyReadiness += 8;
  }
  if (activeBehavior.actionIntents.includes("schedule_showing")) {
    buyReadiness += 5;
  }
  if (activeBehavior.actionIntents.includes("ready_to_offer")) {
    buyReadiness += 5;
  }
  if (activeBehavior.questionCategories.length >= 2) {
    buyReadiness += 3;
  }
  buyReadiness = clamp(buyReadiness, 0, 25);

  // Financial strength still uses intake, but diligence around fees/taxes/financing matters.
  if (data.isPreApproved === "yes") {
    financialStrength += 12;
  } else if (data.isPreApproved === "not_yet") {
    financialStrength += 4;
  }
  if (data.priceRange) {
    financialStrength += 3;
    signals.priceRange = data.priceRange;
  }
  if (data.email && data.phone) {
    financialStrength += 4;
    signals.fullContact = true;
  }
  if (activeBehavior.questionCategoryCounts.pricing_fees) {
    financialStrength += 4;
  }
  if (activeBehavior.actionIntentCounts.ask_for_disclosures) {
    financialStrength += 2;
  }
  if (activeBehavior.actionIntentCounts.ready_to_offer) {
    financialStrength += 3;
  }
  financialStrength = clamp(financialStrength, 0, 25);

  // Engagement is heavily behavior-based.
  if (activeBehavior.userMessageCount >= 6) {
    engagementLevel += 14;
  } else if (activeBehavior.userMessageCount >= 3) {
    engagementLevel += 10;
  } else if (activeBehavior.userMessageCount >= 1) {
    engagementLevel += 6;
  }
  if (activeBehavior.sessionCount >= 2) {
    engagementLevel += 5;
    signals.returnVisitor = true;
  }
  if (activeBehavior.avgUserMessageLength >= 120) {
    engagementLevel += 4;
  } else if (activeBehavior.avgUserMessageLength >= 60) {
    engagementLevel += 2;
  }
  if (activeBehavior.questionCategories.length >= 3) {
    engagementLevel += 4;
  } else if (activeBehavior.questionCategories.length >= 1) {
    engagementLevel += 2;
  }
  if (data.interestLevel === "very") {
    engagementLevel += 2;
    signals.veryInterested = true;
  } else if (data.interestLevel === "somewhat") {
    engagementLevel += 1;
  }
  if (data.customAnswers && Object.keys(data.customAnswers).length > 0) {
    engagementLevel += Math.min(2, Object.keys(data.customAnswers).length);
    signals.customAnswersFilled = Object.keys(data.customAnswers).length;
  }
  engagementLevel = clamp(engagementLevel, 0, 25);

  // Urgency blends timeline with action-oriented behavior.
  switch (data.buyingTimeline) {
    case "0_3_months":
      urgency += 9;
      signals.urgentBuyer = true;
      break;
    case "3_6_months":
      urgency += 6;
      break;
    case "6_12_months":
      urgency += 3;
      break;
    case "over_12_months":
      urgency += 1;
      break;
    default:
      break;
  }
  if (activeBehavior.actionIntentCounts.schedule_showing) urgency += 8;
  if (activeBehavior.actionIntentCounts.ready_to_offer) urgency += 8;
  if (activeBehavior.followUpLikelihood === "high") urgency += 4;
  else if (activeBehavior.followUpLikelihood === "medium") urgency += 2;
  urgency = clamp(urgency, 0, 25);

  const overallScore = clamp(
    Math.round(buyReadiness + financialStrength + engagementLevel + urgency),
    0,
    100
  );
  const tier = getTier(overallScore);

  return {
    overallScore,
    buyReadiness,
    financialStrength,
    engagementLevel,
    urgency,
    tier,
    signals,
    recommendation: buildRecommendation(
      {
        overallScore,
        buyReadiness,
        financialStrength,
        engagementLevel,
        urgency,
        tier,
      },
      activeBehavior
    ),
  };
}

function formatBehaviorSummary(behavior: LeadBehaviorSignals) {
  const categoryLabels = CATEGORY_RULES.filter((item) =>
    behavior.questionCategories.includes(item.key)
  ).map((item) => item.label);

  return `## Observed Behavior Signals
- User Q&A messages: ${behavior.userMessageCount}
- Total Q&A sessions: ${behavior.sessionCount}
- Avg user message length: ${behavior.avgUserMessageLength} chars
- Question themes: ${categoryLabels.join(", ") || "none yet"}
- Action intents: ${behavior.actionIntents.join(", ") || "none yet"}
- Follow-up likelihood: ${behavior.followUpLikelihood}
- Strong intent observed: ${behavior.strongIntent ? "Yes" : "No"}
- Recent question highlights:
${behavior.recentQuestionHighlights.length > 0 ? behavior.recentQuestionHighlights.map((item) => `  - ${item}`).join("\n") : "  - No Q&A behavior yet"}`;
}

/**
 * GPT scoring prompt. Observed Q&A behavior should outweigh self-reported intake fields.
 */
export function buildGptScoringPrompt(
  signInData: SignInData,
  ruleScore: LeadScore,
  behavior: LeadBehaviorSignals
): string {
  return `You are scoring an open house lead for a listing agent.

Prioritize observed behavior over self-reported intake fields.
If the buyer asked thoughtful, specific, or action-oriented questions, score them more aggressively than a passive form fill.
Do not hallucinate facts that are not present.

## Visitor Intake
- Name: ${signInData.fullName}
- Has Agent: ${signInData.hasAgent ? "Yes" : "No"}
- Pre-Approved: ${signInData.isPreApproved || "Unknown"}
- Interest Level: ${signInData.interestLevel || "Unknown"}
- Buying Timeline: ${signInData.buyingTimeline || "Unknown"}
- Price Range: ${signInData.priceRange || "Not specified"}
- Phone: ${signInData.phone ? "Provided" : "Not provided"}
- Email: ${signInData.email ? "Provided" : "Not provided"}

${formatBehaviorSummary(behavior)}

## Rule-Based Score Snapshot
- Overall: ${ruleScore.overallScore}/100
- Buy Readiness: ${ruleScore.buyReadiness}/25
- Financial Strength: ${ruleScore.financialStrength}/25
- Engagement: ${ruleScore.engagementLevel}/25
- Urgency: ${ruleScore.urgency}/25
- Current Tier: ${ruleScore.tier}

## Your Task
Return a refined lead assessment that reflects the behavioral signals above.
Favor repeated, specific, or action-oriented Q&A behavior over generic form answers.

Respond in JSON:
{
  "adjustedScore": number,
  "adjustedTier": "hot" | "warm" | "cold",
  "recommendation": "string",
  "keySignals": ["string"]
}`;
}

export function mergeGptScore(
  ruleScore: LeadScore,
  gptResponse: {
    adjustedScore?: number;
    adjustedTier?: string;
    recommendation?: string;
    keySignals?: string[];
  }
): LeadScore {
  const overallScore = clamp(
    Number.isFinite(gptResponse.adjustedScore) ? Number(gptResponse.adjustedScore) : ruleScore.overallScore,
    0,
    100
  );
  const tier =
    gptResponse.adjustedTier === "hot" ||
    gptResponse.adjustedTier === "warm" ||
    gptResponse.adjustedTier === "cold"
      ? gptResponse.adjustedTier
      : getTier(overallScore);

  return {
    ...ruleScore,
    overallScore,
    tier,
    recommendation: gptResponse.recommendation ?? ruleScore.recommendation,
    signals: {
      ...ruleScore.signals,
      gptSignals: gptResponse.keySignals || [],
      gptEnhanced: true,
    },
  };
}

export function shouldRunGptLeadScoring(
  behavior: LeadBehaviorSignals,
  trigger: "sign_in" | "chat" | "manual"
) {
  if (trigger === "manual") return true;
  if (trigger === "sign_in") return true;

  return (
    behavior.strongIntent ||
    behavior.userMessageCount === 2 ||
    behavior.userMessageCount === 4 ||
    behavior.userMessageCount >= 6
  );
}
