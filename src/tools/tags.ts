// @ts-nocheck
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

function generateId() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";
  let id = "";
  for (let i = 0; i < 10; i++) id += chars.charAt(Math.floor(Math.random() * chars.length));
  return id;
}

function randomTagColor() {
  const colors = ["#ff6b6b", "#4ecdc4", "#45b7d1", "#96ceb4", "#ffeaa7", "#dfe6e9", "#a29bfe", "#fd79a8"];
  return colors[Math.floor(Math.random() * colors.length)];
}

function yArrayToJS(arr) {
  const result = [];
  for (let i = 0; i < arr.length; i++) {
    result.push(arr.get(i));
  }
  return result;
}

export function registerTagTools(server, gql, defaults) {
  async function getConnectionInfo() {
    const endpoint = (gql.endpoint || process.env.AFFINE_BASE_URL + "/graphql");
    const headers = (gql.headers || {});
    const cookie = (gql.cookie || headers.Cookie || "");
    return { endpoint, cookie };
  }

  async function loadWorkspaceRoot(socket, workspaceId) {
    const wsDoc = new Y.Doc();
    const snapshot = await loadDoc(socket, workspaceId, workspaceId);
    if (snapshot.missing) {
      Y.applyUpdate(wsDoc, Buffer.from(snapshot.missing, "base64"));
    }
    return wsDoc;
  }

  function getTagOptions(meta) {
    const properties = meta.get("properties");
    if (!properties || !(properties instanceof Y.Map)) return null;
    const tags = properties.get("tags");
    if (!tags || !(tags instanceof Y.Map)) return null;
    const options = tags.get("options");
    if (options instanceof Y.Array) return options;
    return null;
  }

  function getOrCreateTagOptions(meta) {
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

  function findPageEntry(meta, docId) {
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
  const listTagsHandler = async (parsed) => {
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
  };

  // get_doc_tags
  const getDocTagsHandler = async (parsed) => {
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
      const tagMap = new Map();
      if (tagOptions) {
        for (const tag of yArrayToJS(tagOptions)) {
          if (tag && tag.id) tagMap.set(tag.id, { name: tag.value || tag.name || "", color: tag.color || "" });
        }
      }
      const pageInfo = findPageEntry(meta, parsed.docId);
      if (!pageInfo) return text({ docId: parsed.docId, tags: [], error: "Document not found" });
      const docTags = pageInfo.entry.get("tags");
      const docTagIds = docTags instanceof Y.Array ? yArrayToJS(docTags) : [];
      const resolved = docTagIds.map(tagId => ({
        id: tagId,
        name: tagMap.get(tagId)?.name || "unknown",
        color: tagMap.get(tagId)?.color || ""
      }));
      return text({ docId: parsed.docId, tags: resolved });
    } finally { socket.disconnect(); }
  };

  // add_tag
  const addTagHandler = async (parsed) => {
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
      let tagId = null;
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
  const removeTagHandler = async (parsed) => {
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

  server.registerTool("add_tag", {
    title: "Add Tag to Document",
    description: "Add a tag to a document. Creates the tag if it doesn't exist.",
    inputSchema: {
      workspaceId: WorkspaceId.optional(),
      docId: DocId,
      tagName: z.string().min(1, "tagName required"),
      color: z.string().optional(),
    },
  }, addTagHandler);

  server.registerTool("remove_tag", {
    title: "Remove Tag from Document",
    description: "Remove a tag from a document",
    inputSchema: { workspaceId: WorkspaceId.optional(), docId: DocId, tagId: z.string().min(1, "tagId required") },
  }, removeTagHandler);
}