import net from 'node:net';
// Expo --localhost listens on ::1 but advertises 127.0.0.1 to this dev client.
net
  .createServer((client) => {
    const upstream = net.connect({ host: '::1', port: 18793 });
    client.pipe(upstream).pipe(client);
    upstream.on('error', () => client.destroy());
    client.on('error', () => upstream.destroy());
  })
  .listen(18793, '127.0.0.1', () => console.log('Metro IPv4 loopback ready'));
