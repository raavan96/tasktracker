# Mailify transport setup — 15 September 2026

The server-side test transport is installed at `/opt/tasktracker-mailify`. Credentials are held only in `/etc/tasktracker-mailify.env`, root-owned with mode 0600. No credentials are committed to this repository. The existing application release was not changed or restarted.

## Exact provider settings used

- Endpoint: `https://v2.smtpmailify.com/api/sendMail`
- Header `mail-setting`: `25`
- Form `ecategory`: `transactional`
- Form `test`: `True`
- JSON `from`: `TaskTracker`
- JSON `fromname`: `TaskTracker Notification`
- JSON `tags`: `central_mails_internal ` (including the supplied trailing space)
- Single recipient: the user-authorized Aishwarya Naidu address.
- Subject: `TaskTracker Notification — connection test`

The request used native multipart FormData and JSON serialization instead of the pasted example's damaged quoting. One recipient was sent in the provider's nested recipient format. Redirects and automatic retries are disabled. A persistent attempt marker prevents accidental duplicate sends by rerunning the test command.

## Result

The one authorized test request completed. Mailify returned HTTP 200 with this body:

```json
{"success":[false]}
```

HTTP 200 alone is not delivery success. The response supplied no diagnostic message. The user subsequently supplied an inbox screenshot confirming that this exact test was delivered from TaskTracker@collegeduniamail.com. The initial inference of rejection was incorrect. No second request was sent. Private attempt and redacted response evidence are under `/var/lib/tasktracker-mailify`.

The configured sender/settings worked for this test. The provider still needs to explain its false success flag and test-mode semantics before reliable automatic retries or delivery-status claims can be implemented. Do not change those settings or guess sender addresses automatically.

## Validation and remaining work

Two unit tests passed: exact provider payload/auth construction and single-recipient handling; invalid-input rejection and no automatic retry after an ambiguous network failure. Lint and diff checks passed.

This is the transport/test setup only. Background notification delivery, the database email queue, templates, delivery tracking and email preferences are not yet enabled or deployed. Verify a successful provider response and test delivery before enabling team email notifications. Current in-app notifications remain operational.
