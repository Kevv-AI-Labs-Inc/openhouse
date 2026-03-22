"use client";

import { useState, useEffect, useCallback, use } from "react";
import { Loader2, CheckCircle2, Home, MapPin, Phone, Mail, ChevronDown, ChevronUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { OptionButtonGroup } from "@/components/ui/option-button-group";
import { BrandLockup } from "@/components/brand-lockup";
import Image, { type ImageLoaderProps } from "next/image";

interface EventInfo {
    uuid: string;
    propertyAddress: string;
    listPrice: string | null;
    publicMode: string;
    branding: { logoUrl?: string; primaryColor?: string; tagline?: string; flyerImageUrl?: string } | null;
    customFields: Array<{ label: string; type: "text" | "select"; options?: string[] }> | null;
    complianceText: string | null;
    bedrooms: number | null;
    bathrooms: string | null;
    sqft: number | null;
    propertyPhotos: string[] | null;
    propertyDescription: string | null;
    marketing: {
        headline: string | null;
        summary: string | null;
        highlights: string[];
    };
}

type Phase = "loading" | "welcome" | "form" | "thanks" | "error";

const passthroughLoader = ({ src }: ImageLoaderProps) => src;

export default function KioskPage({
    params,
}: {
    params: Promise<{ uuid: string }>;
}) {
    const { uuid } = use(params);
    const [phase, setPhase] = useState<Phase>("loading");
    const [event, setEvent] = useState<EventInfo | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const [fullName, setFullName] = useState("");
    const [phone, setPhone] = useState("");
    const [email, setEmail] = useState("");
    const [hasAgent, setHasAgent] = useState("");
    const [isPreApproved, setIsPreApproved] = useState("");
    const [interestLevel, setInterestLevel] = useState("");
    const [customAnswers, setCustomAnswers] = useState<Record<string, string>>({});
    const [showOptionalDetails, setShowOptionalDetails] = useState(false);

    useEffect(() => {
        fetch(`/api/public/event/${uuid}`)
            .then((r) => {
                if (!r.ok) throw new Error("Not found");
                return r.json();
            })
            .then((data) => {
                setEvent(data);
                setPhase("welcome");
            })
            .catch(() => setPhase("error"));
    }, [uuid]);

    const resetForm = useCallback(() => {
        setFullName("");
        setPhone("");
        setEmail("");
        setHasAgent("");
        setIsPreApproved("");
        setInterestLevel("");
        setCustomAnswers({});
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!fullName.trim() || !phone.trim() || !email.trim()) return;
        setSubmitting(true);
        try {
            await fetch(`/api/public/event/${uuid}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    fullName,
                    phone,
                    email,
                    hasAgent: hasAgent === "yes",
                    isPreApproved: isPreApproved || undefined,
                    interestLevel: interestLevel || undefined,
                    customAnswers: Object.keys(customAnswers).length > 0 ? customAnswers : undefined,
                }),
            });
            setPhase("thanks");
            resetForm();
            setTimeout(() => setPhase("welcome"), 3000);
        } catch {
            setPhase("thanks");
            resetForm();
            setTimeout(() => setPhase("welcome"), 3000);
        } finally {
            setSubmitting(false);
        }
    };

    const color = event?.branding?.primaryColor || "#10b981";
    const heroImage = event?.propertyPhotos?.[0] || event?.branding?.flyerImageUrl || null;
    if (phase === "loading") {
        return (
            <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-cyan-50">
                <Loader2 className="h-10 w-10 animate-spin" style={{ color }} />
            </div>
        );
    }

    if (phase === "error") {
        return (
            <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-cyan-50 px-8 text-center">
                <div>
                    <Home className="mx-auto mb-4 h-16 w-16 text-muted-foreground" />
                    <h1 className="mb-2 text-2xl font-bold">Event Not Found</h1>
                    <p className="text-muted-foreground">This Open House event doesn&apos;t exist.</p>
                </div>
            </div>
        );
    }

    if (phase === "welcome") {
        return (
            <div
                className="fixed inset-0 cursor-pointer bg-gradient-to-br from-emerald-50 via-white to-cyan-50 px-8 text-center"
                onClick={() => setPhase("form")}
            >
                <div className="mx-auto flex h-full w-full max-w-5xl items-center justify-center">
                    <div className="w-full rounded-[2rem] border border-border/60 bg-white/92 px-10 py-12 shadow-2xl shadow-emerald-900/5 backdrop-blur">
                        {heroImage && (
                            <Image
                                loader={passthroughLoader}
                                unoptimized
                                src={heroImage}
                                alt={event?.propertyAddress || "Property photo"}
                                width={1440}
                                height={720}
                                className="mb-6 h-60 w-full rounded-[1.5rem] object-cover"
                            />
                        )}
                        <div className="mb-4 inline-flex rounded-full border border-border/60 bg-background/70 px-3 py-1.5">
                            <BrandLockup compact />
                        </div>
                        <h1 className="mb-3 text-4xl font-bold">{event?.marketing?.headline || "Welcome"}</h1>
                        <p className="mb-2 inline-flex items-center gap-2 text-xl">
                            <MapPin className="h-5 w-5" style={{ color }} />
                            {event?.propertyAddress}
                        </p>
                        {event?.listPrice && (
                            <p className="mb-4 text-2xl font-bold" style={{ color }}>
                                ${Number(event.listPrice).toLocaleString()}
                            </p>
                        )}
                        {event?.marketing?.summary && (
                            <p className="mx-auto mb-6 max-w-3xl text-base leading-7 text-muted-foreground">
                                {event.marketing.summary}
                            </p>
                        )}
                        <div className="mb-8 flex flex-wrap items-center justify-center gap-3 text-sm text-muted-foreground">
                            {event?.bedrooms ? <span className="rounded-full border border-border/60 bg-background/70 px-3 py-1">{event.bedrooms} beds</span> : null}
                            {event?.bathrooms ? <span className="rounded-full border border-border/60 bg-background/70 px-3 py-1">{event.bathrooms} baths</span> : null}
                            {event?.sqft ? <span className="rounded-full border border-border/60 bg-background/70 px-3 py-1">{event.sqft.toLocaleString()} sqft</span> : null}
                        </div>
                        <div
                            className="mx-auto inline-flex rounded-2xl px-10 py-4 text-xl font-semibold text-white animate-pulse"
                            style={{ backgroundColor: color }}
                        >
                            {"Tap to Sign In"}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (phase === "thanks") {
        return (
            <div className="fixed inset-0 bg-gradient-to-br from-emerald-50 via-white to-cyan-50 px-8 text-center">
                <div className="mx-auto flex h-full w-full max-w-3xl items-center justify-center">
                    <div className="w-full rounded-[2rem] border border-border/60 bg-white/92 px-10 py-12 shadow-2xl shadow-emerald-900/5 backdrop-blur">
                        <div
                            className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full"
                            style={{ backgroundColor: `${color}18` }}
                        >
                            <CheckCircle2 className="h-10 w-10" style={{ color }} />
                        </div>
                        <h1 className="mb-3 text-4xl font-bold">Thank You!</h1>
                        <p className="text-xl text-muted-foreground">The agent has your details now.</p>
                        <p className="mt-4 text-sm text-muted-foreground">Next visitor in a moment...</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 overflow-auto bg-gradient-to-br from-emerald-50 via-white to-cyan-50">
            <div className="mx-auto max-w-xl px-6 py-8">
                <div className="mb-6 text-center">
                    {heroImage && (
                        <Image
                            loader={passthroughLoader}
                            unoptimized
                            src={heroImage}
                            alt={event?.propertyAddress || "Property photo"}
                            width={1200}
                            height={640}
                            className="mb-5 h-44 w-full rounded-[1.5rem] object-cover shadow-lg shadow-emerald-900/8"
                        />
                    )}
                    <div className="mb-3 inline-flex rounded-full border border-border/60 bg-background/70 px-3 py-1.5">
                        <BrandLockup compact />
                    </div>
                    <h1 className="mb-1 text-2xl font-bold">
                        {event?.marketing?.headline || "Sign In"}
                    </h1>
                    <p className="text-sm text-muted-foreground">{event?.propertyAddress}</p>
                    {event?.marketing?.summary && (
                        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
                            {event.marketing.summary}
                        </p>
                    )}
                </div>

                <form
                    onSubmit={handleSubmit}
                    className="space-y-4 rounded-[1.75rem] border border-border/60 bg-white/92 p-6 shadow-2xl shadow-emerald-900/5 backdrop-blur"
                >
                    <div>
                        <label className="mb-1.5 block text-sm text-foreground/90">Full Name *</label>
                        <Input
                            className="h-14 border-border/70 bg-white text-lg"
                            placeholder="Your full name"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            required
                            autoFocus
                        />
                    </div>
                    <div>
                        <label className="mb-1.5 block text-sm text-foreground/90">Phone *</label>
                        <div className="relative">
                            <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                className="h-14 border-border/70 bg-white pl-9 text-lg"
                                type="tel"
                                placeholder="(555) 123-4567"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                required
                            />
                        </div>
                    </div>
                    <div>
                        <label className="mb-1.5 block text-sm text-foreground/90">Email *</label>
                        <div className="relative">
                            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                className="h-14 border-border/70 bg-white pl-9 text-lg"
                                type="email"
                                placeholder="your@email.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <div className="overflow-hidden rounded-2xl border border-border/60 bg-muted/15">
                        <button
                            type="button"
                            className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left"
                            onClick={() => setShowOptionalDetails((current) => !current)}
                        >
                            <div>
                                <p className="text-sm font-semibold text-foreground">Optional buying details</p>
                                <p className="text-xs text-muted-foreground">
                                    These help the listing agent qualify follow-up and prioritize next steps.
                                </p>
                            </div>
                            {showOptionalDetails ? (
                                <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
                            ) : (
                                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                            )}
                        </button>
                        {showOptionalDetails ? (
                            <div className="space-y-4 border-t border-border/50 px-4 pb-4 pt-2">
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="mb-1.5 block text-sm text-foreground/90">Working with an agent?</label>
                                        <OptionButtonGroup
                                            value={hasAgent}
                                            onChange={setHasAgent}
                                            accentColor={color}
                                            equalWidth
                                            options={[
                                                { value: "yes", label: "Yes" },
                                                { value: "no", label: "No" },
                                            ]}
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-1.5 block text-sm text-foreground/90">Pre-approved?</label>
                                        <OptionButtonGroup
                                            value={isPreApproved}
                                            onChange={setIsPreApproved}
                                            accentColor={color}
                                            equalWidth
                                            options={[
                                                { value: "yes", label: "Yes" },
                                                { value: "no", label: "No" },
                                            ]}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="mb-1.5 block text-sm text-foreground/90">Interest level</label>
                                    <OptionButtonGroup
                                        value={interestLevel}
                                        onChange={setInterestLevel}
                                        accentColor={color}
                                        options={[
                                            { value: "very", label: "Very Interested" },
                                            { value: "somewhat", label: "Somewhat Interested" },
                                            { value: "just_looking", label: "Just Looking" },
                                        ]}
                                    />
                                </div>
                            </div>
                        ) : null}
                    </div>

                    {event?.customFields && event.customFields.length > 0 && (
                        <div className="space-y-3 rounded-2xl border border-border/60 bg-muted/15 p-4">
                            {event.customFields.map((field, i) => (
                                <div key={i} className="space-y-2">
                                    <label className="block text-sm text-foreground/90">{field.label}</label>
                                    {field.type === "select" && field.options ? (
                                        <OptionButtonGroup
                                            value={customAnswers[field.label] || ""}
                                            onChange={(nextValue) =>
                                                setCustomAnswers((prev) => ({ ...prev, [field.label]: nextValue }))
                                            }
                                            accentColor={color}
                                            options={field.options.map((opt) => ({ value: opt, label: opt }))}
                                        />
                                    ) : (
                                        <Input
                                            value={customAnswers[field.label] || ""}
                                            onChange={(e) =>
                                                setCustomAnswers((prev) => ({
                                                    ...prev,
                                                    [field.label]: e.target.value,
                                                }))
                                            }
                                        />
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    <button
                        type="submit"
                        className="h-14 w-full rounded-2xl text-lg font-semibold text-white shadow-lg shadow-emerald-900/10"
                        style={{ background: `linear-gradient(135deg, ${color}, ${color}cc)` }}
                        disabled={submitting}
                    >
                        {submitting ? "Continuing..." : "Continue"}
                    </button>
                </form>
            </div>
        </div>
    );
}
