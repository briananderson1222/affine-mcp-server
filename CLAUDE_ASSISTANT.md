# AFFiNE MCP Server - Quick Reference for Claude

This file provides Claude with quick access to information about the affine-mcp-server tools and configuration.

## Quick Start

The AFFiNE MCP server integrates AFFiNE knowledge base with Claude via Model Context Protocol.

**Connection:** Use `node E:\\dev\\affine-mcp-server\\dist\\index.js` with environment variables.

## Configuration

### Required
- `AFFINE_BASE_URL` - Your AFFiNE instance URL (e.g., `http://localhost:3010` or `https://your-instance.com`)

### Authentication (one required)
- `AFFINE_API_TOKEN` - Personal access token (recommended, fastest)
- `AFFINE_COOKIE` - Session cookie
- `AFFINE_EMAIL` + `AFFINE_PASSWORD` - Email and password

### Optional
- `AFFINE_LOGIN_AT_START` - `async` (default) or `sync` (blocks startup until authenticated)
- `AFFINE_GRAPHQL_PATH` - Default `/graphql`
- `AFFINE_WORKSPACE_ID` - Default workspace for tools

## Tools Overview

Total: 44 tools organized into 7 categories.

### Workspace Tools (5)
- `list_workspaces` - List all workspaces
- `get_workspace` - Get workspace details
- `create_workspace` - Create workspace with initial document
- `update_workspace` - Update workspace settings
- `delete_workspace` - Delete workspace permanently

### Document Tools (8)
- `list_docs` - List documents with pagination
- `get_doc` - Get document metadata
- `read_doc` - Read document block content and plain text (WebSocket)
- `publish_doc` - Make document public
- `revoke_doc` - Revoke public access
- `create_doc` - Create a new document (WebSocket)
- `append_paragraph` - Append a paragraph block (WebSocket)
- `append_block` - Append canonical block types (text/list/code/media/embed/database/edgeless)
- `delete_doc` - Delete a document (WebSocket)

### Tag Tools (6) - NEW
- `list_tags` - List all tag definitions in a workspace
- `create_tag` - Create a new tag definition
- `update_tag` - Update tag name or color
- `add_tag` - Add a tag to a document (creates tag if doesn't exist)
- `remove_tag` - Remove a tag from a document
- `get_doc_tags` - Get tags assigned to a specific document

### Collection Tools (6) - NEW
- `list_collections` - List all collections
- `create_collection` - Create a new collection with optional filter rules
- `update_collection` - Update collection name or rules
- `delete_collection` - Delete a collection
- `add_doc_to_collection` - Manually add a document to a collection
- `remove_doc_from_collection` - Remove a document from a collection

### Comment Tools (5)
- `list_comments` - List comments on a document
- `create_comment` - Create a comment
- `update_comment` - Update a comment
- `delete_comment` - Delete a comment
- `resolve_comment` - Mark comment as resolved

### User & Token Tools (5)
- `current_user` - Get current user info
- `sign_in` - Authenticate with email/password
- `update_profile` - Update user profile
- `update_settings` - Update user settings
- `list_access_tokens` - List personal access tokens
- `generate_access_token` - Generate new access token
- `revoke_access_token` - Revoke access token

### Notification Tools (2)
- `list_notifications` - List notifications
- `read_all_notifications` - Mark all notifications as read

### Blob Storage Tools (3)
- `upload_blob` - Upload a file to blob storage
- `delete_blob` - Delete a blob
- `cleanup_blobs` - Clean up orphaned blobs

### History Tools (1)
- `list_histories` - List document version history

## Common Usage Patterns

### 1. Working with Documents
```javascript
// List docs in a workspace
await callTool("list_docs", { workspaceId: "workspace-id", first: 20 });

// Create a new doc
await callTool("create_doc", { workspaceId: "workspace-id", title: "My Doc", content: "Content" });

// Read doc content
await callTool("read_doc", { workspaceId: "workspace-id", docId: "doc-id" });
```

### 2. Working with Tags
```javascript
// List all tags
await callTool("list_tags", { workspaceId: "workspace-id" });

// Create a tag
await callTool("create_tag", { workspaceId: "workspace-id", tagName: "Important", color: "#ff0000" });

// Add tag to document
await callTool("add_tag", { workspaceId: "workspace-id", docId: "doc-id", tagName: "Important" });

// Update tag
await callTool("update_tag", { workspaceId: "workspace-id", tagId: "tag-id", name: "Critical", color: "#ff0000" });

// Get tags on a document
await callTool("get_doc_tags", { workspaceId: "workspace-id", docId: "doc-id" });

// Remove tag from document
await callTool("remove_tag", { workspaceId: "workspace-id", docId: "doc-id", tagId: "tag-id" });
```

### 3. Working with Collections
```javascript
// List collections
await callTool("list_collections", { workspaceId: "workspace-id" });

// Create a collection
await callTool("create_collection", {
  workspaceId: "workspace-id",
  name: "My Collection",
  filters: [
    { type: "system", key: "tags", method: "contains", value: "tag-id" }
  ]
});

// Update collection
await callTool("update_collection", {
  workspaceId: "workspace-id",
  collectionId: "collection-id",
  name: "Updated Name",
  filters: [
    { type: "system", key: "tags", method: "contains", value: "new-tag-id" }
  ]
});

// Add doc to collection manually
await callTool("add_doc_to_collection", {
  workspaceId: "workspace-id",
  collectionId: "collection-id",
  docId: "doc-id"
});

// Remove doc from collection
await callTool("remove_doc_from_collection", {
  workspaceId: "workspace-id",
  collectionId: "collection-id",
  docId: "doc-id"
});

// Delete collection
await callTool("delete_collection", {
  workspaceId: "workspace-id",
  collectionId: "collection-id"
});
```

## Troubleshooting

### Authentication Fails
- Ensure AFFiNE URL is correct and accessible
- For email/password: verify credentials are correct
- Consider using API token instead (more reliable)

### Tool Not Found
- Verify build completed: `npm run build`
- Check `tool-manifest.json` matches registered tools

### WebSocket Errors
- Some tools (create_doc, delete_doc, tag ops, collection ops) use WebSocket
- Ensure AFFiNE instance supports WebSocket connections
- Check firewall settings

## Quick Reference

| Tool | Purpose | Auth Required | WebSocket |
|-------|---------|---------------|-----------|
| `list_tags` | List all tags | Yes | Yes |
| `create_tag` | Create tag definition | Yes | Yes |
| `update_tag` | Update tag | Yes | Yes |
| `add_tag` | Add tag to doc | Yes | Yes |
| `remove_tag` | Remove tag from doc | Yes | Yes |
| `get_doc_tags` | Get doc tags | Yes | Yes |
| `list_collections` | List collections | Yes | Yes |
| `create_collection` | Create collection | Yes | Yes |
| `update_collection` | Update collection | Yes | Yes |
| `delete_collection` | Delete collection | Yes | Yes |
| `add_doc_to_collection` | Add doc to collection | Yes | Yes |
| `remove_doc_from_collection` | Remove doc from collection | Yes | Yes |
