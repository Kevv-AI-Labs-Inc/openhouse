import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import LandingPage from "@/components/landing-page";
import { absoluteUrl, siteConfig } from "@/lib/site";

const homeTitle = "MLS-to-Share-Page Platform for Modern Open House Teams";
const homeDescription =
  "OpenHouse helps agents import a listing, launch one reusable share page, capture open house and long-tail buyer inquiries, then package the results into seller-ready reporting.";

const faqItems = [
  {
    question: "Can I run this at an in-person open house without a separate app?",
    answer: "Yes. Visitors can sign in through mobile web or kiosk mode using a QR link.",
  },
  {
    question: "Do I need Pro to score leads?",
    answer:
      "Free includes unlimited listing launches, branded sign-in pages, and core reporting. Your first 3 published launches also include Pro features so you can trial AI scoring, property Q&A after contact capture, and automated follow-up before upgrading.",
  },
  {
    question: "Does the platform replace legal or compliance review?",
    answer:
      "No. OpenHouse accelerates drafts and prioritization. Agents should review outbound content before publishing.",
  },
];

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: siteConfig.legalName,
  url: absoluteUrl("/"),
  logo: absoluteUrl("/icon.svg"),
  areaServed: siteConfig.areaServed,
  contactPoint: [
    {
      "@type": "ContactPoint",
      contactType: "customer support",
      email: siteConfig.supportEmail,
      availableLanguage: ["English"],
    },
  ],
};

const softwareSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: siteConfig.legalName,
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  offers: [
    {
      "@type": "Offer",
      name: "Free",
      price: "0",
      priceCurrency: "USD",
      category: "Free",
    },
    {
      "@type": "Offer",
      name: "Pro",
      price: "29",
      priceCurrency: "USD",
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        billingDuration: 1,
        billingIncrement: 1,
        unitCode: "MON",
      },
    },
  ],
  description: homeDescription,
  url: absoluteUrl("/"),
  areaServed: siteConfig.areaServed,
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqItems.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: item.answer,
    },
  })),
};

export const metadata: Metadata = {
  title: homeTitle,
  description: homeDescription,
  keywords: siteConfig.keywords,
  alternates: {
    canonical: absoluteUrl("/"),
  },
  openGraph: {
    type: "website",
    url: absoluteUrl("/"),
    title: `${siteConfig.name} | ${homeTitle}`,
    description: homeDescription,
    images: [
      {
        url: absoluteUrl("/opengraph-image"),
        width: 1200,
        height: 630,
        alt: `${siteConfig.legalName} Open Graph preview`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${siteConfig.name} | ${homeTitle}`,
    description: homeDescription,
    images: [absoluteUrl("/twitter-image")],
  },
};

export default async function HomePage() {
  const session = await auth();
  const isAuthenticated = Boolean(session?.user?.id);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <LandingPage isAuthenticated={isAuthenticated} />
    </>
  );
}
