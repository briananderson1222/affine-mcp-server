import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { GraphQLClient } from "../graphqlClient.js";
import { text } from "../util/mcp.js";
import {
  wsUrlFromGraphQLEndpoint,
  connectWorkspaceSocket,
  joinWorkspace,
  loadDoc,
  pushDocUpdate,
} from "../ws.js";
import * as Y from "yjs";

const WorkspaceId = z.string().min(1, "workspaceId required");
const DocId = z.string().min(1, "docId required");

function generateId(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";
  let id = "";
  for (let i = 0; i < 10; i++) id += chars.charAt(Math.floor(Math.random() * chars.length));
  return id;
}

function randomTagColor(): string {
  const colors = ["#ff6b6b", "#4ecdc4", "#45b7d1", "#96ceb4", "#ffeaa7", "#dfe6e9", "#a29bfe", "#fd79a8"];
  return colors[Math.floor(Math.random() * colors.length)];
}

export function registerTagTools(
  server: McpServer,
  gql: GraphQLClient,
  defaults: { workspaceId?: string }
) {
  async function getConnectionInfo() {
    const endpoint = (gql as any).endpoint || process.env.AFFINE_BASE_URL + "/graphql";
    const headers = (gql as any).headers || {};
    const cookie = (gql as any).cookie || headers.Cookie || "";
    return { endpoint, cookie };
  }

  async function loadWorkspaceRoot(socket: any, workspaceId: string) {
    const wsDoc = new Y.Doc();
    const snapshot = await loadDoc(socket, workspaceId, workspaceId);
    if (snapshot.missing) {
      Y.applyUpdate(wsDoc, Buffer.from(snapshot.missing, "base64"));
    }
    return wsDoc;
  }

  function getTagDefinitions(meta: Y.Map<any>): Y.Map<any> {
    let properties = meta.get("properties") as Y.Map<any> | undefined;
    if (!properties) {
      properties = new Y.Map();
      meta.set("properties", properties);
    }
    let tags = properties.get("tags") as Y.Map<any> | undefined;
    if (!tags) {
      tags = new Y.Map();
      properties.set("tags", tags);
    }
    return tags;
  }

  function findPageEntry(meta: Y.Map<any>, docId: string): { pages: Y.Array<any>; entry: Y.Map<any>; index: number } | null {
    const pages = meta.get("pages") as Y.Array<Y.Map<any>> | undefined;
    if (!pages) return null;
    let found: { pages: Y.Array<any>; entry: Y.Map<any>; index: number } | null = null;
    pages.forEach((entry: any, i: number) => {
      if (found) return;
      if (entry.get && entry.get("id") === docId) {
        found = { pages, entry, index: i };
      }
    });
    return found;
  }

  const listTagsHandler = async (parsed: { workspaceId?: string }) => {
    const workspaceId = parsed.workspaceId || defaults.workspaceId;
    if (!workspaceId) throw new Error("workspaceId is required");

    const { endpoint, cookie } = await getConnectionInfo();
    const wsUrl = wsUrlFromGraphQLEndpoint(endpoint);
    const socket = await connectWorkspaceSocket(wsUrl, cookie);
    try {
      await joinWorkspace(socket, workspaceId);
      const wsDoc = await loadWorkspaceRoot(socket, workspaceId);
      const meta = wsDoc.getMap("meta");
      const tagsMap = getTagDefinitions(meta);

      const tags: Array<{ id: string; name: string; color: string; createDate?: number }> = [];
      for (const [id, value] of tagsMap) {
        const tag = value as Y.Map<any>;
        if (tag?.get) {
          tags.push({
            id: tag.get("id") || id,
            name: tag.get("value") || "",
            color: tag.get("color") || "",
            createDate: tag.get("createDate"),
          });
        }
      }
      return text(tags);
    } finally {
      socket.disconnect();
    }
  };

  const getDocTagsHandler = async (parsed: { workspaceId?: string; docId: string }) => {
    const workspaceId = parsed.workspaceId || defaults.workspaceId;
    if (!workspaceId) throw new Error("workspaceId is required");

    const { endpoint, cookie } = await getConnectionInfo();
    const wsUrl = wsUrlFromGraphQLEndpoint(endpoint);
    const socket = await connectWorkspaceSocket(wsUrl, cookie);
    try {
      await joinWorkspace(socket, workspaceId);
      const wsDoc = await loadWorkspaceRoot(socket, workspaceId);
      const meta = wsDoc.getMap("meta");
      const tagsMap = getTagDefinitions(meta);

      const pageInfo = findPageEntry(meta, parsed.docId);
      if (!pageInfo) {
        return text({ docId: parsed.docId, tags: [], error: "Document not found in workspace pages list" });
      }

      const tagIds: string[] = [];
      const docTags = pageInfo.entry.get("tags");
      if (docTags instanceof Y.Array) {
        docTags.forEach((id: string) => tagIds.push(id));
      }

      const resolved = tagIds.map((tagId) => {
        const tagDef = tagsMap.get(tagId) as Y.Map<any> | undefined;
        return {
          id: tagId,
          name: tagDef?.get?.("value") || "unknown",
          color: tagDef?.get?.("color") || "",
        };
      });

      return text({ docId: parsed.docId, tags: resolved });
    } finally {
      socket.disconnect();
    }
  };

  const addTagHandler = async (parsed: { workspaceId?: string; docId: string; tagName: string; color?: string }) => {
    const workspaceId = parsed.workspaceId || defaults.workspaceId;
    if (!workspaceId) throw new Error("workspaceId is required");

    const { endpoint, cookie } = await getConnectionInfo();
    const wsUrl = wsUrlFromGraphQLEndpoint(endpoint);
    const socket = await connectWorkspaceSocket(wsUrl, cookie);
    try {
      await joinWorkspace(socket, workspaceId);
      const wsDoc = await loadWorkspaceRoot(socket, workspaceId);
      const prevSV = Y.encodeStateVector(wsDoc);
      const meta = wsDoc.getMap("meta");
      const tagsMap = getTagDefinitions(meta);

      let tagId: string | null = null;
      for (const [id, value] of tagsMap) {
        const tag = value as Y.Map<any>;
        if (tag?.get?.("value") === parsed.tagName) {
          tagId = tag.get("id") || id;
          break;
        }
      }

      if (!tagId) {
        tagId = generateId();
        const tagDef = new Y.Map();
        tagDef.set("id", tagId);
        tagDef.set("value", parsed.tagName);
        tagDef.set("color", parsed.color || randomTagColor());
        tagDef.set("createDate", Date.now());
        tagsMap.set(tagId, tagDef);
      }

      const pageInfo = findPageEntry(meta, parsed.docId);
      if (!pageInfo) {
        throw new Error(`Document ${parsed.docId} not found in workspace pages list`);
      }

      let docTags = pageInfo.entry.get("tags");
      if (!(docTags instanceof Y.Array)) {
        docTags = new Y.Array();
        pageInfo.entry.set("tags", docTags);
      }

      let alreadyTagged = false;
      (docTags as Y.Array<string>).forEach((id: string) => {
        if (id === tagId) alreadyTagged = true;
      });

      if (!alreadyTagged) {
        (docTags as Y.Array<string>).push([tagId]);
      }

      const delta = Y.encodeStateAsUpdate(wsDoc, prevSV);
      await pushDocUpdate(socket, workspaceId, workspaceId, Buffer.from(delta).toString("base64"));

      return text({
        tagId,
        tagName: parsed.tagName,
        docId: parsed.docId,
        created: !alreadyTagged,
        alreadyTagged,
      });
    } finally {
      socket.disconnect();
    }
  };

  const removeTagHandler = async (parsed: { workspaceId?: string; docId: string; tagId: string }) => {
    const workspaceId = parsed.workspaceId || defaults.workspaceId;
    if (!workspaceId) throw new Error("workspaceId is required");

    const { endpoint, cookie } = await getConnectionInfo();
    const wsUrl = wsUrlFromGraphQLEndpoint(endpoint);
    const socket = await connectWorkspaceSocket(wsUrl, cookie);
    try {
      await joinWorkspace(socket, workspaceId);
      const wsDoc = await loadWorkspaceRoot(socket, workspaceId);
      const prevSV = Y.encodeStateVector(wsDoc);
      const meta = wsDoc.getMap("meta");

      const pageInfo = findPageEntry(meta, parsed.docId);
      if (!pageInfo) {
        throw new Error(`Document ${parsed.docId} not found in workspace pages list`);
      }

      const docTags = pageInfo.entry.get("tags");
      if (!(docTags instanceof Y.Array)) {
        return text({ docId: parsed.docId, tagId: parsed.tagId, removed: false, error: "No tags on document" });
      }

      const newTags = new Y.Array<string>();
      let found = false;
      (docTags as Y.Array<string>).forEach((id: string) => {
        if (id !== parsed.tagId) {
          newTags.push([id]);
        } else {
          found = true;
        }
      });

      pageInfo.entry.set("tags", newTags);

      const delta = Y.encodeStateAsUpdate(wsDoc, prevSV);
      await pushDocUpdate(socket, workspaceId, workspaceId, Buffer.from(delta).toString("base64"));

      return text({
        docId: parsed.docId,
        tagId: parsed.tagId,
        removed: found,
      });
    } finally {
      socket.disconnect();
    }
  };

  server.registerTool(
    "list_tags",
    {
      title: "List Tags",
      description: "List all tags defined in a workspace",
      inputSchema: {
        workspaceId: WorkspaceId.optional(),
      },
    },
    listTagsHandler as any
  );

  server.registerTool(
    "get_doc_tags",
    {
      title: "Get Document Tags",
      description: "Get tags assigned to a specific document",
      inputSchema: {
        workspaceId: WorkspaceId.optional(),
        docId: DocId,
      },
    },
    getDocTagsHandler as any
  );

  server.registerTool(
    "add_tag",
    {
      title: "Add Tag to Document",
      description:
        "Add a tag to a document. Creates the tag if it doesn't exist. Uses existing tag if name matches.",
      inputSchema: {
        workspaceId: WorkspaceId.optional(),
        docId: DocId,
        tagName: z.string().min(1, "tagName required"),
        color: z.string().optional().describe("Tag color (e.g. #ff0000). Random if omitted."),
      },
    },
    addTagHandler as any
  );

  server.registerTool(
    "remove_tag",
    {
      title: "Remove Tag from Document",
      description: "Remove a tag from a document (does not delete the tag definition)",
      inputSchema: {
        workspaceId: WorkspaceId.optional(),
        docId: DocId,
        tagId: z.string().min(1, "tagId required"),
      },
    },
    removeTagHandler as any
  );
}