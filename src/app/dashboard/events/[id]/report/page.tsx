"use client";

import { useState, useEffect, useCallback, use } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { SellerReportView } from "@/components/seller-report-view";
import type { SellerReportAccess } from "@/lib/plans";
import type { SellerReportEvent } from "@/lib/seller-report";

type SellerReportResponse = SellerReportEvent & {
  reportAccess: SellerReportAccess;
};

export default function SellerReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [event, setEvent] = useState<SellerReportResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchEvent = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${id}/report`);
      if (res.ok) {
        setEvent((await res.json()) as SellerReportResponse);
      } else {
        toast.error("Failed to load event");
      }
    } catch {
      toast.error("Failed to load event");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchEvent();
  }, [fetchEvent]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="py-20 text-center">
        <p className="text-muted-foreground">Event not found</p>
      </div>
    );
  }

  const appUrl = typeof window !== "undefined" ? window.location.origin : "";
  const shareUrl =
    event.reportAccess === "detailed" ? `${appUrl}/seller-report/${event.uuid}` : undefined;

  return (
    <SellerReportView
      event={event}
      reportAccess={event.reportAccess}
      shareUrl={shareUrl}
      csvUrl={`/api/events/${id}/export/csv`}
    />
  );
}
