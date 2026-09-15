// Server-side transport. Keep credentials out of browser bundles and logs.
export const MAILIFY_ENDPOINT = 'https://v2.smtpmailify.com/api/sendMail';

export function mailifyConfig(env = process.env) {
  const required = ['MAILIFY_API_KEY', 'MAILIFY_API_SECRET', 'MAILIFY_FROM', 'MAILIFY_FROM_NAME'];
  for (const key of required) if (!env[key]) throw new Error(`Missing server configuration: ${key}`);
  return {key:env.MAILIFY_API_KEY, secret:env.MAILIFY_API_SECRET, from:env.MAILIFY_FROM, fromName:env.MAILIFY_FROM_NAME};
}

export async function sendMailify({recipient, name, subject, content}, config, fetcher = fetch) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient || '')) throw new Error('A valid test recipient is required.');
  if (!subject?.trim() || !content?.trim()) throw new Error('Subject and content are required.');
  const form = new FormData();
  form.set('ecategory', 'transactional');
  form.set('test', 'True');
  form.set('mail_data', JSON.stringify([{
    recipients:[[recipient,{name:name || recipient}]],
    fromname:config.fromName, content, subject, from:config.from,
    tags:'central_mails_internal '
  }]));
  // No automatic retry: the provider's idempotency and test-mode semantics
  // have not been documented. A timeout can still mean mail was accepted.
  const response = await fetcher(MAILIFY_ENDPOINT, {
    method:'POST', redirect:'error', signal:AbortSignal.timeout(30000),
    headers:{'mail-setting':'25','x-api-key':config.key,'x-api-secret':config.secret}, body:form
  });
  const raw = await response.text();
  let body; try {body=JSON.parse(raw);} catch {body=raw;}
  return {httpStatus:response.status, body};
}

// Kept for the explicitly authorized one-off connection test.
export const sendMailifyTest = sendMailify;
