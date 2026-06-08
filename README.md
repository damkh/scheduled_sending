# Scheduled Sending

![Downloads](https://img.shields.io/github/downloads/texxasrulez/scheduled_sending/total?style=plastic&logo=github&logoColor=white&label=Downloads&labelColor=aqua&color=blue)
[![Packagist Downloads](https://img.shields.io/packagist/dt/texxasrulez/scheduled_sending?style=plastic&logo=packagist&logoColor=white&label=Downloads&labelColor=blue&color=gold)](https://packagist.org/packages/texxasrulez/scheduled_sending)
[![Packagist Version](https://img.shields.io/packagist/v/texxasrulez/scheduled_sending?style=plastic&logo=packagist&logoColor=white&label=Version&labelColor=blue&color=limegreen)](https://packagist.org/packages/texxasrulez/scheduled_sending)
[![Github License](https://img.shields.io/github/license/texxasrulez/scheduled_sending?style=plastic&logo=github&label=License&labelColor=blue&color=coral)](https://github.com/texxasrulez/scheduled_sending/LICENSE)
[![GitHub Stars](https://img.shields.io/github/stars/texxasrulez/scheduled_sending?style=plastic&logo=github&label=Stars&labelColor=blue&color=deepskyblue)](https://github.com/texxasrulez/scheduled_sending/stargazers)
[![GitHub Issues](https://img.shields.io/github/issues/texxasrulez/scheduled_sending?style=plastic&logo=github&label=Issues&labelColor=blue&color=aqua)](https://github.com/texxasrulez/scheduled_sending/issues)
[![GitHub Contributors](https://img.shields.io/github/contributors/texxasrulez/scheduled_sending?style=plastic&logo=github&logoColor=white&label=Contributors&labelColor=blue&color=orchid)](https://github.com/texxasrulez/scheduled_sending/graphs/contributors)
[![GitHub Forks](https://img.shields.io/github/forks/texxasrulez/scheduled_sending?style=plastic&logo=github&logoColor=white&label=Forks&labelColor=blue&color=darkorange)](https://github.com/texxasrulez/scheduled_sending/forks)
[![Donate Paypal](https://img.shields.io/badge/Paypal-Money_Please!-blue.svg?style=plastic&labelColor=blue&color=forestgreen&logo=paypal)](https://www.paypal.me/texxasrulez)

Schedule messages to be transmitted when you want them to go, including messages with attachments.

## User Guide: Scheduling Messages

This plugin adds a **Send Later** control to the Roundcube compose screen.

### Schedule a message

1. Open **Compose** and write the message as usual.
2. Fill in recipients, subject, body, and attachments.
3. Choose the planned send date and time in the scheduled sending control.
4. Click **Send Later**.
5. The message is placed into the scheduled queue and will be sent by the background worker at or shortly after the selected time.

Scheduled times are displayed in the configured scheduled timezone. Internally, the queue stores timestamps in UTC.

### View scheduled messages

Open the scheduled messages page in Roundcube settings to review queued messages. The list shows the planned send time, recipient, subject, status, and available actions.

Common statuses:

- `queued` — waiting for the planned send time.
- `sending` — currently being processed by the worker.
- `sent` — already sent and no longer editable from the queue list.
- `error` — sending failed and the worker may retry depending on configuration.
- `canceled` — canceled by the user.

### Change the send time

You can change the planned send time for messages that are still waiting in the queue. Use the edit/reschedule action in the scheduled messages list and enter a new future date and time.

### Editing message contents

At the moment, the scheduled messages UI supports changing only the planned send time. It does **not** provide full editing of the message contents after scheduling.

This means that after a message is scheduled, users should not expect to edit:

- recipients,
- subject,
- message body,
- attachments.

If the content needs to be changed, the safest workflow is:

1. Cancel or delete the scheduled message.
2. Create a new message with the corrected content.
3. Schedule it again.

This limitation exists because scheduled messages are stored as queued MIME payloads for reliable background delivery. Full content editing would require reopening the queued message as a Roundcube draft and updating the queue record after saving.

### Practical notes

- Pick a future time. Past times are rejected.
- The worker runs periodically, so delivery may happen shortly after the exact selected minute.
- The outgoing message uses the actual delivery time, not the time when the message was composed or scheduled.
- After successful delivery, a copy is saved in the sender's **Sent** folder with the same actual delivery timestamp.
- If the background worker cannot access the sender's IMAP session, the Sent copy is saved on the sender's next authenticated Roundcube request. Delivery to recipients is not delayed by this synchronization.
- Do not remove or change the scheduled queue record manually unless you are an administrator.
- If a scheduled message fails, contact the mail administrator with the approximate scheduled time and recipient.

## Руководство пользователя: отложенная отправка

Плагин добавляет кнопку **Отправить позже** в окно создания письма Roundcube.

### Как запланировать письмо

1. Откройте **Создать письмо** и подготовьте письмо как обычно.
2. Укажите получателей, тему, текст письма и вложения.
3. Выберите дату и время отправки в поле отложенной отправки.
4. Нажмите **Отправить позже**.
5. Письмо будет добавлено в очередь и отправлено фоновым обработчиком в выбранное время или немного позже.

Время в интерфейсе отображается в настроенной таймзоне. Внутри очереди время хранится в UTC.

### Где посмотреть запланированные письма

Список запланированных писем доступен в настройках Roundcube. В нем отображаются время отправки, получатель, тема, статус и доступные действия.

Основные статусы:

- `queued` — письмо ожидает времени отправки.
- `sending` — письмо сейчас обрабатывается фоновым обработчиком.
- `sent` — письмо уже отправлено и больше не редактируется из списка очереди.
- `error` — при отправке возникла ошибка; повторная попытка зависит от настроек.
- `canceled` — отправка отменена пользователем.

### Как изменить время отправки

Для писем, которые еще ожидают отправки, можно изменить только запланированное время. Используйте действие редактирования/переноса в списке запланированных писем и укажите новую дату и время в будущем.

### Редактирование содержимого письма

На текущий момент интерфейс запланированных писем позволяет менять только время отправки. Полноценное редактирование содержимого уже запланированного письма не поддерживается.

После планирования письма пользователь не должен рассчитывать на изменение:

- получателей,
- темы,
- текста письма,
- вложений.

Если содержимое нужно изменить, самый безопасный порядок действий:

1. Отменить или удалить запланированное письмо.
2. Создать новое письмо с правильным содержимым.
3. Снова запланировать отправку.

Это ограничение связано с тем, что запланированные письма сохраняются как MIME-сообщения в очереди для надежной фоновой отправки. Для полноценного редактирования нужно было бы открывать такое письмо как черновик Roundcube и после сохранения обновлять запись в очереди.

### Практические замечания

- Выбирайте время в будущем. Время в прошлом будет отклонено.
- Фоновый обработчик запускается периодически, поэтому письмо может уйти не строго в выбранную секунду, а немного позже.
- В отправленном письме указывается фактическое время отправки, а не время составления или постановки в очередь.
- После успешной доставки копия письма сохраняется в папке **Отправленные** с тем же фактическим временем отправки.
- Если фоновый обработчик не имеет доступа к IMAP-сессии отправителя, копия появится в папке **Отправленные** при следующем авторизованном запросе пользователя в Roundcube. Это не задерживает доставку получателю.
- Не изменяйте записи очереди вручную, если вы не администратор.
- Если письмо не отправилось, сообщите администратору примерное время отправки и получателя.

# Scheduled Sending — Installation Guide for Roundcube

This plugin lets users **schedule emails to be sent later**. It includes a web UI, localization, and CLI helpers to trigger a **queue worker** that delivers messages when they’re due.

This guide covers both **Composer-based** and **manual** installation, database setup, configuration, and setting up the worker trigger (cron/systemd).

---

## 1) Requirements
- Roundcube (modern version; plugin uses standard `rcube_plugin` API).
- PHP compatible with your Roundcube (PHP 8.x recommended).
- Database access for creating the plugin table.
- Ability to run a periodic job (cron or systemd timer) to call the worker endpoint.
- Web access to your Roundcube URL for the worker (or curl from cron).

---

## 2) Install the plugin

### Option A — Composer (preferred)
1. Place the plugin in a VCS or local path that Composer can reference.
2. Ensure your Roundcube root has the **Roundcube plugin installer** in `require` (most distros do):

   ```json
   "require": {
     "roundcube/plugin-installer": "^0.3"
   }
   ```

3. Add a repository that points to the plugin (adjust the path):

   ```json
   "repositories": [
     { "type": "path", "url": "../scheduled_sending_composer" }
   ],
   "require": {
     "texxasrulez/scheduled_sending": "*"
   }
   ```

4. Run:
   ```bash
   composer install
   # or
   composer require texxasrulez/scheduled_sending:*
   ```

> Composer will install the plugin under `plugins/scheduled_sending` (per its `composer.json`).

### Updating a Composer installation

To install a tagged release such as `1.3.2`, update the package from the Roundcube root:

```bash
composer require texxasrulez/scheduled_sending:^1.3.2 --with-all-dependencies
composer show texxasrulez/scheduled_sending
```

The installed version is recorded in `composer.lock`. The plugin also exposes its version through `scheduled_sending::info()`.

After replacing PHP plugin files, restart the PHP-FPM service or the PHP/Roundcube container so OPcache cannot continue executing stale bytecode:

```bash
sudo systemctl restart php8.2-fpm
```

Adjust the service name to the PHP version used by the Roundcube web process.

### Option B — Manual install
1. Unzip the plugin into Roundcube’s plugins directory:
   ```bash
   cd /path/to/roundcube
   unzip /tmp/scheduled_sending.zip -d plugins/scheduled_sending
   ```
2. Ensure permissions match your web server user:
   ```bash
   chown -R www-data:www-data plugins/scheduled_sending (or tailor to your server's user:group)
   find plugins/scheduled_sending -type d -exec chmod 755 {} \;
   find plugins/scheduled_sending -type f -exec chmod 644 {} \;
   ```

---

## 3) Database schema

Create the queue table (MySQL/MariaDB):

- File: `plugins/scheduled_sending/SQL/mysql.initial.sql`
- SQL (for convenience):

```sql
CREATE TABLE `scheduled_queue` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `user_id` bigint(20) UNSIGNED NOT NULL,
  `identity_id` bigint(20) UNSIGNED NOT NULL DEFAULT 0,
  `scheduled_at` datetime NOT NULL,
  `status` varchar(16) NOT NULL DEFAULT 'queued',
  `raw_mime` mediumtext DEFAULT NULL,
  `meta_json` text DEFAULT NULL,
  `dedupe_key` varchar(64) DEFAULT NULL,
  `last_error` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

ALTER TABLE `scheduled_queue`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_scheduled_dedupe` (`dedupe_key`),
  ADD KEY `idx_sched_at` (`scheduled_at`),
  ADD KEY `idx_status` (`status`);

ALTER TABLE `scheduled_queue`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;
COMMIT;
```

> If you use a database other than MySQL/MariaDB, adapt the SQL accordingly.

---

## 4) Configuration

Copy the example config and edit it:

```bash
cd plugins/scheduled_sending
cp config.inc.php.dist config.inc.php
```

Key options (from `config.inc.php.dist`):

```php
$config['scheduled_sending_table']       = 'scheduled_queue';
$config['scheduled_worker_batch']        = 20;
$config['scheduled_timezone']            = 'America/Chicago'; // optional; storage is UTC
$config['scheduled_debug']               = false;
$config['scheduled_force_plugin_assets'] = false;
$config['scheduled_show_fab']            = true;

$config['scheduled_sending_worker_token'] = '32_character_key';
$config['scheduled_sending_delivery']     = 'smtp';  // 'smtp', 'mail', or 'none' for dry-run
$config['scheduled_sending_batch']        = 25;      // optional
$config['scheduled_sending_sent_folder']  = 'Sent';  // optional

$config['db_table_scheduled_sending']     = 'scheduled_queue';

$config['scheduled_sending_lock_key']     = 'scheduled_sending_worker';
$config['scheduled_sending_lock_timeout'] = 10; // seconds
```

**Important: set a strong** `scheduled_sending_worker_token` (32+ random characters).

---

## 5) Enable the plugin in Roundcube

Edit your Roundcube main config (e.g. `config/config.inc.php`) and add the plugin name:

```php
// Add 'scheduled_sending' to the plugins array
$config['plugins'] = array_merge($config['plugins'] ?? [], ['scheduled_sending']);
```

Clear Roundcube caches if needed (e.g., remove `temp/*` & `cache/*` contents, keeping the dirs).

---

## 6) Queue worker — how delivery is triggered

The plugin exposes an **HTTP worker action** that sends all messages scheduled at or before “now”. The worker requires the token from your `config.inc.php`.

**Worker URL shape:**

```
https://YOUR-ROUNDCUBE-BASE/?_task=mail&_action=plugin.scheduled_sending.send_due&_token=32_character_key
```

There are two convenient ways to call it periodically:

### A) Via provided CLI helper (recommended)

- `bin/scheduled_queue_worker.php` makes an HTTP request to the worker URL.
- `bin/scheduled_send.php` is a shim that requires the worker script.

**Examples:**

```bash
# Using CLI flags
php plugins/scheduled_sending/bin/scheduled_queue_worker.php   --url="https://mail.example.com/roundcube/"   --token="32_character_key"

# Or via environment variables
SS_WORKER_URL="https://mail.example.com/roundcube/" SS_WORKER_TOKEN="32_character_key" php plugins/scheduled_sending/bin/scheduled_queue_worker.php
```

**Cron:** run once per minute (or every 5 minutes if your use-case is lax):

```cron
* * * * * SS_WORKER_URL="https://mail.example.com/roundcube/" SS_WORKER_TOKEN="32_character_key"     php /var/www/roundcube/plugins/scheduled_sending/bin/scheduled_queue_worker.php >> /var/log/roundcube/scheduled_worker.log 2>&1
```

### B) Direct HTTP call (curl/wget)

```bash
curl -fsS "https://mail.example.com/roundcube/?_task=mail&_action=plugin.scheduled_sending.send_due&_token=32_character_key"
```

Cron variant:

```cron
* * * * * curl -fsS "https://mail.example.com/roundcube/?_task=mail&_action=plugin.scheduled_sending.send_due&_token=32_character_key" >> /var/log/roundcube/scheduled_worker.log 2>&1
```

> The worker is idempotent and gated by a lock (`scheduled_sending_lock_key` / timeout) to avoid overlap.

---

## 7) Verifying

1. Log in to Roundcube, compose a message, pick a **future time**, and schedule.
2. Confirm a row is added to the `scheduled_queue` table.
3. Ensure your cron/systemd job runs; the message should send at/after the scheduled time.
4. Check logs:
   - Web server access/error logs
   - `logs/` or a dedicated log (the plugin writes via `rcube::write_log('scheduled_sending', ...)` when enabled)
5. Confirm sent messages land in the configured **Sent** folder (if set).

If the worker has no authenticated IMAP session, open Roundcube as the sender and refresh the mailbox. The plugin will retry the pending Sent-folder append in that authenticated session.

---

## 8) Troubleshooting

- **401/403 on worker call**: bad or missing `_token`. Verify `scheduled_sending_worker_token` matches the value you pass.
- **Nothing gets sent**: verify the cron is running and the URL points to your Roundcube base. Check that due items exist in `scheduled_queue` and `status` is `queued`.
- **Timezones**: UI may use `scheduled_timezone`; storage is UTC. Ensure your server clock is correct (NTP) and PHP `date.timezone` is set.
- **Mail transport**: `scheduled_sending_delivery` uses Roundcube’s SMTP by default. If using `mail` or a relay, ensure it’s configured correctly in Roundcube.
- **Message delivered but missing from Sent**: log in as the sender and refresh Roundcube so the pending IMAP append can run. Check `meta_json` for `sent_append_pending`, `sent_saved`, and `sent_save_error`.
- **Updated code is not taking effect**: verify the actual file under `plugins/scheduled_sending`, then restart PHP-FPM or the relevant container to clear OPcache.
- **Locks**: if you see messages about an active lock, either reduce the cron frequency or increase `scheduled_sending_lock_timeout`.

---

## 9) Uninstall

- Remove the plugin folder or uninstall via Composer.
- Optionally drop the table:
  ```sql
  DROP TABLE IF EXISTS `scheduled_queue`;
  ```

---

## 10) File map (high-level)

- `scheduled_sending.php` — main plugin class (registers actions/UI)
- `config.inc.php.dist` — example configuration
- `SQL/mysql.initial.sql` — schema for the queue table
- `bin/scheduled_queue_worker.php` — CLI helper (HTTP to worker)
- `bin/scheduled_send.php` — thin wrapper including the worker helper
- `templates/` — Roundcube templates for UI
- `localization/` — i18n strings
- `skins/` / `js/` — assets

---

**That’s it.** Once the table exists, the config is set (especially `_token`), and the cron/systemd job is running, scheduled emails will go out on time.

Enjoy!

:moneybag: **Donations** :moneybag:

If you use this plugin and would like to show your appreciation by buying me a cup of coffee, I surely would appreciate it. A regular cup of Joe is sufficient, but a Starbucks Coffee would be better ... \
Zelle (Zelle is integrated within many major banks Mobile Apps by default) - Just send to texxasrulez at yahoo dot com \
No Zelle in your banks mobile app, no problem, just click [Paypal](https://paypal.me/texxasrulez?locale.x=en_US) and I can make a Starbucks run ...

I appreciate the interest in this plugin and hope all the best ...
