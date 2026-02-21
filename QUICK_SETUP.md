# Quick Setup Guide - AFFiNE MCP Server

This guide helps you set up the AFFiNE MCP server with Claude Desktop or Codex in under 5 minutes.

## Prerequisites Checklist

- [ ] Node.js 18+ installed
- [ ] AFFiNE instance running (self-hosted or cloud)
- [ ] AFFiNE account credentials or access token
- [ ] Claude Desktop installed OR Codex CLI installed

## Option A: Claude Desktop Setup

### Step 1: Build the Server

```bash
cd E:\dev\affine-mcp-server
npm install
npm run build
```

### Step 2: Configure Claude Desktop

Edit Claude Desktop config:

**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Linux:** `~/.config/Claude/claude_desktop_config.json`

Add this configuration:

```json
{
  "mcpServers": {
    "affine": {
      "command": "node",
      "args": ["E:\\\\dev\\affine-mcp-server\\dist\\index.js"],
      "env": {
        "AFFINE_BASE_URL": "http://your-affine-instance.com",
        "AFFINE_API_TOKEN": "your-token-here"
      }
    }
  }
}
```

### Authentication Options

**Option 1: API Token (Recommended)**
```json
"env": {
  "AFFINE_BASE_URL": "https://your-instance.com",
  "AFFINE_API_TOKEN": "apt_xxxxxxxxxxxxxx"
}
```

**Option 2: Email/Password**
```json
"env": {
  "AFFINE_BASE_URL": "https://your-instance.com",
  "AFFINE_EMAIL": "you@example.com",
  "AFFINE_PASSWORD": "your-password",
  "AFFINE_LOGIN_AT_START": "sync"
}
```

**Option 3: Cookie**
```json
"env": {
  "AFFINE_BASE_URL": "https://your-instance.com",
  "AFFINE_COOKIE": "affine_session=xxx; affine_csrf=xxx"
}
```

### Step 3: Restart Claude Desktop

Restart Claude Desktop to load the MCP server.

### Step 4: Verify

In Claude Desktop, the AFFiNE MCP server will be available. You can:
- List workspaces and documents
- Create and edit documents
- Manage tags and collections (new!)
- Access comments, notifications, and more

## Option B: Codex CLI Setup

### Step 1: Build the Server

```bash
cd E:\dev\affine-mcp-server
npm install
npm run build
```

### Step 2: Register with Codex

**Using local build:**
```bash
codex mcp add affine --env AFFINE_BASE_URL=https://your-instance.com --env AFFINE_API_TOKEN=your-token -- node E:\\\\dev\\affine-mcp-server\\dist\\index.js
```

**Using npm global install:**
```bash
npm i -g affine-mcp-server
codex mcp add affine --env AFFINE_BASE_URL=https://your-instance.com --env AFFINE_API_TOKEN=your-token -- affine-mcp
```

## Option C: Cursor Setup

Create `.cursor/mcp.json` in your project:

```json
{
  "mcpServers": {
    "affine": {
      "command": "node",
      "args": ["E:\\\\dev\\affine-mcp-server\\dist\\index.js"],
      "env": {
        "AFFINE_BASE_URL": "https://your-instance.com",
        "AFFINE_API_TOKEN": "your-token-here"
      }
    }
  }
}
```

## Getting an API Token

### From AFFiNE Cloud
1. Go to https://app.affine.pro
2. Click your avatar → Settings
3. Navigate to "Personal Access Tokens"
4. Click "Create Token"
5. Give it a name (e.g., "Claude Desktop")
6. Copy the token starting with `apt_`

### From Self-Hosted AFFiNE
1. Go to your AFFiNE instance
2. Click Settings (gear icon)
3. Navigate to "Personal Access Tokens"
4. Create and copy the token

## Verification

After setup, test with a simple query in Claude Desktop:

**"Show me all my workspaces"**

Should list all available workspaces from your AFFiNE instance.

## Troubleshooting

### "Failed to connect to server"
- Check `AFFINE_BASE_URL` is correct and accessible
- Verify network connectivity
- Check firewall settings

### "Authentication failed"
- Verify credentials are correct
- Try using API token instead of email/password
- For email/password, ensure `AFFINE_LOGIN_AT_START: "sync"` is set

### "Tool not found"
- Ensure `npm run build` completed successfully
- Verify the path to `dist/index.js` is correct
- Check Claude Desktop logs for errors

## New Features in v1.5.0

### Tags
- Create and manage tags across your workspace
- Apply tags to documents for organization
- 6 new tools: `list_tags`, `create_tag`, `update_tag`, `add_tag`, `remove_tag`, `get_doc_tags`

### Collections
- Create collections with filter rules
- Manually manage document membership
- 6 new tools: `list_collections`, `create_collection`, `update_collection`, `delete_collection`, `add_doc_to_collection`, `remove_doc_from_collection`

### Example: Creating a Tagged Collection

```javascript
// 1. Create a tag
await callTool("create_tag", { tagName: "Important", color: "#ff0000" });

// 2. Create a collection for important items
await callTool("create_collection", {
  name: "Important Documents",
  filters: [{ type: "system", key: "tags", method: "contains", value: "tag-id" }]
});
```

## Support

- Full documentation: See `README.md` in this repo
- Tool reference: See `TOOL_REFERENCE.md` in this repo
- Issues: https://github.com/dawncr0w/affine-mcp-server/issues
