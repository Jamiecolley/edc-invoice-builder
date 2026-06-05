# Deployment Guide

Use Ubuntu VPS with Docker Compose.

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

## Update after Git pull

```bash
git pull
docker compose up -d --build
```
