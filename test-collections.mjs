import http from 'http';

const BASE = 'http://100.109.179.115:8080';

function mcpCall(toolName, args = {}) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timeout')), 15000);
    
    http.get(`${BASE}/sse`, res => {
      let buffer = '';
      let endpoint = null;
      
      res.on('data', chunk => {
        buffer += chunk.toString();
        
        // Extract endpoint
        if (!endpoint) {
          const m = buffer.match(/data: (\/messages\?sessionId=[\w-]+)/);
          if (m) {
            endpoint = m[1];
            // Send the tool call
            const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: toolName, arguments: args } });
            const req = http.request(`${BASE}${endpoint}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
            }, () => {});
            req.write(body); req.end();
          }
        }
        
        // Look for result in SSE
        const lines = buffer.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: {')) {
            try {
              const msg = JSON.parse(line.slice(6));
              if (msg.id === 1 && (msg.result || msg.error)) {
                clearTimeout(timeout);
                res.destroy();
                resolve(msg);
              }
            } catch {}
          }
        }
      });
    }).on('error', e => { clearTimeout(timeout); reject(e); });
  });
}

async function main() {
  console.log('=== Testing Collection Tools ===\n');

  console.log('1. list_collections');
  try {
    const r = await mcpCall('list_collections');
    console.log(JSON.stringify(r, null, 2));
  } catch (e) { console.error('Error:', e.message); }

  console.log('\n2. create_collection');
  try {
    const r = await mcpCall('create_collection', { name: 'MCP Test Collection' });
    console.log(JSON.stringify(r, null, 2));
  } catch (e) { console.error('Error:', e.message); }

  // Wait for sync
  await new Promise(r => setTimeout(r, 2000));

  console.log('\n3. list_collections (after create)');
  try {
    const r = await mcpCall('list_collections');
    console.log(JSON.stringify(r, null, 2));
  } catch (e) { console.error('Error:', e.message); }

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
