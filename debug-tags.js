const WebSocket = require('ws');
const Y = require('yjs');

async function debug() {
  const ws = new WebSocket('ws://127.0.0.1:3010');
  ws.on('open', () => {
    ws.send(JSON.stringify({ type: 'Req', id: 1, channel: 'workspace', name: 'sync', args: { workspaceId: 'f13e2d86-4d85-4501-8a6a-0e405f5c3f4c' } }));
  });
  ws.on('message', (data) => {
    const msg = JSON.parse(data);
    if (msg.type === 'Sync') {
      const update = Buffer.from(msg.data, 'base64');
      const doc = new Y.Doc();
      Y.applyUpdate(doc, update);
      const meta = doc.getMap('meta');
      console.log('META KEYS:', [...meta.keys()]);
      const props = meta.get('properties');
      if (props) {
        console.log('PROPERTIES KEYS:', [...props.keys()]);
        const tags = props.get('tags');
        if (tags) {
          console.log('TAGS KEYS:', [...tags.keys()]);
        }
      }
      ws.close();
    }
  });
}
debug();