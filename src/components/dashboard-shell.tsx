"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
    BarChart3,
    CalendarDays,
    LayoutDashboard,
    LogOut,
    Menu,
    Plus,
    Settings,
    Sparkles,
    Users,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";
import { BrandLockup } from "@/components/brand-lockup";
import { BrandMark } from "@/components/brand-mark";
import { requestNewEventDialog } from "@/lib/new-event-trigger";

type NavItem = {
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    note: string;
};

const NAV_ITEMS: NavItem[] = [
    { href: "/dashboard", icon: LayoutDashboard, label: "Overview", note: "Operations pulse" },
    { href: "/dashboard/events", icon: CalendarDays, label: "Events", note: "Open house schedule" },
    { href: "/dashboard/leads", icon: Users, label: "Leads", note: "Prioritized pipeline" },
    { href: "/dashboard/analytics", icon: BarChart3, label: "Analytics", note: "Seller reporting" },
    { href: "/dashboard/settings", icon: Settings, label: "Settings", note: "Account and plans" },
];

type UserInfo = {
    name?: string | null;
    email?: string | null;
    image?: string | null;
};

function getInitials(name?: string | null) {
    if (!name) return "AG";
    const tokens = name.trim().split(/\s+/).slice(0, 2);
    return tokens.map((token) => token[0]?.toUpperCase() ?? "").join("") || "AG";
}

function UserMenu({ user, compact = false }: { user?: UserInfo; compact?: boolean }) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    className={`gap-3 rounded-xl border border-transparent px-2 py-2 hover:border-border/70 hover:bg-background/60 ${compact ? "w-auto" : "w-full justify-start"
                        }`}
                >
                    <Avatar className="h-8 w-8 border border-border/50">
                        <AvatarImage src={user?.image ?? ""} alt={user?.name ?? "Agent"} />
                        <AvatarFallback className="bg-emerald-500/10 text-[11px] font-semibold text-emerald-700">
                            {getInitials(user?.name)}
                        </AvatarFallback>
                    </Avatar>
                    {!compact && (
                        <div className="min-w-0 text-left leading-tight">
                            <p className="truncate text-sm font-medium">{user?.name ?? "Agent"}</p>
                            <p className="truncate text-xs text-muted-foreground">{user?.email ?? ""}</p>
                        </div>
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem asChild>
                    <Link href="/dashboard/settings">
                        <Settings className="mr-2 h-4 w-4" />
                        Settings
                    </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/" })}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign out
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function SidebarNav({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
    return (
        <nav className="space-y-1.5">
            {NAV_ITEMS.map((item) => {
                const isActive =
                    pathname === item.href ||
                    (item.href !== "/dashboard" && pathname.startsWith(item.href));

                return (
                    <Link key={item.href} href={item.href} onClick={onNavigate}>
                        <div
                            className={`rounded-2xl border px-3 py-3 transition-colors ${isActive
                                    ? "border-emerald-500/35 bg-emerald-500/10"
                                    : "border-border/30 bg-card/25 hover:border-emerald-500/25 hover:bg-card/45"
                                }`}
                        >
                            <div className="flex items-center gap-3">
                                <span
                                    className={`rounded-lg p-1.5 ${isActive ? "bg-emerald-500/20 text-emerald-700" : "bg-muted/45 text-muted-foreground"
                                        }`}
                                >
                                    <item.icon className="h-4 w-4" />
                                </span>
                                <div className="leading-tight">
                                    <p className={`text-sm font-medium ${isActive ? "text-foreground" : "text-muted-foreground"}`}>
                                        {item.label}
                                    </p>
                                    <p className="text-[11px] text-muted-foreground/90">{item.note}</p>
                                </div>
                            </div>
                        </div>
                    </Link>
                );
            })}
        </nav>
    );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const { data: session } = useSession();
    const [mobileNavOpen, setMobileNavOpen] = useState(false);

    const isPro = session?.user?.subscriptionTier === "pro";

    const handleNewEventClick = () => {
        requestNewEventDialog();
        router.push("/dashboard/events");
    };

    return (
        <div className="brand-ambient relative min-h-screen overflow-hidden bg-background text-foreground">
            <div className="pointer-events-none absolute inset-0 -z-10">
                <div className="absolute left-1/2 top-[-22rem] h-[40rem] w-[40rem] -translate-x-1/2 rounded-full bg-emerald-500/10 blur-[120px]" />
                <div className="absolute right-[-9rem] top-[16rem] h-[24rem] w-[24rem] rounded-full bg-cyan-400/10 blur-[100px]" />
                <div className="absolute left-[-6rem] top-[24rem] h-[18rem] w-[18rem] rounded-full bg-teal-500/10 blur-[90px]" />
            </div>

            <div className="relative z-10 flex min-h-screen">
                <aside className="hidden w-72 shrink-0 border-r border-border/60 bg-card/80 backdrop-blur-xl lg:flex lg:flex-col">
                    <div className="border-b border-border/60 px-5 py-5">
                        <Link href="/dashboard" className="inline-flex items-center">
                            <BrandLockup name="Kevv OpenHouse" tagline="Control center" />
                        </Link>
                    </div>

                    <div className="px-4 pt-4">
                        <Button
                            className="h-10 w-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:from-emerald-600 hover:to-teal-700"
                            onClick={handleNewEventClick}
                        >
                            <Plus className="mr-2 h-4 w-4" />
                            New open house
                        </Button>
                    </div>

                    <div className="flex-1 px-4 py-4">
                        <SidebarNav pathname={pathname} />
                    </div>

                    <div className="space-y-3 border-t border-border/60 p-4">
                        <div className="rounded-2xl border border-border/50 bg-background/60 p-3">
                            <div className="mb-2 flex items-center justify-between">
                                <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                                    Plan
                                </p>
                                <Badge
                                    className={isPro
                                        ? "border-emerald-500/35 bg-emerald-500/15 text-emerald-700"
                                        : "border-border/60 bg-card/60 text-muted-foreground"
                                    }
                                >
                                    {isPro ? "Pro" : "Free"}
                                </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                {isPro
                                    ? "Billing-backed AI scoring, follow-up, and property Q&A workflows enabled."
                                    : "Your first 3 published launches include Pro features. Upgrade after that to keep AI scoring, follow-up, and property Q&A on every listing."}
                            </p>
                            {!isPro && (
                                <Link href="/dashboard/settings" className="mt-3 block">
                                    <Button variant="outline" className="h-8 w-full text-xs">
                                        <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                                        Compare plans
                                    </Button>
                                </Link>
                            )}
                        </div>

                        <UserMenu user={session?.user as UserInfo | undefined} />
                    </div>
                </aside>

                <div className="flex min-w-0 flex-1 flex-col">
                    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-xl">
                        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 md:px-6 lg:px-8">
                            <div className="flex items-center gap-3">
                                <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
                                    <SheetTrigger asChild>
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            className="h-9 w-9 border-border/70 bg-background/70 lg:hidden"
                                        >
                                            <Menu className="h-4 w-4" />
                                            <span className="sr-only">Open navigation</span>
                                        </Button>
                                    </SheetTrigger>
                                    <SheetContent
                                        side="left"
                                        className="w-[86vw] border-border/60 bg-background/95 p-0 backdrop-blur-xl"
                                    >
                                        <SheetHeader className="border-b border-border/60 px-5 py-5 text-left">
                                            <SheetTitle className="flex items-center gap-3 text-sm font-semibold">
                                                <BrandMark className="size-8 rounded-lg" />
                                                Kevv OpenHouse dashboard
                                            </SheetTitle>
                                            <SheetDescription>
                                                Unified event operations for North American teams.
                                            </SheetDescription>
                                        </SheetHeader>

                                        <div className="px-4 pt-4">
                                            <Button
                                                className="h-10 w-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:from-emerald-600 hover:to-teal-700"
                                                onClick={() => {
                                                    setMobileNavOpen(false);
                                                    handleNewEventClick();
                                                }}
                                            >
                                                <Plus className="mr-2 h-4 w-4" />
                                                New open house
                                            </Button>
                                        </div>

                                        <div className="flex-1 px-4 py-4">
                                            <SidebarNav pathname={pathname} onNavigate={() => setMobileNavOpen(false)} />
                                        </div>

                                        <div className="space-y-3 border-t border-border/60 p-4">
                                            <div className="rounded-2xl border border-border/50 bg-background/60 p-3">
                                                <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                                                    Active tier
                                                </p>
                                                <p className="mt-2 text-sm font-medium">
                                                    {isPro ? "Pro" : "Free"}
                                                </p>
                                                <p className="mt-1 text-xs text-muted-foreground">
                                                    {isPro
                                                        ? "Advanced AI, billing, and reporting tools are enabled."
                                                        : "Your first 3 published launches include Pro features. Upgrade after that to keep AI scoring, follow-up delivery, and advanced automation."}
                                                </p>
                                            </div>
                                            <Button
                                                variant="outline"
                                                className="w-full justify-start"
                                                onClick={() => signOut({ callbackUrl: "/" })}
                                            >
                                                <LogOut className="mr-2 h-4 w-4" />
                                                Sign out
                                            </Button>
                                        </div>
                                    </SheetContent>
                                </Sheet>

                            </div>

                            <div className="flex items-center gap-2">
                                <Badge
                                    className={isPro
                                        ? "hidden border-emerald-500/35 bg-emerald-500/15 text-emerald-700 sm:inline-flex"
                                        : "hidden border-border/70 bg-card/60 text-muted-foreground sm:inline-flex"
                                    }
                                >
                                    {isPro ? "Pro plan" : "Free plan"}
                                </Badge>
                                <Button
                                    size="sm"
                                    className="hidden bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:from-emerald-600 hover:to-teal-700 sm:inline-flex lg:hidden"
                                    onClick={handleNewEventClick}
                                >
                                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                                    New event
                                </Button>
                                <div className="hidden lg:block">
                                    <UserMenu user={session?.user as UserInfo | undefined} compact />
                                </div>
                            </div>
                        </div>
                    </header>

                    <main className="flex-1">
                        <div className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6 lg:px-8 lg:py-8">
                            {children}
                        </div>
                    </main>
                </div>
            </div>
        </div>
    );
}
