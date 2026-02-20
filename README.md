# AFFiNE MCP Server

A custom Model Context Protocol (MCP) server for AFFiNE, with extended tag and collection management capabilities.

## Additional Features

This fork adds comprehensive tag and collection management not available in the upstream server.

### Tag Tools

| Tool | Description |
|------|-------------|
| `list_tags` | List all tags in the workspace |
| `get_doc_tags` | Get tags attached to a specific document |
| `add_tag` | Add a tag to a document (creates tag if it doesn't exist) |
| `remove_tag` | Remove a tag from a document |
| `create_tag` | Create a new tag definition (without attaching to a doc) |
| `update_tag` | Update tag name or color |

### Collection Tools

| Tool | Description |
|------|-------------|
| `list_collections` | List all collections |
| `create_collection` | Create a new collection |
| `update_collection` | Update collection name or rules |
| `delete_collection` | Delete a collection |
| `add_doc_to_collection` | Manually add a document to a collection |
| `remove_doc_from_collection` | Remove a document from a collection |

### Document Tools

| Tool | Description |
|------|-------------|
| `list_docs` | List all documents |
| `get_doc` | Get document details |
| `create_doc` | Create a new document |
| `update_doc` | Update document (title, content, or tags) |
| `get_page` | Get page blocks |
| `append_block` | Add content to a document |

### Key Implementation Details

- Tags are stored in `meta.properties.tags.options` as Y.Array of Y.Map objects
- Collections are stored in `setting.collections` as Y.Array
- All modifications are pushed via Y.js delta encoding for real-time sync

## Deployment

```bash
npm install
npm run build
docker compose up -d
```

## Original README

See [original-readme.md](./original-readme.md) for the base server documentation.