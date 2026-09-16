# TaskTracker domain — 16 September 2026

Primary address: https://tasktracker.top-menus.com

The existing A record resolves to 168.144.155.51. No AAAA or CNAME record was returned. Added `/etc/nginx/conf.d/tasktracker-domain.conf` with HTTP-to-HTTPS redirection, an ACME webroot exception, and an HTTPS reverse proxy to 127.0.0.1:3000. The configuration preserves forwarded Host/protocol headers and the 12 MB request limit. The IP address configuration remains available for existing sessions and links.

Issued a Let's Encrypt certificate at `/etc/letsencrypt/live/tasktracker.top-menus.com/`, expiring 15 December 2026. The existing twice-daily renewal service now renews both the IP and domain certificates, and reloads Nginx after renewal. The timer is active.

The notification template default origin now uses the domain. This standalone email-worker module was deployed atomically to the current release (43d968f) after checking its prior hash and passing the three Mailify/template tests. No test email was sent. Future build artifacts include the same source change.

Verified the public HTTPS login response (200), HTTP redirect preserving `/dashboard/insights`, browser login form and active app/Nginx/email/automation/renewal services. Cookies are host-specific, so existing users sign in again at the new domain.

Server configuration and previous email template backup: `/var/backups/tasktracker/domain-20260916T144637Z/`. The app was not restarted and no database changes were needed. Repository Nginx configuration: `deploy/tasktracker-domain-nginx.conf`.
