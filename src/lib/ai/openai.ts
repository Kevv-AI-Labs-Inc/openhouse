/**
 * Azure OpenAI client singleton.
 */

type ChatMessageContentPart =
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } };

interface ChatMessage {
    role: "system" | "user" | "assistant";
    content: string | ChatMessageContentPart[];
}

interface ChatCompletionOptions {
    messages: ChatMessage[];
    maxTokens?: number;
    temperature?: number;
    responseFormat?: "json" | "text";
}

const DEFAULT_AZURE_DEPLOYMENT = "gpt-5-mini";

function supportsCustomTemperature(deployment: string) {
    return !/^gpt-5/i.test(deployment);
}

export function getAiDeploymentName() {
    return process.env.AZURE_OPENAI_DEPLOYMENT || DEFAULT_AZURE_DEPLOYMENT;
}

export function hasAiConfiguration() {
    return Boolean(process.env.AZURE_OPENAI_ENDPOINT && process.env.AZURE_OPENAI_API_KEY);
}

export async function chatCompletion(options: ChatCompletionOptions): Promise<{
    content: string;
    tokensUsed: number;
}> {
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
    const apiKey = process.env.AZURE_OPENAI_API_KEY;
    const deployment = getAiDeploymentName();

    if (!endpoint || !apiKey) {
        throw new Error("Azure OpenAI credentials not configured");
    }

    const url = `${endpoint.replace(/\/+$/, "")}/openai/deployments/${deployment}/chat/completions?api-version=2024-08-01-preview`;

    const body: Record<string, unknown> = {
        messages: options.messages,
        max_completion_tokens: options.maxTokens || 1000,
    };

    if (supportsCustomTemperature(deployment)) {
        body.temperature = options.temperature ?? 0.7;
    }

    if (options.responseFormat === "json") {
        body.response_format = { type: "json_object" };
    }

    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "api-key": apiKey,
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Azure OpenAI error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    const choice = data.choices?.[0];
    const tokensUsed =
        data.usage?.total_tokens ??
        data.usage?.output_tokens ??
        (typeof data.usage?.prompt_tokens === "number" &&
            typeof data.usage?.completion_tokens === "number"
            ? data.usage.prompt_tokens + data.usage.completion_tokens
            : 0);

    const responseContent = choice?.message?.content;

    if (typeof responseContent === "string") {
        return {
            content: responseContent,
            tokensUsed,
        };
    }

    if (Array.isArray(responseContent)) {
        const textContent = responseContent
            .map((item: unknown) => {
                if (
                    item &&
                    typeof item === "object" &&
                    "type" in item &&
                    item.type === "text" &&
                    "text" in item &&
                    typeof item.text === "string"
                ) {
                    return item.text;
                }

                return "";
            })
            .join("\n")
            .trim();

        return {
            content: textContent,
            tokensUsed,
        };
    }

    return {
        content: "",
        tokensUsed,
    };
}
