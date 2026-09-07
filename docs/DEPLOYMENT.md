# Deployment Guide

Use Ubuntu VPS with Docker Compose. The included Caddy reverse proxy obtains and
renews a trusted Let's Encrypt SSL certificate automatically.

## DNS and SSL setup

Before starting the app:

1. Create an `A` record for your domain pointing to the VPS public IPv4 address.
2. If the VPS has IPv6, create an `AAAA` record pointing to it; otherwise remove
   any existing `AAAA` record for this hostname.
3. Allow inbound TCP ports `80` and `443` (and UDP `443`, if possible) in the VPS
   firewall and hosting-provider firewall.
4. Set the public hostname in `.env` (hostname only, without `https://`):

```env
DOMAIN=invoice.scm.centrino.app
```

Port 80 must remain reachable so certificate issuance and HTTP-to-HTTPS redirects
work. Caddy stores certificates in the persistent `caddy_data` Docker volume.

## Start

```bash
docker compose up -d --build
```

## Stop

```bash
docker compose down
```

## Logs

```bash
docker compose logs -f
```

To check certificate issuance specifically:

```bash
docker compose logs caddy
```

## Update after Git pull

```bash
git pull
docker compose up -d --build
```
