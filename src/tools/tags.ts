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
    let properties = meta.get("properties") as Y.Map<any> | undefined;
    if (!properties) { properties = new Y.Map(); meta.set("properties", properties); }
    let tags = properties.get("tags") as Y.Map<any> | undefined;
    if (!tags) { tags = new Y.Map(); properties.set("tags", tags); }
    let options = tags.get("options");
    if (!(options instanceof Y.Array)) {
      options = new Y.Array();
      tags.set("options", options);
    }
    return options as Y.Array<any>;
  }

  function getCollections(wsDoc: Y.Doc): Y.Array<any> | null {
    const setting = wsDoc.getMap("setting");
    if (!setting || !(setting instanceof Y.Map)) return null;
    const collections = setting.get("collections");
    if (collections instanceof Y.Array) return collections;
    return null;
  }

  function findPageEntry(meta: Y.Map<any>, docId: string) {
    const pages = meta.get("pages");
    if (!pages || !(pages instanceof Y.Array)) return null;
    const pagesArray = yArrayToJS(pages) as any[];
    for (let i = 0; i < pagesArray.length; i++) {
      const entry = pagesArray[i];
      if (entry && entry.get && entry.get("id") === docId) {
        return { pages, entry, index: i };
      }
    }
    return null;
  }

  server.registerTool(
    "list_tags",
    {
      title: "List Tags",
      description: "List all tags defined in a workspace",
      inputSchema: { workspaceId: WorkspaceId.optional() },
    },
    async (parsed) => {
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
        const tags = tagOptions ? yArrayToJS(tagOptions).filter(t => t).map(tag => ({
          id: tag.id || "",
          name: tag.value || tag.name || "",
          color: tag.color || "",
          createDate: tag.createDate
        })) : [];
        return text(tags);
      } finally { socket.disconnect(); }
    } as any
  );

  server.registerTool(
    "get_doc_tags",
    {
      title: "Get Document Tags",
      description: "Get tags assigned to a specific document",
      inputSchema: { workspaceId: WorkspaceId.optional(), docId: DocId },
    },
    async (parsed) => {
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
        const tagMap = new Map<string, {name:string, color:string}>();
        if (tagOptions) {
          for (const tag of yArrayToJS(tagOptions)) {
            if (tag && tag.id) tagMap.set(tag.id, { name: tag.value || tag.name || "", color: tag.color || "" });
          }
        }
        const pageInfo = findPageEntry(meta, parsed.docId);
        if (!pageInfo) return text({ docId: parsed.docId, tags: [], error: "Document not found" });
        const docTags = pageInfo.entry.get("tags");
        const docTagIds = docTags instanceof Y.Array ? yArrayToJS(docTags) as string[] : [];
        const resolved = docTagIds.map(tagId => ({
          id: tagId,
          name: tagMap.get(tagId)?.name || "unknown",
          color: tagMap.get(tagId)?.color || ""
        }));
        return text({ docId: parsed.docId, tags: resolved });
      } finally { socket.disconnect(); }
    } as any
  );

  server.registerTool(
    "add_tag",
    {
      title: "Add Tag to Document",
      description: "Add a tag to a document. Creates the tag if it doesn't exist.",
      inputSchema: {
        workspaceId: WorkspaceId.optional(),
        docId: DocId,
        tagName: z.string().min(1, "tagName required"),
        color: z.string().optional(),
      },
    },
    async (parsed) => {
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
        const existingDocTags = yArrayToJS(docTags) as string[];
        let alreadyTagged = existingDocTags.includes(tagId);
        if (!alreadyTagged) (docTags as Y.Array<string>).push([tagId]);

        const delta = Y.encodeStateAsUpdate(wsDoc, prevSV);
        await pushDocUpdate(socket, workspaceId, workspaceId, Buffer.from(delta).toString("base64"));
        return text({ tagId, tagName: parsed.tagName, docId: parsed.docId, created: !alreadyTagged, alreadyTagged, color: existingColor || parsed.color || randomTagColor() });
      } finally { socket.disconnect(); }
    } as any
  );

  server.registerTool(
    "remove_tag",
    {
      title: "Remove Tag from Document",
      description: "Remove a tag from a document",
      inputSchema: { workspaceId: WorkspaceId.optional(), docId: DocId, tagId: z.string().min(1, "tagId required") },
    },
    async (parsed) => {
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
        const existingTags = yArrayToJS(docTags) as string[];
        const newTags = new Y.Array<string>();
        let found = false;
        for (const id of existingTags) {
          if (id !== parsed.tagId) newTags.push([id]); else found = true;
        }
        pageInfo.entry.set("tags", newTags);
        const delta = Y.encodeStateAsUpdate(wsDoc, prevSV);
        await pushDocUpdate(socket, workspaceId, workspaceId, Buffer.from(delta).toString("base64"));
        return text({ docId: parsed.docId, tagId: parsed.tagId, removed: found });
      } finally { socket.disconnect(); }
    } as any
  );

  server.registerTool(
    "list_collections",
    {
      title: "List Collections",
      description: "List all collections in a workspace",
      inputSchema: { workspaceId: WorkspaceId.optional() },
    },
    async (parsed) => {
      const workspaceId = parsed.workspaceId || defaults.workspaceId;
      if (!workspaceId) throw new Error("workspaceId is required");
      const { endpoint, cookie } = await getConnectionInfo();
      const wsUrl = wsUrlFromGraphQLEndpoint(endpoint);
      const socket = await connectWorkspaceSocket(wsUrl, cookie);
      try {
        await joinWorkspace(socket, workspaceId);
        const wsDoc = await loadWorkspaceRoot(socket, workspaceId);
        const collections = getCollections(wsDoc);
        const result = collections ? yArrayToJS(collections).filter(c => c).map(col => ({
          id: col.id || "", name: col.name || "", rules: col.rules || { filters: [] }, allowList: col.allowList || []
        })) : [];
        return text(result);
      } finally { socket.disconnect(); }
    } as any
  );

  server.registerTool(
    "create_collection",
    {
      title: "Create Collection",
      description: "Create a new collection in the workspace",
      inputSchema: { workspaceId: WorkspaceId.optional(), name: z.string().min(1, "name required"), filters: z.array(z.any()).optional() },
    },
    async (parsed) => {
      const workspaceId = parsed.workspaceId || defaults.workspaceId;
      if (!workspaceId) throw new Error("workspaceId is required");
      const { endpoint, cookie } = await getConnectionInfo();
      const wsUrl = wsUrlFromGraphQLEndpoint(endpoint);
      const socket = await connectWorkspaceSocket(wsUrl, cookie);
      try {
        await joinWorkspace(socket, workspaceId);
        const wsDoc = await loadWorkspaceRoot(socket, workspaceId);
        const prevSV = Y.encodeStateVector(wsDoc);
        let setting = wsDoc.getMap("setting") as Y.Map<any> | undefined;
        if (!setting) { setting = new Y.Map(); wsDoc.getMap("root").set("setting", setting); }
        let collections = setting.get("collections") as Y.Array<any> | undefined;
        if (!collections) { collections = new Y.Array(); setting.set("collections", collections); }
        const newId = generateId();
        (collections as Y.Array).push([{ id: newId, name: parsed.name, rules: { filters: parsed.filters || [] }, allowList: [] }]);
        const delta = Y.encodeStateAsUpdate(wsDoc, prevSV);
        await pushDocUpdate(socket, workspaceId, workspaceId, Buffer.from(delta).toString("base64"));
        return text({ id: newId, name: parsed.name, created: true });
      } finally { socket.disconnect(); }
    } as any
  );
}