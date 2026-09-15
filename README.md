# Cloudflare live support chat

A small support inbox hosted on Cloudflare Workers. Visitor messages are stored in D1 and posted to a Discord channel through a webhook. This project is intentionally one-way: it does not read Discord messages or send replies back to the website.

## Discord setup

1. Create a webhook for the Discord channel.
2. Keep the webhook URL private. Because the webhook URL was shared during setup, regenerate it in Discord before production deployment.

## Deploy

Install dependencies and authenticate Wrangler:

```sh
npm install
npx wrangler login
```

Create the D1 database and put the returned database ID in `wrangler.toml`:

```sh
npx wrangler d1 create live-support
```

This command prints a result containing a `database_id` value. Copy that value
over `REPLACE_WITH_D1_DATABASE_ID` in `wrangler.toml` before running any remote
migration or deploy. The placeholder is intentionally invalid and Cloudflare
will reject it with error 10021.

Run the migration remotely:

```sh
npx wrangler d1 migrations apply live-support --remote
```

Set the private secrets:

```sh
npx wrangler secret put DISCORD_WEBHOOK_URL
```

Replace `database_id` in `wrangler.toml`, then deploy:

```sh
npm run deploy
```

## Local development

For local testing, apply the migration locally and start Wrangler:

```sh
npx wrangler d1 migrations apply live-support --local
npm run dev
```

Use `wrangler secret put --local` for local secrets. The browser UI is served by the Worker at the local URL Wrangler prints.
