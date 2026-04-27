import dns from 'node:dns';

export function configureNodeDns(): void {
  const rawServers = process.env.NODE_DNS_SERVERS?.trim();

  if (!rawServers) {
    return;
  }

  const servers = rawServers
    .split(',')
    .map((server) => server.trim())
    .filter((server) => server.length > 0);

  if (servers.length === 0) {
    return;
  }

  dns.setServers(servers);
}
