import { z } from "zod";
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

function generateId() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";
  let id = "";
  for (let i = 0; i < 10; i++) id += chars.charAt(Math.floor(Math.random() * chars.length));
  return id;
}

function yArrayToJS(arr: Y.Array<any>) {
  const result: any[] = [];
  for (let i = 0; i < arr.length; i++) {
    result.push(arr.get(i));
  }
  return result;
}

export function registerCollectionTools(server: any, gql: any, defaults: any) {
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

  function getCollectionsArray(settingMap: Y.Map<any>): Y.Array<any> | null {
    const collections = settingMap.get("collections");
    if (collections instanceof Y.Array) return collections;
    return null;
  }

  // list_collections
  server.registerTool("list_collections", {
    title: "List Collections",
    description: "List all collections in a workspace",
    inputSchema: { workspaceId: WorkspaceId.optional() },
  }, async (parsed: any) => {
    const workspaceId = parsed.workspaceId || defaults.workspaceId;
    if (!workspaceId) throw new Error("workspaceId is required");
    const { endpoint, cookie } = await getConnectionInfo();
    const wsUrl = wsUrlFromGraphQLEndpoint(endpoint);
    const socket = await connectWorkspaceSocket(wsUrl, cookie);
    try {
      await joinWorkspace(socket, workspaceId);
      const wsDoc = await loadWorkspaceRoot(socket, workspaceId);
      const settingMap = wsDoc.getMap("setting");
      const collectionsArr = getCollectionsArray(settingMap);
      if (!collectionsArr) return text([]);
      const collections = yArrayToJS(collectionsArr).filter(c => c).map(c => ({
        id: c.id || "",
        name: c.name || "",
        rules: c.rules || { filters: [] },
        allowList: c.allowList || [],
      }));
      return text(collections);
    } finally { socket.disconnect(); }
  });

  // create_collection
  server.registerTool("create_collection", {
    title: "Create Collection",
    description: "Create a new collection with a name and optional filter rules",
    inputSchema: {
      workspaceId: WorkspaceId.optional(),
      name: z.string().min(1, "name required"),
      filters: z.array(z.object({
        type: z.string().default("system"),
        key: z.string(),
        method: z.string(),
        value: z.string().optional(),
      })).optional(),
      allowList: z.array(z.string()).optional(),
    },
  }, async (parsed: any) => {
    const workspaceId = parsed.workspaceId || defaults.workspaceId;
    if (!workspaceId) throw new Error("workspaceId is required");
    const { endpoint, cookie } = await getConnectionInfo();
    const wsUrl = wsUrlFromGraphQLEndpoint(endpoint);
    const socket = await connectWorkspaceSocket(wsUrl, cookie);
    try {
      await joinWorkspace(socket, workspaceId);
      const wsDoc = await loadWorkspaceRoot(socket, workspaceId);
      const prevSV = Y.encodeStateVector(wsDoc);
      const settingMap = wsDoc.getMap("setting");

      let collectionsArr = getCollectionsArray(settingMap);
      if (!collectionsArr) {
        collectionsArr = new Y.Array();
        settingMap.set("collections", collectionsArr);
      }

      const id = generateId();
      collectionsArr.push([{
        id,
        name: parsed.name,
        rules: { filters: parsed.filters || [] },
        allowList: parsed.allowList || [],
      }]);

      const delta = Y.encodeStateAsUpdate(wsDoc, prevSV);
      await pushDocUpdate(socket, workspaceId, workspaceId, Buffer.from(delta).toString("base64"));
      return text({ id, name: parsed.name, created: true });
    } finally { socket.disconnect(); }
  });

  // update_collection
  server.registerTool("update_collection", {
    title: "Update Collection",
    description: "Update an existing collection's name or rules",
    inputSchema: {
      workspaceId: WorkspaceId.optional(),
      collectionId: z.string().min(1, "collectionId required"),
      name: z.string().optional(),
      filters: z.array(z.object({
        type: z.string().default("system"),
        key: z.string(),
        method: z.string(),
        value: z.string().optional(),
      })).optional(),
      allowList: z.array(z.string()).optional(),
    },
  }, async (parsed: any) => {
    const workspaceId = parsed.workspaceId || defaults.workspaceId;
    if (!workspaceId) throw new Error("workspaceId is required");
    const { endpoint, cookie } = await getConnectionInfo();
    const wsUrl = wsUrlFromGraphQLEndpoint(endpoint);
    const socket = await connectWorkspaceSocket(wsUrl, cookie);
    try {
      await joinWorkspace(socket, workspaceId);
      const wsDoc = await loadWorkspaceRoot(socket, workspaceId);
      const prevSV = Y.encodeStateVector(wsDoc);
      const settingMap = wsDoc.getMap("setting");
      const collectionsArr = getCollectionsArray(settingMap);

      if (!collectionsArr) throw new Error("No collections found");

      let foundIdx = -1;
      for (let i = 0; i < collectionsArr.length; i++) {
        if (collectionsArr.get(i).id === parsed.collectionId) {
          foundIdx = i;
          break;
        }
      }

      if (foundIdx === -1) throw new Error(`Collection ${parsed.collectionId} not found`);

      const current = collectionsArr.get(foundIdx);
      const updated = {
        ...current,
        name: parsed.name ?? current.name,
        rules: parsed.filters ? { filters: parsed.filters } : current.rules,
        allowList: parsed.allowList ?? current.allowList,
      };

      collectionsArr.delete(foundIdx, 1);
      collectionsArr.insert(foundIdx, [updated]);

      const delta = Y.encodeStateAsUpdate(wsDoc, prevSV);
      await pushDocUpdate(socket, workspaceId, workspaceId, Buffer.from(delta).toString("base64"));
      return text({ id: parsed.collectionId, updated: true });
    } finally { socket.disconnect(); }
  });

  // add_doc_to_collection
  server.registerTool("add_doc_to_collection", {
    title: "Add Document to Collection",
    description: "Manually add a document to a collection's allowList",
    inputSchema: {
      workspaceId: WorkspaceId.optional(),
      collectionId: z.string().min(1, "collectionId required"),
      docId: z.string().min(1, "docId required"),
    },
  }, async (parsed: any) => {
    const workspaceId = parsed.workspaceId || defaults.workspaceId;
    if (!workspaceId) throw new Error("workspaceId is required");
    const { endpoint, cookie } = await getConnectionInfo();
    const wsUrl = wsUrlFromGraphQLEndpoint(endpoint);
    const socket = await connectWorkspaceSocket(wsUrl, cookie);
    try {
      await joinWorkspace(socket, workspaceId);
      const wsDoc = await loadWorkspaceRoot(socket, workspaceId);
      const prevSV = Y.encodeStateVector(wsDoc);
      const settingMap = wsDoc.getMap("setting");
      const collectionsArr = getCollectionsArray(settingMap);

      if (!collectionsArr) throw new Error("No collections found");

      let foundIdx = -1;
      for (let i = 0; i < collectionsArr.length; i++) {
        if (collectionsArr.get(i).id === parsed.collectionId) {
          foundIdx = i;
          break;
        }
      }

      if (foundIdx === -1) throw new Error(`Collection ${parsed.collectionId} not found`);

      const current = collectionsArr.get(foundIdx);
      if (current.allowList.includes(parsed.docId)) {
        return text({ id: parsed.collectionId, docId: parsed.docId, alreadyInList: true });
      }

      const updated = {
        ...current,
        allowList: [...current.allowList, parsed.docId],
      };

      collectionsArr.delete(foundIdx, 1);
      collectionsArr.insert(foundIdx, [updated]);

      const delta = Y.encodeStateAsUpdate(wsDoc, prevSV);
      await pushDocUpdate(socket, workspaceId, workspaceId, Buffer.from(delta).toString("base64"));
      return text({ id: parsed.collectionId, docId: parsed.docId, added: true });
    } finally { socket.disconnect(); }
  });

  // remove_doc_from_collection
  server.registerTool("remove_doc_from_collection", {
    title: "Remove Document from Collection",
    description: "Remove a document from a collection's allowList",
    inputSchema: {
      workspaceId: WorkspaceId.optional(),
      collectionId: z.string().min(1, "collectionId required"),
      docId: z.string().min(1, "docId required"),
    },
  }, async (parsed: any) => {
    const workspaceId = parsed.workspaceId || defaults.workspaceId;
    if (!workspaceId) throw new Error("workspaceId is required");
    const { endpoint, cookie } = await getConnectionInfo();
    const wsUrl = wsUrlFromGraphQLEndpoint(endpoint);
    const socket = await connectWorkspaceSocket(wsUrl, cookie);
    try {
      await joinWorkspace(socket, workspaceId);
      const wsDoc = await loadWorkspaceRoot(socket, workspaceId);
      const prevSV = Y.encodeStateVector(wsDoc);
      const settingMap = wsDoc.getMap("setting");
      const collectionsArr = getCollectionsArray(settingMap);

      if (!collectionsArr) throw new Error("No collections found");

      let foundIdx = -1;
      for (let i = 0; i < collectionsArr.length; i++) {
        if (collectionsArr.get(i).id === parsed.collectionId) {
          foundIdx = i;
          break;
        }
      }

      if (foundIdx === -1) throw new Error(`Collection ${parsed.collectionId} not found`);

      const current = collectionsArr.get(foundIdx);
      const updated = {
        ...current,
        allowList: current.allowList.filter((id: string) => id !== parsed.docId),
      };

      collectionsArr.delete(foundIdx, 1);
      collectionsArr.insert(foundIdx, [updated]);

      const delta = Y.encodeStateAsUpdate(wsDoc, prevSV);
      await pushDocUpdate(socket, workspaceId, workspaceId, Buffer.from(delta).toString("base64"));
      return text({ id: parsed.collectionId, docId: parsed.docId, removed: true });
    } finally { socket.disconnect(); }
  });

  // delete_collection
  server.registerTool("delete_collection", {
    title: "Delete Collection",
    description: "Delete a collection by ID",
    inputSchema: {
      workspaceId: WorkspaceId.optional(),
      collectionId: z.string().min(1, "collectionId required"),
    },
  }, async (parsed: any) => {
    const workspaceId = parsed.workspaceId || defaults.workspaceId;
    if (!workspaceId) throw new Error("workspaceId is required");
    const { endpoint, cookie } = await getConnectionInfo();
    const wsUrl = wsUrlFromGraphQLEndpoint(endpoint);
    const socket = await connectWorkspaceSocket(wsUrl, cookie);
    try {
      await joinWorkspace(socket, workspaceId);
      const wsDoc = await loadWorkspaceRoot(socket, workspaceId);
      const prevSV = Y.encodeStateVector(wsDoc);
      const settingMap = wsDoc.getMap("setting");
      const collectionsArr = getCollectionsArray(settingMap);

      if (!collectionsArr) return text({ collectionId: parsed.collectionId, deleted: false, error: "No collections found" });

      let found = false;
      for (let i = 0; i < collectionsArr.length; i++) {
        const c = collectionsArr.get(i);
        if (c && c.id === parsed.collectionId) {
          collectionsArr.delete(i);
          found = true;
          break;
        }
      }

      if (found) {
        const delta = Y.encodeStateAsUpdate(wsDoc, prevSV);
        await pushDocUpdate(socket, workspaceId, workspaceId, Buffer.from(delta).toString("base64"));
      }

      return text({ collectionId: parsed.collectionId, deleted: found });
    } finally { socket.disconnect(); }
  });
}
