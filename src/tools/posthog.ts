import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { text } from "../util/mcp.js";

const API_KEY = "phc_JzGTNvOErubkhQCLSK2Nz1lGOBrq9z7Rc33NjPsfHYT";
const BASE_URL = "https://us.i.posthog.com";

export function registerPostHogTools(server: McpServer, defaults: { workspaceId?: string }) {

  // Capture an event
  server.registerTool("posthog_capture", {
    title: "PostHog Capture",
    description: "Send an event to PostHog analytics",
    inputSchema: {
      event: z.string().min(1, "event name required"),
      distinctId: z.string().min(1, "distinct_id required"),
      properties: z.record(z.any()).optional(),
      timestamp: z.string().optional(),
    },
  }, async (parsed) => {
    const payload = {
      api_key: API_KEY,
      event: parsed.event,
      distinct_id: parsed.distinctId,
      properties: parsed.properties || {},
      timestamp: parsed.timestamp || new Date().toISOString(),
    };

    try {
      const response = await fetch(`${BASE_URL}/capture`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        return text({ success: true, event: parsed.event, distinctId: parsed.distinctId });
      } else {
        const error = await response.text();
        return text({ success: false, error });
      }
    } catch (err: any) {
      return text({ success: false, error: err.message });
    }
  });

  // Query insights - using the /api/projects/:id/insights endpoint
  server.registerTool("posthog_insights", {
    title: "PostHog Insights",
    description: "Query PostHog analytics insights",
    inputSchema: {
      metric: z.enum(["pageviews", "sessions", "events", "actors"]).default("pageviews"),
      period: z.string().optional().describe("e.g., 24h, 7d, 30d"),
      limit: z.number().optional().default(10),
    },
  }, async (parsed) => {
    // PostHog requires authentication via header
    // For now, return instructions on how to set up proper auth
    return text({ 
      message: "PostHog insights require API key authentication via Personal API Key. To fully integrate, you need to:\n1. Go to PostHog → Settings → Personal API Keys\n2. Create a key with 'insights' and 'annotations' permissions\n3. Provide that key to update the MCP server\n\nFor now, you can use posthog_capture to track events from your site."});
  });
}