# AFFiNE MCP Server - Complete Tool Reference

Complete reference for all 44 tools available in the affine-mcp-server.

---

## Workspace Tools

### `list_workspaces`

Lists all workspaces accessible to the authenticated user.

**Input:**
```typescript
{
  // None (uses authenticated user context)
}
```

**Output:**
```typescript
[
  {
    id: string;
    name: string;
    avatar: string | null;
    isOwner: boolean;
    memberCount: number;
    createdAt: string;
  }
]
```

**Example:**
```
"Show me all my workspaces"
```

---

### `get_workspace`

Get details for a specific workspace.

**Input:**
```typescript
{
  id: string;  // Workspace ID
}
```

**Output:**
```typescript
{
  id: string;
  name: string;
  avatar: string | null;
  isOwner: boolean;
  memberCount: number;
  createdAt: string;
  isPublic: boolean;
  enableAi: boolean;
}
```

**Example:**
```
"Get details for workspace abc123"
```

---

### `create_workspace`

Create a new workspace with an initial document.

**Input:**
```typescript
{
  name: string;  // Workspace name
}
```

**Output:**
```typescript
{
  id: string;
  name: string;
  isOwner: boolean;
  memberCount: number;
  createdAt: string;
}
```

**Example:**
```
"Create a new workspace called 'Project Alpha'"
```

---

### `update_workspace`

Update workspace settings.

**Input:**
```typescript
{
  id: string;        // Workspace ID
  name?: string;      // New name (optional)
  public?: boolean;   // Make public/private (optional)
  enableAi?: boolean;  // Enable AI features (optional)
}
```

**Output:**
```typescript
{
  id: string;
  name: string;
  isPublic: boolean;
  enableAi: boolean;
}
```

**Example:**
```
"Make workspace abc123 private and enable AI"
```

---

### `delete_workspace`

Delete a workspace permanently.

**Input:**
```typescript
{
  id: string;  // Workspace ID
}
```

**Output:**
```typescript
{
  id: string;
  deleted: boolean;
}
```

**Example:**
```
"Delete workspace abc123 permanently"
```

---

## Document Tools

### `list_docs`

List documents in a workspace with pagination.

**Input:**
```typescript
{
  workspaceId: string;
  first?: number;   // Number of results (default: 20)
  after?: string;    // Pagination cursor
}
```

**Output:**
```typescript
{
  totalCount: number;
  edges: Array<{
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
  }>;
  pageInfo: { hasNextPage: boolean };
}
```

**Example:**
```
"List the first 50 documents in workspace abc123"
```

---

### `get_doc`

Get document metadata.

**Input:**
```typescript
{
  workspaceId: string;
  docId: string;
}
```

**Output:**
```typescript
{
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  isPublic: boolean;
}
```

**Example:**
```
"Get metadata for document doc456"
```

---

### `read_doc`

Read document block content and plain text snapshot (WebSocket).

**Input:**
```typescript
{
  workspaceId: string;
  docId: string;
}
```

**Output:**
```typescript
{
  docId: string;
  blocks: Array<{
    id: string;
    type: string;
    text?: string;
    // ... other block properties
  }>;
  plainText?: string;
}
```

**Example:**
```
"Read the full content of document doc456"
```

---

### `create_doc`

Create a new document (WebSocket).

**Input:**
```typescript
{
  workspaceId: string;
  title: string;
  content?: string;  // Initial content (optional)
}
```

**Output:**
```typescript
{
  workspaceId: string;
  docId: string;
  title: string;
}
```

**Example:**
```
"Create a new document called 'Meeting Notes' in workspace abc123"
```

---

### `append_paragraph`

Append a paragraph block to a document (WebSocket).

**Input:**
```typescript
{
  workspaceId: string;
  docId: string;
  text: string;
}
```

**Output:**
```typescript
{
  workspaceId: string;
  docId: string;
  paragraphId: string;
  timestamp: number;
}
```

**Example:**
```
"Append the text 'Next steps: review proposal' to doc456"
```

---

### `append_block`

Append a canonical block type to a document (WebSocket).

**Input:**
```typescript
{
  workspaceId: string;
  docId: string;
  type: string;  // Block type: heading, list, code, table, etc.
  parent?: string;  // Parent block ID (optional)
  properties?: Record<string, any>;  // Block-specific properties
}
```

**Output:**
```typescript
{
  workspaceId: string;
  docId: string;
  blockId: string;
  type: string;
}
```

**Block Types:** `text`, `heading`, `list`, `todo`, `code`, `quote`, `divider`, `callout`, `latex`, `table`, `bookmark`, `image`, `video`, `attachment`, `embed`, `database`, `surface_ref`, `frame`, `note`, etc.

**Example:**
```
"Add a heading block saying 'Summary' to doc456"
```

---

### `publish_doc`

Make a document publicly accessible.

**Input:**
```typescript
{
  workspaceId: string;
  docId: string;
}
```

**Output:**
```typescript
{
  workspaceId: string;
  docId: string;
  published: boolean;
  publicUrl?: string;
}
```

**Example:**
```
"Publish doc456 to make it public"
```

---

### `revoke_doc`

Revoke public access to a document.

**Input:**
```typescript
{
  workspaceId: string;
  docId: string;
}
```

**Output:**
```typescript
{
  workspaceId: string;
  docId: string;
  revoked: boolean;
}
```

**Example:**
```
"Revoke public access for doc456"
```

---

### `delete_doc`

Delete a document (WebSocket).

**Input:**
```typescript
{
  workspaceId: string;
  docId: string;
}
```

**Output:**
```typescript
{
  workspaceId: string;
  docId: string;
  deleted: boolean;
}
```

**Example:**
```
"Delete document doc456 from workspace abc123"
```

---

## Tag Tools (NEW in v1.5.0)

### `list_tags`

List all tag definitions in a workspace.

**Input:**
```typescript
{
  workspaceId?: string;  // Uses AFFINE_WORKSPACE_ID if omitted
}
```

**Output:**
```typescript
[
  {
    id: string;      // Tag ID
    name: string;     // Tag name
    color: string;    // Hex color code
    createDate?: number;
  }
]
```

**Example:**
```
"List all tags in workspace abc123"
```

---

### `create_tag`

Create a new tag definition without attaching to a document.

**Input:**
```typescript
{
  workspaceId?: string;  // Optional
  tagName: string;       // Tag name
  color?: string;        // Hex color (optional, random if omitted)
}
```

**Output:**
```typescript
{
  tagId: string;
  tagName: string;
  created: boolean;
  color: string;
}
```

**Example:**
```
"Create a red tag called 'Urgent'"
```

---

### `update_tag`

Update an existing tag's name or color.

**Input:**
```typescript
{
  workspaceId?: string;
  tagId: string;    // Tag ID
  name?: string;      // New name (optional)
  color?: string;     // New color (optional)
}
```

**Output:**
```typescript
{
  tagId: string;
  updated: boolean;
}
```

**Example:**
```
"Update tag tag123 to have color '#00ff00'"
```

---

### `add_tag`

Add a tag to a document. Creates the tag if it doesn't exist.

**Input:**
```typescript
{
  workspaceId?: string;
  docId: string;
  tagName: string;   // Tag name
  color?: string;    // Tag color (optional, for new tags only)
}
```

**Output:**
```typescript
{
  tagId: string;
  tagName: string;
  docId: string;
  created: boolean;      // Whether tag was newly created
  alreadyTagged: boolean; // Whether doc was already tagged
  color: string;
}
```

**Example:**
```
"Add the 'Urgent' tag to document doc456"
```

---

### `remove_tag`

Remove a tag from a document.

**Input:**
```typescript
{
  workspaceId?: string;
  docId: string;
  tagId: string;  // Tag ID (from list_tags)
}
```

**Output:**
```typescript
{
  docId: string;
  tagId: string;
  removed: boolean;
}
```

**Example:**
```
"Remove tag tag123 from document doc456"
```

---

### `get_doc_tags`

Get tags assigned to a specific document.

**Input:**
```typescript
{
  workspaceId?: string;
  docId: string;
}
```

**Output:**
```typescript
{
  docId: string;
  tags: [
    {
      id: string;
      name: string;
      color: string;
    }
  ],
  error?: string;  // If document not found
}
```

**Example:**
```
"Show all tags on document doc456"
```

---

## Collection Tools (NEW in v1.5.0)

### `list_collections`

List all collections in a workspace.

**Input:**
```typescript
{
  workspaceId?: string;  // Uses AFFINE_WORKSPACE_ID if omitted
}
```

**Output:**
```typescript
[
  {
    id: string;
    name: string;
    rules: { filters: Array<{ type: string; key: string; method: string; value?: string }> };
    allowList: string[];  // Manually added document IDs
  }
]
```

**Example:**
```
"List all collections in workspace abc123"
```

---

### `create_collection`

Create a new collection with optional filter rules.

**Input:**
```typescript
{
  workspaceId?: string;
  name: string;
  filters?: Array<{
    type: string;      // Usually "system"
    key: string;       // Property to filter on (e.g., "tags")
    method: string;    // Filter method (e.g., "contains")
    value?: string;     // Filter value
  }>;
  allowList?: string[];  // Manually add document IDs
}
```

**Output:**
```typescript
{
  id: string;
  name: string;
  created: boolean;
}
```

**Example:**
```
"Create a collection for documents tagged 'Important'"
```

---

### `update_collection`

Update an existing collection's name or rules.

**Input:**
```typescript
{
  workspaceId?: string;
  collectionId: string;
  name?: string;
  filters?: Array<{ type: string; key: string; method: string; value?: string }>;
  allowList?: string[];
}
```

**Output:**
```typescript
{
  id: string;
  updated: boolean;
}
```

**Example:**
```
"Update collection col123 to filter by 'Priority' tag instead"
```

---

### `delete_collection`

Delete a collection by ID.

**Input:**
```typescript
{
  workspaceId?: string;
  collectionId: string;
}
```

**Output:**
```typescript
{
  collectionId: string;
  deleted: boolean;
}
```

**Example:**
```
"Delete collection col123"
```

---

### `add_doc_to_collection`

Manually add a document to a collection's allowList.

**Input:**
```typescript
{
  workspaceId?: string;
  collectionId: string;
  docId: string;
}
```

**Output:**
```typescript
{
  id: string;
  docId: string;
  added: boolean;
}
```

**Example:**
```
"Add document doc456 to collection col123 manually"
```

---

### `remove_doc_from_collection`

Remove a document from a collection's allowList.

**Input:**
```typescript
{
  workspaceId?: string;
  collectionId: string;
  docId: string;
}
```

**Output:**
```typescript
{
  id: string;
  docId: string;
  removed: boolean;
}
```

**Example:**
```
"Remove document doc456 from collection col123"
```

---

## Comment Tools

### `list_comments`

List comments on a document.

**Input:**
```typescript
{
  workspaceId: string;
  docId: string;
  first?: number;
}
```

**Output:** Array of comment objects with id, content, createdAt, etc.

### `create_comment`

Create a comment on a document.

**Input:**
```typescript
{
  workspaceId: string;
  docId: string;
  docTitle: string;
  docMode: string;  // "page" or "edgeless"
  content: { text: string; quotes?: Array<{ id: string; text: string }> };
}
```

**Output:** Comment object with id.

### `update_comment`

Update a comment.

**Input:**
```typescript
{
  id: string;
  content: { text: string; quotes?: Array<{ id: string; text: string }> };
}
```

**Output:** Updated comment object.

### `delete_comment`

Delete a comment.

**Input:**
```typescript
{
  id: string;
}
```

**Output:** Success status.

### `resolve_comment`

Mark a comment as resolved.

**Input:**
```typescript
{
  id: string;
  resolved: boolean;
}
```

**Output:** Updated comment object.

---

## User & Token Tools

### `current_user`

Get current authenticated user info.

**Input:** None.

**Output:** User object with id, email, name, avatarUrl.

### `sign_in`

Authenticate with email and password.

**Input:**
```typescript
{
  email: string;
  password: string;
}
```

**Output:** Authentication success status.

### `update_profile`

Update user profile.

**Input:**
```typescript
{
  name?: string;
  avatarUrl?: string;
}
```

**Output:** Updated user object.

### `update_settings`

Update user settings.

**Input:**
```typescript
{
  settings: Record<string, any>;
}
```

**Output:** Success status.

### `list_access_tokens`

List personal access tokens.

**Input:** None.

**Output:** Array of token objects with id, name, createdAt.

### `generate_access_token`

Generate a new personal access token.

**Input:**
```typescript
{
  name: string;
}
```

**Output:** Token object with id, token, name, createdAt.

### `revoke_access_token`

Revoke an access token.

**Input:**
```typescript
{
  id: string;
}
```

**Output:** Success status.

---

## Notification Tools

### `list_notifications`

List notifications.

**Input:**
```typescript
{
  first?: number;
}
```

**Output:** Array of notification objects.

### `read_all_notifications`

Mark all notifications as read.

**Input:** None.

**Output:** Success status.

---

## Blob Storage Tools

### `upload_blob`

Upload a file to blob storage.

**Input:**
```typescript
{
  workspaceId: string;
  content: string;        // File content as base64
  filename: string;
  contentType?: string;
}
```

**Output:** Blob object with id/key.

### `delete_blob`

Delete a blob.

**Input:**
```typescript
{
  workspaceId: string;
  key: string;  // Blob key
  permanently?: boolean;
}
```

**Output:** Success status.

### `cleanup_blobs`

Clean up orphaned blobs.

**Input:**
```typescript
{
  workspaceId: string;
}
```

**Output:** Cleanup result with count of removed blobs.

---

## History Tools

### `list_histories`

List document version history.

**Input:**
```typescript
{
  workspaceId: string;
  guid: string;  // Document ID
  take?: number;  // Number of results
}
```

**Output:** Array of history entries with timestamp and operation type.

---

## Quick Command Reference

| Category | Tool | Purpose |
|----------|-------|---------|
| Workspace | `list_workspaces` | List all workspaces |
| Workspace | `get_workspace` | Get workspace details |
| Workspace | `create_workspace` | Create new workspace |
| Workspace | `update_workspace` | Update workspace settings |
| Workspace | `delete_workspace` | Delete workspace |
| Document | `list_docs` | List documents |
| Document | `get_doc` | Get doc metadata |
| Document | `read_doc` | Read doc content |
| Document | `create_doc` | Create document |
| Document | `append_paragraph` | Append paragraph |
| Document | `append_block` | Append block |
| Document | `delete_doc` | Delete document |
| Document | `publish_doc` | Publish document |
| Document | `revoke_doc` | Unpublish document |
| Tags | `list_tags` | List all tags |
| Tags | `create_tag` | Create tag |
| Tags | `update_tag` | Update tag |
| Tags | `add_tag` | Add tag to doc |
| Tags | `remove_tag` | Remove tag from doc |
| Tags | `get_doc_tags` | Get doc tags |
| Collection | `list_collections` | List collections |
| Collection | `create_collection` | Create collection |
| Collection | `update_collection` | Update collection |
| Collection | `delete_collection` | Delete collection |
| Collection | `add_doc_to_collection` | Add doc to collection |
| Collection | `remove_doc_from_collection` | Remove doc from collection |
