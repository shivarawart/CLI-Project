import { tool } from "ai";
import { z } from "zod";
import FirecrawlApp from "@mendable/firecrawl-js";

import type { ActionTracker } from "../agent/action-tracker";

let client: FirecrawlApp | null = null;

function getClient(): FirecrawlApp {
  if (client) {
    return client;
  }

  const apiKey = process.env.FIRECRAWL_WEBSEARCH;

  if (!apiKey) {
    throw new Error(
      "FIRECRAWL_WEBSEARCH is not defined in environment variables"
    );
  }

  client = new FirecrawlApp({
    apiKey,
  });

  return client;
}

function clip(text: string, maxLength = 8000): string {
  return text.length > maxLength
    ? text.slice(0, maxLength) + "\n\n...[truncated]"
    : text;
}

function logWebAction(
  tracker: ActionTracker,
  toolName: string,
  target: string,
  output: string
): void {
  tracker.log({
    type: "code_analysis",
    path: `${toolName}:${target}`,
    details: {
      after: clip(output),
      toolName,
    },
    status: "executed",
  });
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs = 30_000
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(
        () =>
          reject(
            new Error(
              `Operation timed out after ${timeoutMs}ms`
            )
          ),
        timeoutMs
      )
    ),
  ]);
}

export function createWebTools(
  tracker: ActionTracker
) {
  return {
    web_search: tool({
      description:
        "Search the web and return relevant results.",

      inputSchema: z.object({
        query: z.string().min(2),

        limit: z
          .number()
          .int()
          .min(1)
          .max(10)
          .default(5),
      }),

      execute: async ({ query, limit }) => {
        const result = await withTimeout(
          getClient().search(query, {
            limit,
          })
        );

        const items = (
          (result as any).web ?? []
        ).slice(0, limit);

        const output =
          items.length > 0
            ? items
                .map(
                  (
                    item: any,
                    index: number
                  ) =>
                    [
                      `${index + 1}. ${item.title ?? "Untitled"}`,
                      item.url ?? "",
                      item.description ?? "",
                    ]
                      .filter(Boolean)
                      .join("\n")
                )
                .join("\n\n")
            : "(no results found)";

        logWebAction(
          tracker,
          "web_search",
          query,
          output
        );

        return clip(output);
      },
    }),

    web_crawl: tool({
      description:
        "Crawl a webpage and return markdown content.",

      inputSchema: z.object({
        url: z.string().url(),
      }),

      execute: async ({ url }) => {
        const result = await withTimeout(
          getClient().scrape(url, {
            formats: ["markdown"],
          })
        );

        const markdown =
          (result as { markdown?: string })
            .markdown ?? "";

        const output =
          clip(markdown) || "(empty page)";

        logWebAction(
          tracker,
          "web_crawl",
          url,
          output
        );

        return output;
      },
    }),

    fetch_url: tool({
      description:
        "Fetch a URL and return its cleaned markdown content.",

      inputSchema: z.object({
        url: z.string().url(),
      }),

      execute: async ({ url }) => {
        const result = await withTimeout(
          getClient().scrape(url, {
            formats: ["markdown"],
          })
        );

        const markdown =
          (result as { markdown?: string })
            .markdown ?? "";

        const output =
          clip(markdown) || "(empty page)";

        logWebAction(
          tracker,
          "fetch_url",
          url,
          output
        );

        return output;
      },
    }),
  };
}