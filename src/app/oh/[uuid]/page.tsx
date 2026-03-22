"use client";

import { useState, useEffect, use, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { OptionButtonGroup } from "@/components/ui/option-button-group";
import { BrandLockup } from "@/components/brand-lockup";
import { PublicTrustFooter } from "@/components/public-trust-footer";
import {
  Loader2,
  CheckCircle2,
  Home,
  MapPin,
  MessageSquareText,
  Phone,
  Mail,
  Sparkles,
  ShieldCheck,
  ArrowRight,
  CircleCheckBig,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import Image, { type ImageLoaderProps } from "next/image";

interface EventInfo {
  uuid: string;
  propertyAddress: string;
  listPrice: string | null;
  startTime: string;
  endTime: string;
  publicMode: string;
  status: string;
  branding: {
    logoUrl?: string;
    primaryColor?: string;
    tagline?: string;
    flyerImageUrl?: string;
  } | null;
  complianceText: string | null;
  customFields: Array<{ label: string; type: "text" | "select"; options?: string[] }> | null;
  propertyType: string | null;
  bedrooms: number | null;
  bathrooms: string | null;
  sqft: number | null;
  propertyPhotos: string[] | null;
  propertyDescription: string | null;
  featureAccessTier: "free" | "trial_pro" | "pro";
  aiQaEnabled: boolean;
  aiQaOnProPreview: boolean;
  chatUnlocked: boolean;
  marketing: {
    headline: string | null;
    summary: string | null;
    highlights: string[];
  };
}

type Phase = "loading" | "form" | "success" | "error";

const passthroughLoader = ({ src }: ImageLoaderProps) => src;

function formatPropertyTypeLabel(value: string | null | undefined) {
  if (!value) return "Home";
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function PublicSignInPage({
  params,
}: {
  params: Promise<{ uuid: string }>;
}) {
  const { uuid } = use(params);
  const router = useRouter();
  const funnelTrackingRef = useRef({ pageViewTracked: false, formStartTracked: false });
  const [phase, setPhase] = useState<Phase>("loading");
  const [event, setEvent] = useState<EventInfo | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [chatUnlocked, setChatUnlocked] = useState(false);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [hasAgent, setHasAgent] = useState<string>("");
  const [isPreApproved, setIsPreApproved] = useState("");
  const [interestLevel, setInterestLevel] = useState("");
  const [buyingTimeline, setBuyingTimeline] = useState("");
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
        setChatUnlocked(Boolean(data.chatUnlocked));
        setPhase("form");
      })
      .catch(() => setPhase("error"));
  }, [uuid]);

  const trackFunnelStage = useCallback(
    async (stage: "page_view" | "form_start") => {
      try {
        await fetch(`/api/public/event/${uuid}/funnel`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stage }),
          keepalive: true,
        });
      } catch {
        // Funnel tracking should never interrupt the visitor flow.
      }
    },
    [uuid]
  );

  useEffect(() => {
    if (phase !== "form" || funnelTrackingRef.current.pageViewTracked === true) return;
    funnelTrackingRef.current.pageViewTracked = true;
    void trackFunnelStage("page_view");
  }, [phase, trackFunnelStage]);

  useEffect(() => {
    if (phase !== "success" || !event?.aiQaEnabled || !chatUnlocked) return;

    const timer = window.setTimeout(() => {
      router.replace(`/oh/${uuid}/chat`);
    }, 1400);

    return () => window.clearTimeout(timer);
  }, [chatUnlocked, event?.aiQaEnabled, phase, router, uuid]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(`/api/public/event/${uuid}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          phone,
          email,
          hasAgent: hasAgent === "yes",
          isPreApproved: isPreApproved || undefined,
          interestLevel: interestLevel || undefined,
          buyingTimeline: buyingTimeline || undefined,
          customAnswers: Object.keys(customAnswers).length > 0 ? customAnswers : undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setChatUnlocked(Boolean(data.chatUnlocked));
        setPhase("success");
      } else {
        toast.error(data.error || "Failed to sign in");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  const primaryColor = event?.branding?.primaryColor || "#10b981";
  const heroImage = event?.propertyPhotos?.[0] || event?.branding?.flyerImageUrl || null;
  const galleryImages = event?.propertyPhotos?.slice(0, 3) || [];
  const visualGallery = galleryImages.length > 0 ? galleryImages : heroImage ? [heroImage] : [];
  const isInquiryMode = event?.publicMode === "listing_inquiry";
  const badgeLabel = isInquiryMode ? "Property Inquiry" : "Open House Guest Registration";
  const formTitle = "Sign In";
  const formDescription = isInquiryMode
    ? "Enter your name, phone, and email so the listing agent can send details, disclosures, and next steps right away."
    : "Name, phone, and email are required so the listing agent can send disclosures, answer questions, and follow up after your visit.";
  const successTitle = isInquiryMode ? "Your Request Is In" : "You're Signed In";
  const successDescription = isInquiryMode
    ? "Thanks for your interest. The listing agent now has your contact details and can follow up with property details and next steps."
    : "Thanks for visiting. The listing agent now has your contact details for follow-up and next steps.";
  const chatButtonText = isInquiryMode ? "Open Property Q&A" : "Open Home Q&A";
  const ctaButtonText = "Continue";

  const handleFormFocusCapture = useCallback(() => {
    if (funnelTrackingRef.current.formStartTracked) return;
    funnelTrackingRef.current.formStartTracked = true;
    void trackFunnelStage("form_start");
  }, [trackFunnelStage]);

  if (phase === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="min-h-screen bg-background">
        <div className="flex items-center justify-center px-4 py-10">
          <Card className="max-w-md w-full text-center">
            <CardContent className="py-12">
              <Home className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
              <h2 className="text-xl font-bold mb-2">Event Not Found</h2>
              <p className="text-muted-foreground">This listing page isn&apos;t available right now.</p>
            </CardContent>
          </Card>
        </div>
        <PublicTrustFooter />
      </div>
    );
  }

  if (phase === "success") {
    return (
      <div className="min-h-screen bg-background">
        <div className="flex items-center justify-center px-4 py-10">
          <Card className="max-w-lg w-full text-center border-emerald-500/30 shadow-xl shadow-emerald-900/5">
            <CardContent className="py-12">
              <div
                className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full"
                style={{ backgroundColor: `${primaryColor}20` }}
              >
                <CheckCircle2 className="h-8 w-8" style={{ color: primaryColor }} />
              </div>
              <h2 className="text-2xl font-bold mb-2">{successTitle}</h2>
              <p className="text-muted-foreground mb-4">{successDescription}</p>
              <p className="text-sm text-muted-foreground mb-6">{event?.propertyAddress}</p>
              {event?.aiQaEnabled && chatUnlocked ? (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-emerald-700">Opening AI Property Q&A automatically...</p>
                  <Link href={`/oh/${uuid}/chat`}>
                    <Button className="bg-emerald-600 text-white hover:bg-emerald-700">
                      <MessageSquareText className="mr-2 h-4 w-4" />
                      {chatButtonText}
                    </Button>
                  </Link>
                </div>
              ) : event?.aiQaOnProPreview ? (
                <div className="space-y-2">
                  <Button variant="outline" disabled className="opacity-65">
                    <MessageSquareText className="mr-2 h-4 w-4" />
                    AI Property Q&A on Pro
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Upgrade the listing agent to Pro after the first 3 launch trials to keep AI Q&A available on every shared link.
                  </p>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
        <PublicTrustFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div
        className="border-b border-border/30 px-4 py-8 sm:px-6"
        style={{ background: `linear-gradient(145deg, ${primaryColor}12, ${primaryColor}04 55%, rgba(255,255,255,0.96))` }}
      >
        <div className="mx-auto max-w-6xl space-y-8">
          <div className="space-y-4">
            {event?.branding?.logoUrl ? (
              <Image
                loader={passthroughLoader}
                unoptimized
                src={event.branding.logoUrl}
                alt="Logo"
                width={220}
                height={52}
                className="h-12 w-auto rounded"
              />
            ) : (
              <div className="inline-flex rounded-full border border-border/60 bg-background/75 px-3 py-1.5 backdrop-blur">
                <BrandLockup compact />
              </div>
            )}

            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{badgeLabel}</Badge>
                {event?.aiQaEnabled ? (
                  <Badge className="border-emerald-500/20 bg-emerald-500/10 text-emerald-700">
                    <Sparkles className="mr-1 h-3 w-3" /> AI Q&A opens right after sign-in
                  </Badge>
                ) : event?.aiQaOnProPreview ? (
                  <Badge variant="secondary" className="border-border/70 bg-background/80 text-muted-foreground">
                    <Sparkles className="mr-1 h-3 w-3" /> AI Property Q&A on Pro
                  </Badge>
                ) : null}
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  {formatPropertyTypeLabel(event?.propertyType)}
                </p>
                <h1 className="max-w-4xl text-3xl font-bold tracking-tight text-balance sm:text-5xl">
                  {event?.marketing?.headline || event?.propertyAddress}
                </h1>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-2">
                    <MapPin className="h-4 w-4" style={{ color: primaryColor }} />
                    {event?.propertyAddress}
                  </span>
                  {event?.listPrice ? (
                    <span className="text-base font-semibold" style={{ color: primaryColor }}>
                      ${Number(event.listPrice).toLocaleString()}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[0.92fr_1.08fr] lg:items-start">
            <Card className="order-1 border-border/60 bg-white/95 shadow-2xl shadow-emerald-950/8 backdrop-blur lg:sticky lg:top-24">
              <CardHeader className="pb-4">
                <div className="mb-3 grid gap-2 rounded-2xl border border-emerald-500/15 bg-emerald-500/6 p-3 text-sm text-foreground/90">
                  <div className="flex items-start gap-2">
                    <CircleCheckBig className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    <span>Sign in once so the listing agent can follow up with pricing, disclosures, and next steps.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CircleCheckBig className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    <span>Get disclosures, pricing context, and next-step guidance without waiting for a callback.</span>
                  </div>
                  {event?.aiQaEnabled ? (
                    <div className="flex items-start gap-2">
                      <CircleCheckBig className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                      <span>After sign-in, OpenHouse sends you straight into AI Property Q&amp;A.</span>
                    </div>
                  ) : null}
                </div>
                <CardTitle className="text-xl">{formTitle}</CardTitle>
                <p className="text-sm text-muted-foreground">{formDescription}</p>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} onFocusCapture={handleFormFocusCapture} className="space-y-5">
                  <div className="space-y-2">
                    <Label>Full Name *</Label>
                    <Input
                      placeholder="John Smith"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                      autoFocus
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone *</Label>
                    <div className="relative">
                      <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        type="tel"
                        placeholder="(555) 123-4567"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        required
                        className="pl-9"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Email *</Label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        type="email"
                        placeholder="your@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="pl-9"
                      />
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border/60 bg-background/70 px-4 py-3 text-xs text-muted-foreground">
                    <div className="flex items-start gap-2">
                      <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>The listing agent uses your details for property follow-up, disclosures, showing coordination, and next-step outreach.</span>
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-2xl border border-border/60 bg-muted/20">
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
                        <div className="space-y-2">
                          <Label>Are you working with an agent?</Label>
                          <OptionButtonGroup
                            value={hasAgent}
                            onChange={setHasAgent}
                            accentColor={primaryColor}
                            equalWidth
                            options={[
                              { value: "yes", label: "Yes" },
                              { value: "no", label: "No" },
                            ]}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Are you pre-approved?</Label>
                          <OptionButtonGroup
                            value={isPreApproved}
                            onChange={setIsPreApproved}
                            accentColor={primaryColor}
                            equalWidth
                            options={[
                              { value: "yes", label: "Yes" },
                              { value: "no", label: "No" },
                            ]}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>How interested are you?</Label>
                          <OptionButtonGroup
                            value={interestLevel}
                            onChange={setInterestLevel}
                            accentColor={primaryColor}
                            options={[
                              { value: "very", label: "Very Interested" },
                              { value: "somewhat", label: "Somewhat Interested" },
                              { value: "just_looking", label: "Just Looking" },
                            ]}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Buying timeline?</Label>
                          <OptionButtonGroup
                            value={buyingTimeline}
                            onChange={setBuyingTimeline}
                            accentColor={primaryColor}
                            options={[
                              { value: "0_3_months", label: "0–3 months" },
                              { value: "3_6_months", label: "3–6 months" },
                              { value: "6_12_months", label: "6–12 months" },
                              { value: "over_12_months", label: "12+ months" },
                              { value: "just_browsing", label: "Just browsing" },
                            ]}
                          />
                        </div>
                      </div>
                    ) : null}
                  </div>

                  {event?.customFields && event.customFields.length > 0 && (
                    <Card className="border-border/60 bg-background/70 shadow-none">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">Additional Questions</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {event.customFields.map((field, i) => (
                          <div key={i} className="space-y-2">
                            <Label>{field.label}</Label>
                            {field.type === "select" && field.options ? (
                              <OptionButtonGroup
                                value={customAnswers[field.label] || ""}
                                onChange={(nextValue) =>
                                  setCustomAnswers((prev) => ({ ...prev, [field.label]: nextValue }))
                                }
                                accentColor={primaryColor}
                                options={field.options.map((opt) => ({
                                  value: opt,
                                  label: opt,
                                }))}
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
                      </CardContent>
                    </Card>
                  )}

                  {event?.complianceText && (
                    <p className="text-xs text-muted-foreground text-center px-2">{event.complianceText}</p>
                  )}

                  <Button
                    type="submit"
                    className="h-12 w-full text-base font-semibold text-white"
                    style={{
                      background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}cc)`,
                      border: "none",
                    }}
                    disabled={submitting}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Continuing...
                      </>
                    ) : (
                      <>
                        {ctaButtonText}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <div className="order-2 space-y-5">
              {visualGallery.length > 0 && (
                <div className="space-y-4">
                  {visualGallery.length === 1 && (
                    <div className="overflow-hidden rounded-[2rem] border border-white/60 shadow-2xl shadow-emerald-950/10">
                      <Image
                        loader={passthroughLoader}
                        unoptimized
                        src={visualGallery[0]}
                        alt={event?.propertyAddress || "Property photo"}
                        width={1600}
                        height={980}
                        className="h-72 w-full object-cover sm:h-[26rem]"
                      />
                    </div>
                  )}

                  {visualGallery.length > 1 && (
                    <div className="grid gap-3 sm:grid-cols-[1.3fr_0.7fr]">
                      <div className="overflow-hidden rounded-[2rem] border border-white/60 shadow-2xl shadow-emerald-950/10">
                        <Image
                          loader={passthroughLoader}
                          unoptimized
                          src={visualGallery[0]}
                          alt={event?.propertyAddress || "Property photo"}
                          width={1600}
                          height={980}
                          className="h-72 w-full object-cover sm:h-[26rem]"
                        />
                      </div>
                      <div className="grid gap-3">
                        {visualGallery.slice(1, 3).map((src, index) => (
                          <div
                            key={`${src}-${index}`}
                            className="overflow-hidden rounded-[1.5rem] border border-white/60 shadow-xl shadow-emerald-950/8"
                          >
                            <Image
                              loader={passthroughLoader}
                              unoptimized
                              src={src}
                              alt={`${event?.propertyAddress || "Property"} photo ${index + 2}`}
                              width={900}
                              height={600}
                              className="h-32 w-full object-cover sm:h-[12.5rem]"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <Card className="border-border/60 bg-white/90 shadow-xl shadow-emerald-950/6">
                <CardContent className="space-y-5 p-6">
                  {event?.marketing?.summary ? (
                    <p className="text-base leading-7 text-muted-foreground">{event.marketing.summary}</p>
                  ) : null}

                  <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                    {event?.bedrooms ? (
                      <span className="rounded-full border border-border/50 bg-background/70 px-3 py-1">{event.bedrooms} beds</span>
                    ) : null}
                    {event?.bathrooms ? (
                      <span className="rounded-full border border-border/50 bg-background/70 px-3 py-1">{event.bathrooms} baths</span>
                    ) : null}
                    {event?.sqft ? (
                      <span className="rounded-full border border-border/50 bg-background/70 px-3 py-1">{event.sqft.toLocaleString()} sqft</span>
                    ) : null}
                  </div>

                  {event?.marketing?.highlights?.length ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {event.marketing.highlights.map((highlight) => (
                        <div
                          key={highlight}
                          className="rounded-2xl border border-border/60 bg-white/80 px-4 py-3 text-sm text-foreground/90 shadow-sm shadow-emerald-950/5"
                        >
                          {highlight}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
      <PublicTrustFooter />
    </div>
  );
}
