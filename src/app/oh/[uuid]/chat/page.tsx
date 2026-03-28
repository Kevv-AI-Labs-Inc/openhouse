"use client";

import { FormEvent, useEffect, useMemo, useState, use } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Send, Sparkles } from "lucide-react";
import { PublicTrustFooter } from "@/components/public-trust-footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import type { PropertyQaSource } from "@/lib/db/schema";
import {
    getQaUiCopy,
    type SupportedQaLanguage,
} from "@/lib/property-qa-language";

interface EventInfo {
    propertyAddress: string;
    aiQaEnabled: boolean;
    aiQaOnProPreview: boolean;
    chatUnlocked: boolean;
    branding: { primaryColor?: string } | null;
    qaLanguage?: SupportedQaLanguage;
    suggestedQuestions?: string[];
}

interface ChatMessage {
    role: "user" | "assistant";
    content: string;
    sources?: PropertyQaSource[];
    suggestedPrompts?: string[];
    answerQuality?: "direct" | "partial" | "uncertain";
    usedWebSearch?: boolean;
    responseLanguage?: SupportedQaLanguage;
}

export default function PublicPropertyChatPage({
    params,
}: {
    params: Promise<{ uuid: string }>;
}) {
    const { uuid } = use(params);
    const [event, setEvent] = useState<EventInfo | null>(null);
    const [loadingEvent, setLoadingEvent] = useState(true);
    const [loadingHistory, setLoadingHistory] = useState(true);
    const [sending, setSending] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState("");
    const [sessionId, setSessionId] = useState<string | null>(null);

    const sessionStorageKey = useMemo(() => `oh-chat-session-${uuid}`, [uuid]);
    const primaryColor = event?.branding?.primaryColor || "#10b981";
    const currentLanguage =
        [...messages]
            .reverse()
            .find((message) => message.role === "assistant" && message.responseLanguage)?.responseLanguage ||
        event?.qaLanguage ||
        "en";
    const uiCopy = getQaUiCopy(currentLanguage);

    async function submitQuestion(content: string) {
        const trimmed = content.trim();
        if (!trimmed || sending) return;

        const previousMessages = messages;
        const nextMessages = [...messages, { role: "user" as const, content: trimmed }];
        setMessages(nextMessages);
        setInput("");
        setSending(true);

        try {
            const res = await fetch(`/api/public/event/${uuid}/chat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: trimmed,
                    sessionId,
                    history: messages.slice(-12),
                }),
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data?.error || "Failed to chat");
            }

            if (data.sessionId && typeof data.sessionId === "string") {
                setSessionId(data.sessionId);
                window.localStorage.setItem(sessionStorageKey, data.sessionId);
            }

            setMessages((prev) => [
                ...prev,
                {
                    role: "assistant",
                    content: data.reply || "I couldn't generate a response.",
                    sources: Array.isArray(data.sources) ? data.sources : undefined,
                    suggestedPrompts: Array.isArray(data.suggestedPrompts)
                        ? data.suggestedPrompts.filter((item: unknown): item is string => typeof item === "string")
                        : undefined,
                    answerQuality:
                        data.answerQuality === "direct" ||
                        data.answerQuality === "partial" ||
                        data.answerQuality === "uncertain"
                            ? data.answerQuality
                            : undefined,
                    usedWebSearch: data.usedWebSearch === true,
                    responseLanguage:
                        data.language === "en" ||
                        data.language === "zh" ||
                        data.language === "es" ||
                        data.language === "fr" ||
                        data.language === "pt" ||
                        data.language === "ja" ||
                        data.language === "ko"
                            ? data.language
                            : undefined,
                },
            ]);
        } catch (error) {
            setMessages(previousMessages);
            toast.error(error instanceof Error ? error.message : "Failed to send message");
        } finally {
            setSending(false);
        }
    }

    useEffect(() => {
        fetch(`/api/public/event/${uuid}`)
            .then(async (res) => {
                if (!res.ok) throw new Error("Event not found");
                return res.json();
            })
            .then((data) => {
                setEvent(data);
            })
            .catch(() => {
                toast.error("Failed to load event");
            })
            .finally(() => {
                setLoadingEvent(false);
            });
    }, [uuid]);

    useEffect(() => {
        if (!event?.chatUnlocked) {
            setLoadingHistory(false);
            return;
        }

        const existingSessionId = window.localStorage.getItem(sessionStorageKey);
        if (!existingSessionId) {
            setLoadingHistory(false);
            return;
        }

        setSessionId(existingSessionId);
        fetch(`/api/public/event/${uuid}/chat?sessionId=${encodeURIComponent(existingSessionId)}`)
            .then(async (res) => {
                if (!res.ok) throw new Error("Failed to load history");
                return res.json();
            })
            .then((data: { messages?: ChatMessage[] }) => {
                if (Array.isArray(data.messages)) {
                    setMessages(
                        data.messages.filter(
                            (msg): msg is ChatMessage =>
                                (msg.role === "user" || msg.role === "assistant") &&
                                typeof msg.content === "string"
                        )
                    );
                }
            })
            .catch(() => {
                window.localStorage.removeItem(sessionStorageKey);
                setSessionId(null);
            })
            .finally(() => {
                setLoadingHistory(false);
            });
    }, [event?.chatUnlocked, sessionStorageKey, uuid]);

    async function handleSend(eventForm: FormEvent) {
        eventForm.preventDefault();
        await submitQuestion(input);
    }

    if (loadingEvent || loadingHistory) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            </div>
        );
    }

    if (!event) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center px-4">
                <Card className="w-full max-w-lg">
                    <CardContent className="py-10 text-center">
                        <p className="text-muted-foreground">Event not found.</p>
                        <Link href="/" className="inline-block mt-4">
                            <Button variant="outline">Back Home</Button>
                        </Link>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (!event.aiQaEnabled) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center px-4">
                <Card className="w-full max-w-lg">
                    <CardHeader>
                        <CardTitle>
                            {event.aiQaOnProPreview ? "AI Property Q&A is on Pro" : "AI Chat Not Enabled"}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                            {event.aiQaOnProPreview
                                ? "This shared link is still on the Free tier. The first 3 published launches include Pro features, and Pro keeps property Q&A available on every listing after that."
                                : "The listing agent has not enabled AI Property Q&A for this event."}
                        </p>
                        <Link href={`/oh/${uuid}`}>
                            <Button variant="outline">Back to Property Page</Button>
                        </Link>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (!event.chatUnlocked) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center px-4">
                <Card className="w-full max-w-lg">
                    <CardHeader>
                        <CardTitle>Share contact details first</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                            Property Q&A becomes available after the visitor shares contact details
                            with the listing agent.
                        </p>
                        <Link href={`/oh/${uuid}`}>
                            <Button variant="outline">Back to Property Page</Button>
                        </Link>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background">
            <div
                className="border-b border-border/40 px-4 py-4"
                style={{ background: `linear-gradient(135deg, ${primaryColor}18, ${primaryColor}06)` }}
            >
                <div className="mx-auto max-w-3xl flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <Link href={`/oh/${uuid}`}>
                            <Button variant="ghost" size="icon" aria-label="Back">
                                <ArrowLeft className="h-4 w-4" />
                            </Button>
                        </Link>
                        <div>
                            <h1 className="text-lg font-semibold">{event.propertyAddress}</h1>
                            <p className="text-xs text-muted-foreground">AI Property Q&A</p>
                        </div>
                    </div>
                    <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700">
                        <Sparkles className="h-3 w-3 mr-1" />
                        AI
                    </Badge>
                </div>
            </div>

            <div className="mx-auto max-w-3xl px-4 py-6">
                <Card className="border-border/50">
                    <CardContent className="p-4 space-y-4">
                        <div className="h-[55vh] overflow-y-auto rounded-lg border border-border/40 bg-muted/20 p-3 space-y-3">
                            {messages.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center gap-4 px-6 text-center">
                                    <div className="space-y-2">
                                        <p className="text-sm font-medium text-foreground">{uiCopy.emptyTitle}</p>
                                        <p className="text-sm text-muted-foreground">{uiCopy.emptyBody}</p>
                                    </div>
                                    <div className="flex max-w-2xl flex-wrap justify-center gap-2">
                                        {(event.suggestedQuestions || []).map((question) => (
                                            <button
                                                key={question}
                                                type="button"
                                                onClick={() => submitQuestion(question)}
                                                className="rounded-full border border-border/60 bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-emerald-500/40 hover:text-foreground"
                                            >
                                                {question}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                messages.map((message, index) => (
                                    <div
                                        key={`${message.role}-${index}`}
                                        className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                                    >
                                        <div
                                            className={`max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed ${message.role === "user"
                                                ? "bg-emerald-500 text-white"
                                                : "bg-card border border-border/40"
                                                }`}
                                        >
                                            {message.content}
                                            {message.role === "assistant" ? (
                                                <div className="mt-3 flex flex-wrap gap-2">
                                                    {message.answerQuality && message.answerQuality !== "direct" ? (
                                                        <span className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-700">
                                                            {message.answerQuality === "uncertain"
                                                                ? getQaUiCopy(message.responseLanguage || currentLanguage).needsAgentConfirmation
                                                                : getQaUiCopy(message.responseLanguage || currentLanguage).bestAvailableAnswer}
                                                        </span>
                                                    ) : null}
                                                    {message.usedWebSearch ? (
                                                        <span className="inline-flex items-center rounded-full border border-sky-500/30 bg-sky-500/10 px-2.5 py-1 text-[11px] font-medium text-sky-700">
                                                            {getQaUiCopy(message.responseLanguage || currentLanguage).checkedPublicSources}
                                                        </span>
                                                    ) : null}
                                                </div>
                                            ) : null}
                                            {message.role === "assistant" && message.sources && message.sources.length > 0 ? (
                                                <div className="mt-3 flex flex-wrap gap-2">
                                                    {message.sources.map((source) =>
                                                        source.url ? (
                                                            <a
                                                                key={`${index}-${source.key}`}
                                                                href={source.url}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="inline-flex items-center rounded-full border border-border/60 bg-background px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition hover:border-emerald-500/40 hover:text-foreground"
                                                            >
                                                                {source.label}
                                                            </a>
                                                        ) : (
                                                            <span
                                                                key={`${index}-${source.key}`}
                                                                className="inline-flex items-center rounded-full border border-border/60 bg-background px-2.5 py-1 text-[11px] font-medium text-muted-foreground"
                                                            >
                                                                {source.label}
                                                            </span>
                                                        )
                                                    )}
                                                </div>
                                            ) : null}
                                            {message.role === "assistant" &&
                                            message.suggestedPrompts &&
                                            message.suggestedPrompts.length > 0 ? (
                                                <div className="mt-3 space-y-2">
                                                    <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                                                        {getQaUiCopy(message.responseLanguage || currentLanguage).askNextLabel}
                                                    </p>
                                                    <div className="flex flex-wrap gap-2">
                                                        {message.suggestedPrompts.map((prompt) => (
                                                            <button
                                                                key={`${index}-${prompt}`}
                                                                type="button"
                                                                onClick={() => submitQuestion(prompt)}
                                                                className="rounded-full border border-border/60 bg-background px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition hover:border-emerald-500/40 hover:text-foreground"
                                                            >
                                                                {prompt}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            ) : null}
                                        </div>
                                    </div>
                                ))
                            )}
                            {sending && (
                                <div className="flex justify-start">
                                    <div className="rounded-xl px-3 py-2 text-sm bg-card border border-border/40">
                                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                    </div>
                                </div>
                            )}
                        </div>

                        <form onSubmit={handleSend} className="flex gap-2">
                            <Input
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder={uiCopy.placeholder}
                                disabled={sending}
                            />
                            <Button type="submit" disabled={sending || !input.trim()}>
                                <Send className="h-4 w-4" />
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </div>
            <PublicTrustFooter />
        </div>
    );
}
