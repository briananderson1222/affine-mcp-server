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

function yArrayToJS(arr: Y.Array<any>): any[] {
  const result: any[] = [];
  for (let i = 0; i < arr.length; i++) {
    result.push(arr.get(i));
  }
  return result;
}

interface Tag {
  id: string;
  name: string;
  color: string;
  createDate?: number;
}

interface TagMap extends Map<string, { name: string; color: string }> {}

export function registerTagTools(
  server: McpServer,
  gql: GraphQLClient,
  defaults: { workspaceId?: string }
): void {
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

  function getTagOptions(meta: Y.Map<any>): Y.Array<any> | null {
    const properties = meta.get("properties");
    if (!properties || !(properties instanceof Y.Map)) return null;
    const tags = properties.get("tags");
    if (!tags || !(tags instanceof Y.Map)) return null;
    const options = tags.get("options");
    if (options instanceof Y.Array) return options;
    return null;
  }

  function getOrCreateTagOptions(meta: Y.Map<any>): Y.Array<any> {
    let properties = meta.get("properties");
    if (!properties) { properties = new Y.Map(); meta.set("properties", properties); }
    let tags = properties.get("tags");
    if (!tags) { tags = new Y.Map(); properties.set("tags", tags); }
    let options = tags.get("options");
    if (!(options instanceof Y.Array)) {
      options = new Y.Array();
      tags.set("options", options);
    }
    return options;
  }

  interface PageEntryResult {
    pages: Y.Array<any>;
    entry: Y.Map<any>;
    index: number;
  }

  function findPageEntry(meta: Y.Map<any>, docId: string): PageEntryResult | null {
    const pages = meta.get("pages");
    if (!pages || !(pages instanceof Y.Array)) return null;
    const pagesArray = yArrayToJS(pages);
    for (let i = 0; i < pagesArray.length; i++) {
      const entry = pagesArray[i];
      if (entry && entry.get && entry.get("id") === docId) {
        return { pages, entry, index: i };
      }
    }
    return null;
  }

  // list_tags
  const listTagsHandler = async (parsed: any) => {
    const workspaceId = parsed.workspaceId || defaults.workspaceId;
    if (!workspaceId) throw new Error("workspaceId is required");
    const { endpoint, cookie } = await getConnectionInfo();
    const wsUrl = wsUrlFromGraphQLEndpoint(endpoint);
    const socket = await connectWorkspaceSocket(wsUrl, cookie);
    try {
      await joinWorkspace(socket, workspaceId);
      const wsDoc = await loadWorkspaceRoot(socket, workspaceId);
      const meta = wsDoc.getMap("meta");
      const tagOptions = getTagOptions(meta);
      const tags = tagOptions ? yArrayToJS(tagOptions).filter((t: any) => t).map((tag: any) => ({
        id: tag.id || "",
        name: tag.value || tag.name || "",
        color: tag.color || "",
        createDate: tag.createDate
      })) : [];
      return text(tags);
    } finally { socket.disconnect(); }
  };

  // get_doc_tags
  const getDocTagsHandler = async (parsed: any) => {
    const workspaceId = parsed.workspaceId || defaults.workspaceId;
    if (!workspaceId) throw new Error("workspaceId is required");
    const { endpoint, cookie } = await getConnectionInfo();
    const wsUrl = wsUrlFromGraphQLEndpoint(endpoint);
    const socket = await connectWorkspaceSocket(wsUrl, cookie);
    try {
      await joinWorkspace(socket, workspaceId);
      const wsDoc = await loadWorkspaceRoot(socket, workspaceId);
      const meta = wsDoc.getMap("meta");
      const tagOptions = getTagOptions(meta);
      const tagMap = new Map<string, { name: string; color: string }>();
      if (tagOptions) {
        for (const tag of yArrayToJS(tagOptions)) {
          if (tag && tag.id) tagMap.set(tag.id, { name: tag.value || tag.name || "", color: tag.color || "" });
        }
      }
      const pageInfo = findPageEntry(meta, parsed.docId);
      if (!pageInfo) return text({ docId: parsed.docId, tags: [], error: "Document not found" });
      const docTags = pageInfo.entry.get("tags");
      const docTagIds = docTags instanceof Y.Array ? yArrayToJS(docTags) : [];
      const resolved = docTagIds.map((tagId: string) => ({
        id: tagId,
        name: tagMap.get(tagId)?.name || "unknown",
        color: tagMap.get(tagId)?.color || ""
      }));
      return text({ docId: parsed.docId, tags: resolved });
    } finally { socket.disconnect(); }
  };

  // add_tag
  const addTagHandler = async (parsed: any) => {
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

      const tagOptions = getOrCreateTagOptions(meta);
      const existingTags = yArrayToJS(tagOptions);
      let tagId: string | null = null;
      let existingColor = "";
      for (const tag of existingTags) {
        if (tag && (tag.value === parsed.tagName || tag.name === parsed.tagName)) {
          tagId = tag.id;
          existingColor = tag.color;
        }
      }

      if (!tagId) {
        tagId = generateId();
        const tagObj = { id: tagId, value: parsed.tagName, color: parsed.color || randomTagColor(), createDate: Date.now(), updateDate: Date.now() };
        tagOptions.push([tagObj]);
      }

      const pageInfo = findPageEntry(meta, parsed.docId);
      if (!pageInfo) throw new Error("Document not found");
      let docTags = pageInfo.entry.get("tags");
      if (!(docTags instanceof Y.Array)) { docTags = new Y.Array(); pageInfo.entry.set("tags", docTags); }
      const existingDocTags = yArrayToJS(docTags);
      let alreadyTagged = existingDocTags.includes(tagId);
      if (!alreadyTagged) docTags.push([tagId]);

      const delta = Y.encodeStateAsUpdate(wsDoc, prevSV);
      await pushDocUpdate(socket, workspaceId, workspaceId, Buffer.from(delta).toString("base64"));
      return text({ tagId, tagName: parsed.tagName, docId: parsed.docId, created: !alreadyTagged, alreadyTagged, color: existingColor || parsed.color || randomTagColor() });
    } finally { socket.disconnect(); }
  };

  // remove_tag
  const removeTagHandler = async (parsed: any) => {
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
      if (!pageInfo) throw new Error("Document not found");
      const docTags = pageInfo.entry.get("tags");
      if (!(docTags instanceof Y.Array)) return text({ docId: parsed.docId, tagId: parsed.tagId, removed: false });
      const existingTags = yArrayToJS(docTags);
      const newTags = new Y.Array();
      let found = false;
      for (const id of existingTags) {
        if (id !== parsed.tagId) newTags.push([id]); else found = true;
      }
      pageInfo.entry.set("tags", newTags);
      const delta = Y.encodeStateAsUpdate(wsDoc, prevSV);
      await pushDocUpdate(socket, workspaceId, workspaceId, Buffer.from(delta).toString("base64"));
      return text({ docId: parsed.docId, tagId: parsed.tagId, removed: found });
    } finally { socket.disconnect(); }
  };

  // create_tag
  const createTagHandler = async (parsed: any) => {
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

      const tagOptions = getOrCreateTagOptions(meta);
      const existingTags = yArrayToJS(tagOptions);
      let tagId: string | null = null;
      for (const tag of existingTags) {
        if (tag && (tag.value === parsed.tagName || tag.name === parsed.tagName)) {
          tagId = tag.id;
        }
      }

      if (tagId) {
        return text({ tagId, tagName: parsed.tagName, created: false, alreadyExists: true });
      }

      tagId = generateId();
      const tagObj = { id: tagId, value: parsed.tagName, color: parsed.color || randomTagColor(), createDate: Date.now(), updateDate: Date.now() };
      tagOptions.push([tagObj]);

      const delta = Y.encodeStateAsUpdate(wsDoc, prevSV);
      await pushDocUpdate(socket, workspaceId, workspaceId, Buffer.from(delta).toString("base64"));
      return text({ tagId, tagName: parsed.tagName, created: true, color: tagObj.color });
    } finally { socket.disconnect(); }
  };

  // update_tag
  const updateTagHandler = async (parsed: any) => {
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
      const tagOptions = getTagOptions(meta);

      if (!tagOptions) {
        return text({ tagId: parsed.tagId, updated: false, error: "No tag options found" });
      }

      let foundIdx = -1;
      for (let i = 0; i < tagOptions.length; i++) {
        const tag = tagOptions.get(i);
        if (tag && tag.id === parsed.tagId) {
          foundIdx = i;
          break;
        }
      }

      if (foundIdx === -1) {
        return text({ tagId: parsed.tagId, updated: false, error: "Tag not found" });
      }

      const current = tagOptions.get(foundIdx);
      const updated = {
        ...current,
        name: parsed.name ?? current.name ?? current.value,
        value: parsed.name ?? current.value ?? current.name,
        color: parsed.color ?? current.color,
        updateDate: Date.now(),
      };

      tagOptions.delete(foundIdx, 1);
      tagOptions.insert(foundIdx, [updated]);

      const delta = Y.encodeStateAsUpdate(wsDoc, prevSV);
      await pushDocUpdate(socket, workspaceId, workspaceId, Buffer.from(delta).toString("base64"));
      return text({ tagId: parsed.tagId, updated: true });
    } finally { socket.disconnect(); }
  };

  // delete_tag (globally remove a tag from workspace + all docs)
  const deleteTagHandler = async (parsed: any) => {
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
      const tagOptions = getTagOptions(meta);

      if (!tagOptions) {
        return text({ tagId: parsed.tagId, deleted: false, error: "No tag options found" });
      }

      // Find and remove the tag definition
      let foundIdx = -1;
      for (let i = 0; i < tagOptions.length; i++) {
        const tag = tagOptions.get(i);
        if (tag && tag.id === parsed.tagId) {
          foundIdx = i;
          break;
        }
      }

      if (foundIdx === -1) {
        return text({ tagId: parsed.tagId, deleted: false, error: "Tag not found" });
      }

      tagOptions.delete(foundIdx, 1);

      // Remove the tag from all documents that reference it
      const pages = meta.get("pages");
      let docsUpdated = 0;
      if (pages && pages instanceof Y.Array) {
        const pagesArray = yArrayToJS(pages);
        for (const entry of pagesArray) {
          if (!entry || !entry.get) continue;
          const docTags = entry.get("tags");
          if (!(docTags instanceof Y.Array)) continue;
          const existing = yArrayToJS(docTags);
          if (existing.includes(parsed.tagId)) {
            const newTags = new Y.Array();
            for (const id of existing) {
              if (id !== parsed.tagId) newTags.push([id]);
            }
            entry.set("tags", newTags);
            docsUpdated++;
          }
        }
      }

      const delta = Y.encodeStateAsUpdate(wsDoc, prevSV);
      await pushDocUpdate(socket, workspaceId, workspaceId, Buffer.from(delta).toString("base64"));
      return text({ tagId: parsed.tagId, deleted: true, docsUpdated });
    } finally { socket.disconnect(); }
  };

  // Register tools
  server.registerTool("list_tags", {
    title: "List Tags",
    description: "List all tags defined in a workspace",
    inputSchema: { workspaceId: WorkspaceId.optional() },
  }, listTagsHandler);

  server.registerTool("get_doc_tags", {
    title: "Get Document Tags",
    description: "Get tags assigned to a specific document",
    inputSchema: { workspaceId: WorkspaceId.optional(), docId: DocId },
  }, getDocTagsHandler);

  server.registerTool("add_or_create_doc_tag", {
    title: "Add or Create Document Tag",
    description: "Add a tag to a document. Creates the tag if it doesn't exist.",
    inputSchema: {
      workspaceId: WorkspaceId.optional(),
      docId: DocId,
      tagName: z.string().min(1, "tagName required"),
      color: z.string().optional(),
    },
  }, addTagHandler);

  server.registerTool("remove_doc_tag", {
    title: "Remove Tag from Document",
    description: "Remove a tag from a document (the tag definition remains in the workspace)",
    inputSchema: { workspaceId: WorkspaceId.optional(), docId: DocId, tagId: z.string().min(1, "tagId required") },
  }, removeTagHandler);

  server.registerTool("delete_tag", {
    title: "Delete Tag",
    description: "Permanently delete a tag from the workspace and remove it from all documents",
    inputSchema: { workspaceId: WorkspaceId.optional(), tagId: z.string().min(1, "tagId required") },
  }, deleteTagHandler);

  server.registerTool("create_tag", {
    title: "Create Tag",
    description: "Create a new tag definition without attaching to a document",
    inputSchema: {
      workspaceId: WorkspaceId.optional(),
      tagName: z.string().min(1, "tagName required"),
      color: z.string().optional(),
    },
  }, createTagHandler);

  server.registerTool("update_tag", {
    title: "Update Tag",
    description: "Update an existing tag's name or color",
    inputSchema: {
      workspaceId: WorkspaceId.optional(),
      tagId: z.string().min(1, "tagId required"),
      name: z.string().optional(),
      color: z.string().optional(),
    },
  }, updateTagHandler);
}
