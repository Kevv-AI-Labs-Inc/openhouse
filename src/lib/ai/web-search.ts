export type WebSearchResult = {
  title: string;
  url: string;
  snippet: string;
};

type SearchPublicWebOptions = {
  includeDomains?: string[];
};

type TavilyResponse = {
  results?: Array<{
    title?: string;
    url?: string;
    content?: string;
  }>;
};

export function hasWebSearchConfiguration() {
  return Boolean(process.env.TAVILY_API_KEY);
}

export async function searchPublicWeb(
  query: string,
  options: SearchPublicWebOptions = {}
): Promise<WebSearchResult[]> {
  const apiKey = process.env.TAVILY_API_KEY;

  if (!apiKey) {
    return [];
  }

  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      query,
      topic: "general",
      search_depth: "basic",
      max_results: 5,
      include_answer: false,
      include_raw_content: false,
      include_domains: options.includeDomains?.length ? options.includeDomains : undefined,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Web search error ${response.status}: ${errorText}`);
  }

  const payload = (await response.json()) as TavilyResponse;

  return (payload.results ?? [])
    .map((item) => ({
      title: item.title?.trim() || item.url?.trim() || "Untitled result",
      url: item.url?.trim() || "",
      snippet: item.content?.trim() || "",
    }))
    .filter((item) => item.url && item.snippet)
    .slice(0, 5);
}
