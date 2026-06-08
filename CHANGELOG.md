# Changelog

All notable changes to `scheduled_sending` should be documented in this file.

## [Unreleased]

- Ongoing development builds use `scheduled_sending::PLUGIN_VERSION` with a `+dev` suffix until the next release is cut.
- Preserve an actual-date copy in Sent by retrying the IMAP append in the user's authenticated Roundcube session.

## [1.3.1] - 2026-06-09

- Use the actual delivery time in the outgoing message.
- Improve scheduled-message recipient recovery and queue submission.

## [1.0.0] - 2026-04-11

- Formalized the plugin's self-metadata through `scheduled_sending::PLUGIN_VERSION` and `scheduled_sending::info()`.
- Aligned self-versioning with a cleaner release workflow while keeping existing plugin behavior intact.
