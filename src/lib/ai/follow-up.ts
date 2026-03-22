/**
 * AI Follow-Up Email Generator
 * 
 * Generates personalized follow-up emails based on visitor data,
 * lead score, and visit intent.
 */
import { chatCompletion } from "./openai";
import type { LeadScore } from "./lead-scoring";

interface FollowUpContext {
    agentName: string;
    propertyAddress: string;
    propertyType?: string | null;
    listPrice?: string | null;
    visitorName: string;
    visitorEmail?: string | null;
    interestLevel?: string | null;
    buyingTimeline?: string | null;
    hasAgent?: boolean;
    isPreApproved?: string | null;
    leadScore?: LeadScore | null;
    behavior?: {
        userMessageCount?: number;
        sessionCount?: number;
        questionCategories?: string[];
        actionIntents?: string[];
        recentQuestionHighlights?: string[];
        followUpLikelihood?: string;
    } | null;
}

function getFirstName(value: string) {
    const first = value.trim().split(/\s+/)[0];
    return first || "there";
}

function humanizeList(items: string[]) {
    if (items.length === 0) return "";
    if (items.length === 1) return items[0];
    if (items.length === 2) return `${items[0]} and ${items[1]}`;
    return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

function humanizeTopic(topic: string) {
    return topic.replaceAll("_", " ");
}

function buildPreferredCta(context: FollowUpContext) {
    const intents = new Set(context.behavior?.actionIntents ?? []);

    if (intents.has("schedule_showing")) {
        return "offer a private showing or a short call to compare next-step options";
    }

    if (intents.has("ready_to_offer")) {
        return "offer to walk through offer timing, disclosures, and the cleanest next step";
    }

    if (intents.has("ask_for_disclosures")) {
        return "offer to send disclosures and answer anything they want clarified";
    }

    if (context.isPreApproved === "yes") {
        return "invite them to talk through timing for a showing or offer strategy";
    }

    return "invite them to reply with questions or book the next conversation";
}

function buildDeterministicFallback(context: FollowUpContext) {
    const firstName = getFirstName(context.visitorName);
    const topicSummary = humanizeList(
        (context.behavior?.questionCategories ?? []).slice(0, 2).map(humanizeTopic)
    );
    const intentSummary = humanizeList(
        (context.behavior?.actionIntents ?? []).slice(0, 2).map(humanizeTopic)
    );

    const recentQuestion = context.behavior?.recentQuestionHighlights?.[0];
    const preferredCta = buildPreferredCta(context);

    const lines = [
        `Hi ${firstName},`,
        `Thanks again for visiting ${context.propertyAddress}.`,
        recentQuestion
            ? `I kept thinking about your question on "${recentQuestion}" and wanted to make sure you have a clear next step if the home is still on your radar.`
            : topicSummary
                ? `I noted your questions about ${topicSummary}, and I would be happy to send anything else that would help you evaluate the home with confidence.`
                : `I would be happy to send anything else that helps you evaluate the home with confidence.`,
        context.isPreApproved === "yes"
            ? `Since you are already pre-approved, I can ${preferredCta}.`
            : null,
        intentSummary
            ? `You also seemed focused on ${intentSummary}. If useful, I can ${preferredCta}.`
            : `If useful, I can ${preferredCta}.`,
        `Best,\n${context.agentName}`,
    ].filter(Boolean);

    return {
        subject: `Thanks for visiting ${context.propertyAddress}`,
        body: lines.join("\n\n"),
    };
}

/**
 * Generate a personalized follow-up email for a visitor.
 */
export async function generateFollowUpEmail(
    context: FollowUpContext
): Promise<{ subject: string; body: string; tokensUsed: number }> {
    const tierStrategy: Record<string, string> = {
        hot: "Urgent, personalized, mention their specific interest signals. Create urgency. Suggest a private showing or next steps. Be warm and professional.",
        warm: "Friendly and informative. Include property highlights that match their interests. Suggest staying in touch and offer to help with their search.",
        cold: "Casual and low-pressure. Thank them for visiting. Offer to be a resource if they decide to buy. Include your contact info.",
    };

    const tier = context.leadScore?.tier || "warm";
    const preferredCta = buildPreferredCta(context);

    const behavior = context.behavior;
    let visitorProfile = `- Name: ${context.visitorName}
- Interest Level: ${context.interestLevel || "Unknown"}
- Buying Timeline: ${context.buyingTimeline || "Unknown"}
- Has Agent: ${context.hasAgent ? "Yes" : "No"}
- Pre-Approved: ${context.isPreApproved || "Unknown"}`;

    if (context.leadScore) {
        visitorProfile += `\n- Lead Score: ${context.leadScore.overallScore}/100 (${tier})`;
    }

    if (behavior) {
        visitorProfile += `\n- Q&A Messages: ${behavior.userMessageCount ?? 0}`;
        visitorProfile += `\n- Return Visits: ${behavior.sessionCount ?? 0}`;
        visitorProfile += `\n- Follow-Up Likelihood: ${behavior.followUpLikelihood || "Unknown"}`;

        if (behavior.questionCategories && behavior.questionCategories.length > 0) {
            visitorProfile += `\n- Asked About: ${behavior.questionCategories
                .map(humanizeTopic)
                .join(", ")}`;
        }

        if (behavior.actionIntents && behavior.actionIntents.length > 0) {
            visitorProfile += `\n- Action Signals: ${behavior.actionIntents
                .map(humanizeTopic)
                .join(", ")}`;
        }

        if (behavior.recentQuestionHighlights && behavior.recentQuestionHighlights.length > 0) {
            visitorProfile += `\n- Recent Questions:\n${behavior.recentQuestionHighlights
                .slice(0, 3)
                .map((item) => `  - ${item}`)
                .join("\n")}`;
        }
    }

    const prompt = `You are writing a follow-up email from a real estate agent after an Open House visit.

## Agent Info
- Agent Name: ${context.agentName}
- Property: ${context.propertyAddress}
${context.propertyType ? `- Property Type: ${context.propertyType}` : ""}
${context.listPrice ? `- List Price: $${Number(context.listPrice).toLocaleString()}` : ""}

## Visitor Profile
${visitorProfile}

## Strategy (${tier} lead)
${tierStrategy[tier]}

## Rules
- Write a complete email body, never an outline
- Keep the email under 150 words
- Sound like a real listing agent following up with one real prospect after an open house
- Be warm, specific, lightly sales-oriented, and never robotic
- Do not dump data points or restate the entire form
- Personalize the email to the visitor's actual interest signals and Q&A topics
- Mention at most one or two concrete things they asked about when available
- Include one clear sales CTA: ${preferredCta}
- Sign off with the agent's name
- DO NOT use generic phrases like "I hope this email finds you well"
- DO NOT fabricate facts you do not have
- DO NOT write bullet lists
- DO NOT sound like a CRM template

Respond in JSON format:
{
  "subject": "Email subject line",
  "body": "Full email body text"
}`;

    const result = await chatCompletion({
        messages: [{ role: "user", content: prompt }],
        maxTokens: 500,
        temperature: 0.8,
        responseFormat: "json",
    });

    try {
        const parsed = JSON.parse(result.content);
        const fallback = buildDeterministicFallback(context);
        return {
            subject: parsed.subject || fallback.subject,
            body:
                typeof parsed.body === "string" && parsed.body.trim().length > 0
                    ? parsed.body.trim()
                    : fallback.body,
            tokensUsed: result.tokensUsed,
        };
    } catch {
        const fallback = buildDeterministicFallback(context);
        return {
            subject: fallback.subject,
            body: result.content?.trim() || fallback.body,
            tokensUsed: result.tokensUsed,
        };
    }
}
