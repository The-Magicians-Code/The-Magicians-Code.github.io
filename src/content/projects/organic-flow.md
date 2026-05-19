---
title: Edge-native *commerce stack*
description: A Polish Brazilian Zouk dance school's WordPress + WooCommerce site, rebuilt as a custom edge-native commerce stack — lighter on the wire, easier to operate, deeper in abuse controls.
repoUrl: https://github.com/The-Magicians-Code/organic-flow
deepwikiUrl: https://deepwiki.com/The-Magicians-Code/organic-flow
order: 3
bentoSpan: wide
coverVariant: alt
draft: false
---

## Context

> Organic Flow is a Polish dance school running Brazilian Zouk classes, weekend retreats around Poland, and occasional ski trips abroad — previously selling registrations through WordPress + WooCommerce.

Organic Flow organises Brazilian Zouk dance classes — regular weekly sessions, weekend retreats around Poland, and the occasional ski trip abroad. Booking and payment ran through a WordPress 6.7.1 install with WooCommerce 9.4.3 and a GTranslate plugin for Polish/English copy. The stack worked — registrations happened — but the operating model leaked into everything: each plugin needed patching, theme updates risked layout regressions, abuse defense leaned on whatever plugin du jour, and a single copy change went through a CMS the brand owner didn't fully trust. The rebuild brief was simple: keep the booking flow, keep the brand voice, but trade the WordPress sandwich for something the brand owner could run alone.

## The problem

> The WordPress + WooCommerce sandwich shipped 5× more HTML per page, fanned out across 13 separate asset files, and locked the brand into a plugin maintenance loop just to keep the standard stack standing.

The old homepage rendered as 121 KB of HTML — most of it WooCommerce theme markup the visitor never saw — pulling in eight JavaScript files and five stylesheets before the cart even rendered. Beyond raw weight, the WordPress operating model leaked into everything around it: each plugin needed patching, theme updates risked layout regressions, the abuse-defense story changed whenever a security plugin was deprecated, and the editorial workflow ran through a CMS the brand owner didn't fully trust. The architectural cost was high too — i18n, payment, captcha, rate limiting, transactional email, and admin auth were each a separate plugin surface with its own update cycle and failure mode. None of the plugins were *wrong*. They just compounded into a maintenance loop nobody wanted to be inside.

## The approach

> Traded the WP plugin sandwich for a tight custom stack: Astro SSR on Cloudflare Workers, Supabase for everything stateful, Przelewy24 + bank transfer for payment, Resend for email, layered Cloudflare primitives for abuse defense.

The new stack is deliberately small. **Astro SSR on Cloudflare Workers** renders pages at the edge — Workers runtime, not Pages — with partial hydration meaning the default response ships almost no JavaScript. **Supabase** holds everything stateful: product catalog (including admin-edited markdown bodies), cover images via Storage, auth via SSR session cookies. **Payments** run through Przelewy24 (Poland's standard gateway) with a manual bank-transfer fallback for customers who prefer it — that fallback is a real reservation, expired by a second cron Worker after seven days. **Abuse defense** is layered: Cloudflare Turnstile on auth/cart, Rate Limit bindings on the same endpoints, CSRF double-submit tokens on every POST, signed Przelewy24 webhook verification, and admin pages return 404 (not 403) to non-admins so they leave no trace. **Outbound email** runs through Resend on a separate billing subdomain. **Order state** mirrors to a Google Sheet on every change, so the organiser can read the ledger without logging in. The brand owner edits products through a custom `/admin` web form; changes reflect on the public site within ~60 seconds without a redeploy.

What got chosen against: keeping WooCommerce (too much surface area for too little signal), Next.js (heavier default JS bundle, more runtime to ship at the edge), Stripe (Polish customers expect Przelewy24 by default).

## The results

> 5× smaller HTML on the wire, sub-500ms TTFB, content edits live in ~60 seconds, and abuse defense built from Cloudflare primitives that don't need update cycles.

The homepage HTML dropped from 121 KB to 25.4 KB — a 5× reduction on the wire — with TTFB sub-500ms from a cold connection. JavaScript ships only where there's an island that needs it (registration wizard, Turnstile widget, cart badge); everything else is server-rendered HTML the browser can use immediately. The admin workflow is the quieter win: product copy, prices, cover images, and active/inactive state are now self-serve, with changes visible to a logged-out visitor within ~60 seconds — no developer involved. Abuse defense moved from "whichever plugin we trust this month" to layered Cloudflare primitives (Turnstile + Rate Limits + CSRF + signed webhooks) that don't require update cycles. Per-PR Cloudflare preview URLs catch layout regressions before merge; the cron Worker quietly cleans up stale orders every five minutes without supervision.
