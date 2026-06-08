# Changelog

All notable changes to `scheduled_sending` should be documented in this file.

## [Unreleased]

- Ongoing development builds use `scheduled_sending::PLUGIN_VERSION` with a `+dev` suffix until the next release is cut.

## [1.3.2] - 2026-06-09

- Set the message `Date` header to the actual delivery time.
- Save the delivered MIME message in the sender's Sent folder with the actual delivery timestamp.
- Retry the Sent-folder IMAP append during the sender's next authenticated Roundcube request when the background worker has no usable IMAP session.
- Record pending and completed Sent-folder synchronization in queue metadata.
- Add plugin self-metadata so Roundcube displays the current plugin version independently of Composer lock metadata.
- Fix the by-reference argument passed to `rcube_imap::save_message()`.

## [1.3.1] - 2026-06-09

- Improve scheduled-message recipient recovery and queue submission.

## [1.0.0] - 2026-04-11

- Formalized the plugin's self-metadata through `scheduled_sending::PLUGIN_VERSION` and `scheduled_sending::info()`.
- Aligned self-versioning with a cleaner release workflow while keeping existing plugin behavior intact.
