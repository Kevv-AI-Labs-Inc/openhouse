/**
 * OpenHouse Pro — Database Schema
 * 
 * Core tables: users, events, sign-ins, AI conversations, lenders, partnerships.
 * Compatible with Kevv CRM integration via kevvAgentId/kevvCompanyId foreign keys.
 */
import {
    mysqlTable,
    int,
    varchar,
    text,
    boolean,
    timestamp,
    mysqlEnum,
    decimal,
    json,
    index,
    uniqueIndex,
    tinyint,
    smallint,
} from "drizzle-orm/mysql-core";
/** Inline type — was in property-qa-shared.ts */
export type PropertyQaSource = {
  key: string;
  label: string;
  kind: "listing" | "agent" | "public_web";
  url?: string;
  note?: string;
};

// ==================== USERS ====================

export const users = mysqlTable("oh_users", {
    id: int("id").autoincrement().primaryKey(),
    email: varchar("email", { length: 320 }).notNull().unique(),
    googleId: varchar("googleId", { length: 128 }),
    microsoftEntraId: varchar("microsoftEntraId", { length: 128 }),
    gmailRefreshTokenEncrypted: text("gmailRefreshTokenEncrypted"),
    gmailSendAsEmail: varchar("gmailSendAsEmail", { length: 320 }),
    gmailSendingEnabled: boolean("gmailSendingEnabled").default(false).notNull(),
    gmailConnectedAt: timestamp("gmailConnectedAt"),
    gmailLastSendError: text("gmailLastSendError"),
    microsoftRefreshTokenEncrypted: text("microsoftRefreshTokenEncrypted"),
    microsoftSendAsEmail: varchar("microsoftSendAsEmail", { length: 320 }),
    microsoftSendingEnabled: boolean("microsoftSendingEnabled").default(false).notNull(),
    microsoftConnectedAt: timestamp("microsoftConnectedAt"),
    microsoftLastSendError: text("microsoftLastSendError"),
    followUpEmailMode: mysqlEnum("followUpEmailMode", [
        "draft",
        "google",
        "microsoft",
        "custom_domain",
    ])
        .default("draft")
        .notNull(),
    customSendingDomain: varchar("customSendingDomain", { length: 255 }),
    customSendingDomainId: varchar("customSendingDomainId", { length: 128 }),
    customSendingDomainStatus: mysqlEnum("customSendingDomainStatus", [
        "not_started",
        "pending",
        "verified",
        "failed",
    ])
        .default("not_started")
        .notNull(),
    customSendingFromEmail: varchar("customSendingFromEmail", { length: 320 }),
    customSendingFromName: varchar("customSendingFromName", { length: 200 }),
    customSendingReplyToEmail: varchar("customSendingReplyToEmail", { length: 320 }),
    customSendingLastError: text("customSendingLastError"),

    // Agent Profile
    fullName: varchar("fullName", { length: 200 }).notNull(),
    phone: varchar("phone", { length: 20 }),
    avatarUrl: text("avatarUrl"),
    licenseNumber: varchar("licenseNumber", { length: 50 }),
    brokerageName: varchar("brokerageName", { length: 200 }),

    // Branding Defaults
    defaultBranding: json("defaultBranding").$type<{
        logoUrl?: string;
        primaryColor?: string;
        tagline?: string;
    }>(),

    // Subscription
    subscriptionTier: mysqlEnum("subscriptionTier", [
        "free",
        "pro",
    ])
        .default("free")
        .notNull(),
    stripeCustomerId: varchar("stripeCustomerId", { length: 128 }),
    stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 128 }),
    proTrialLaunchesUsed: int("proTrialLaunchesUsed").default(0).notNull(),

    // Usage Limits (monthly, reset on billing cycle)
    pdlCreditsUsed: int("pdlCreditsUsed").default(0).notNull(),
    pdlCreditsLimit: int("pdlCreditsLimit").default(0).notNull(), // 0 = free tier
    aiQueriesUsed: int("aiQueriesUsed").default(0).notNull(),
    aiQueriesLimit: int("aiQueriesLimit").default(0).notNull(),
    usageResetAt: timestamp("usageResetAt"),

    // Kevv CRM integration
    kevvAgentId: int("kevvAgentId"),
    kevvCompanyId: int("kevvCompanyId"),

    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const magicLinks = mysqlTable(
    "oh_magic_links",
    {
        id: int("id").autoincrement().primaryKey(),
        email: varchar("email", { length: 320 }).notNull(),
        tokenHash: varchar("tokenHash", { length: 128 }).notNull().unique(),
        redirectPath: text("redirectPath").notNull(),
        expiresAt: timestamp("expiresAt").notNull(),
        createdAt: timestamp("createdAt").defaultNow().notNull(),
    },
    (table) => [
        index("idx_oh_magic_links_email").on(table.email),
        index("idx_oh_magic_links_expiresAt").on(table.expiresAt),
    ]
);

// ==================== OPEN HOUSE EVENTS ====================

export const events = mysqlTable(
    "oh_events",
    {
        id: int("id").autoincrement().primaryKey(),
        uuid: varchar("uuid", { length: 36 }).notNull().unique(),
        userId: int("userId").notNull(),

        // Property Info
        propertyAddress: text("propertyAddress").notNull(),
        mlsNumber: varchar("mlsNumber", { length: 50 }),
        listPrice: decimal("listPrice", { precision: 15, scale: 2 }),
        propertyType: mysqlEnum("propertyType", [
            "single_family",
            "condo",
            "townhouse",
            "multi_family",
            "land",
            "other",
        ]),
        bedrooms: tinyint("bedrooms"),
        bathrooms: decimal("bathrooms", { precision: 3, scale: 1 }),
        sqft: int("sqft"),
        yearBuilt: smallint("yearBuilt"),
        propertyPhotos: json("propertyPhotos").$type<string[]>(),
        propertyDescription: text("propertyDescription"),

        // Event Info
        startTime: timestamp("startTime").notNull(),
        endTime: timestamp("endTime").notNull(),
        publicMode: mysqlEnum("publicMode", ["open_house", "listing_inquiry"])
            .default("open_house")
            .notNull(),
        featureAccessTier: mysqlEnum("featureAccessTier", ["free", "trial_pro", "pro"])
            .default("free")
            .notNull(),
        proTrialActivatedAt: timestamp("proTrialActivatedAt"),
        proTrialExpiresAt: timestamp("proTrialExpiresAt"),
        status: mysqlEnum("status", ["draft", "active", "completed", "cancelled"])
            .default("draft")
            .notNull(),

        // Customization
        customFields: json("customFields").$type<
            Array<{ label: string; type: "text" | "select"; options?: string[] }>
        >(),
        branding: json("branding").$type<{
            logoUrl?: string;
            primaryColor?: string;
            tagline?: string;
            flyerImageUrl?: string;
        }>(),
        complianceText: text("complianceText"),

        // AI Q&A Config (Pro)
        aiQaEnabled: boolean("aiQaEnabled").default(false).notNull(),
        aiQaContext: json("aiQaContext").$type<{
            customFaq?: Array<{ question: string; answer: string }>;
            mlsData?: Record<string, unknown>;
            propertyFacts?: Record<string, unknown>;
            nearbyPoi?: Record<string, unknown>;
            agentNotes?: string;
        }>(),

        // Lender Sponsorship
        sponsorLenderId: int("sponsorLenderId"),

        // Stats Cache
        totalSignIns: int("totalSignIns").default(0).notNull(),
        hotLeadsCount: int("hotLeadsCount").default(0).notNull(),

        // Kevv CRM link
        kevvAgentId: int("kevvAgentId"),
        kevvCompanyId: int("kevvCompanyId"),

        createdAt: timestamp("createdAt").defaultNow().notNull(),
        updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
    },
    (table) => [
        index("idx_oh_events_userId").on(table.userId),
        index("idx_oh_events_status").on(table.status),
        index("idx_oh_events_startTime").on(table.startTime),
        index("idx_oh_events_uuid").on(table.uuid),
    ]
);

// ==================== SIGN-INS ====================

export const signIns = mysqlTable(
    "oh_sign_ins",
    {
        id: int("id").autoincrement().primaryKey(),
        eventId: int("eventId").notNull(),

        // Basic Info
        fullName: varchar("fullName", { length: 255 }).notNull(),
        phone: varchar("phone", { length: 50 }),
        email: varchar("email", { length: 255 }),
        captureMode: mysqlEnum("captureMode", ["open_house", "listing_inquiry"]),

        // Buying Intent
        hasAgent: boolean("hasAgent").default(false),
        isPreApproved: mysqlEnum("isPreApproved", ["yes", "no", "not_yet"]).default(
            "not_yet"
        ),
        interestLevel: mysqlEnum("interestLevel", [
            "very",
            "somewhat",
            "just_looking",
        ]).default("just_looking"),
        buyingTimeline: mysqlEnum("buyingTimeline", [
            "0_3_months",
            "3_6_months",
            "6_12_months",
            "over_12_months",
            "just_browsing",
        ]),
        priceRange: varchar("priceRange", { length: 50 }),

        // Custom Answers
        customAnswers: json("customAnswers").$type<Record<string, string>>(),

        // AI Lead Scoring (Pro)
        leadScore: json("leadScore").$type<{
            overallScore: number;
            buyReadiness: number;
            financialStrength: number;
            engagementLevel: number;
            urgency: number;
            signals: Record<string, unknown>;
            recommendation: string;
            tier: "hot" | "warm" | "cold";
        }>(),
        leadTier: mysqlEnum("leadTier", ["hot", "warm", "cold"]),
        aiRecommendation: text("aiRecommendation"),

        // PDL Enrichment (Pro)
        pdlEnriched: boolean("pdlEnriched").default(false).notNull(),
        pdlData: json("pdlData").$type<Record<string, unknown>>(),
        pdlEnrichedAt: timestamp("pdlEnrichedAt"),

        // CRM Sync
        kevvContactId: int("kevvContactId"),
        crmSyncStatus: mysqlEnum("crmSyncStatus", [
            "pending",
            "synced",
            "failed",
            "skipped",
        ]).default("pending"),

        // Follow-up
        followUpSent: boolean("followUpSent").default(false).notNull(),
        followUpSentAt: timestamp("followUpSentAt"),
        followUpContent: text("followUpContent"),

        signedInAt: timestamp("signedInAt").defaultNow().notNull(),
        createdAt: timestamp("createdAt").defaultNow().notNull(),
    },
    (table) => [
        index("idx_oh_sign_ins_eventId").on(table.eventId),
        index("idx_oh_sign_ins_captureMode").on(table.captureMode),
        index("idx_oh_sign_ins_leadTier").on(table.leadTier),
        index("idx_oh_sign_ins_email").on(table.email),
        index("idx_oh_sign_ins_phone").on(table.phone),
    ]
);

// ==================== AI CONVERSATIONS ====================

export const aiConversations = mysqlTable(
    "oh_ai_conversations",
    {
        id: int("id").autoincrement().primaryKey(),
        eventId: int("eventId").notNull(),
        signInId: int("signInId"),
        sessionId: varchar("sessionId", { length: 36 }).notNull(),

        role: mysqlEnum("role", ["user", "assistant", "system"]).notNull(),
        content: text("content").notNull(),
        sources: json("sources").$type<PropertyQaSource[]>(),

        tokensUsed: int("tokensUsed"),
        model: varchar("model", { length: 64 }),

        createdAt: timestamp("createdAt").defaultNow().notNull(),
    },
    (table) => [
        index("idx_oh_ai_conv_eventId").on(table.eventId),
        index("idx_oh_ai_conv_sessionId").on(table.sessionId),
    ]
);

export const publicChatAccessGrants = mysqlTable(
    "oh_public_chat_access_grants",
    {
        id: int("id").autoincrement().primaryKey(),
        eventId: int("eventId").notNull(),
        signInId: int("signInId").notNull(),
        tokenHash: varchar("tokenHash", { length: 128 }).notNull().unique(),
        expiresAt: timestamp("expiresAt").notNull(),
        lastUsedAt: timestamp("lastUsedAt"),
        createdAt: timestamp("createdAt").defaultNow().notNull(),
    },
    (table) => [
        index("idx_oh_public_chat_access_eventId").on(table.eventId),
        index("idx_oh_public_chat_access_signInId").on(table.signInId),
        index("idx_oh_public_chat_access_expiresAt").on(table.expiresAt),
    ]
);

export const rateLimitWindows = mysqlTable(
    "oh_rate_limit_windows",
    {
        keyHash: varchar("keyHash", { length: 64 }).primaryKey(),
        scope: varchar("scope", { length: 64 }).notNull(),
        hitCount: int("hitCount").default(0).notNull(),
        resetAt: timestamp("resetAt").notNull(),
        createdAt: timestamp("createdAt").defaultNow().notNull(),
        updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
    },
    (table) => [
        index("idx_oh_rate_limit_windows_resetAt").on(table.resetAt),
        index("idx_oh_rate_limit_windows_updatedAt").on(table.updatedAt),
    ]
);

// ==================== PUBLIC FUNNEL EVENTS ====================

export const publicFunnelEvents = mysqlTable(
    "oh_public_funnel_events",
    {
        id: int("id").autoincrement().primaryKey(),
        eventId: int("eventId").notNull(),
        visitorId: varchar("visitorId", { length: 64 }).notNull(),
        stage: mysqlEnum("stage", ["page_view", "form_start"]).notNull(),
        createdAt: timestamp("createdAt").defaultNow().notNull(),
    },
    (table) => [
        index("idx_oh_public_funnel_eventId").on(table.eventId),
        index("idx_oh_public_funnel_stage").on(table.stage),
        uniqueIndex("uniq_oh_public_funnel_stage").on(table.eventId, table.visitorId, table.stage),
    ]
);

// ==================== PDL CACHE ====================

export const pdlCache = mysqlTable(
    "oh_pdl_cache",
    {
        id: int("id").autoincrement().primaryKey(),
        lookupKey: varchar("lookupKey", { length: 320 }).notNull().unique(), // email or phone
        lookupType: mysqlEnum("lookupType", ["email", "phone"]).notNull(),
        data: json("data").$type<Record<string, unknown>>().notNull(),
        expiresAt: timestamp("expiresAt").notNull(), // 90 days from creation
        createdAt: timestamp("createdAt").defaultNow().notNull(),
    },
    (table) => [
        index("idx_pdl_cache_lookupKey").on(table.lookupKey),
        index("idx_pdl_cache_expiresAt").on(table.expiresAt),
    ]
);

// ==================== TYPE EXPORTS ====================

export type User = typeof users.$inferSelect;
export type Event = typeof events.$inferSelect;
export type SignIn = typeof signIns.$inferSelect;
export type AiConversation = typeof aiConversations.$inferSelect;
export type PublicChatAccessGrant = typeof publicChatAccessGrants.$inferSelect;
export type RateLimitWindow = typeof rateLimitWindows.$inferSelect;
export type PublicFunnelEvent = typeof publicFunnelEvents.$inferSelect;
