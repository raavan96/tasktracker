import {mailifyConfig, sendMailifyTest} from './mailify.mjs';
import {open, writeFile} from 'node:fs/promises';
import {resolve, join} from 'node:path';

if (process.argv[2] !== '--send-test') throw new Error('Explicit --send-test is required.');
const recipient=process.env.MAILIFY_TEST_RECIPIENT;
const evidenceDir=process.env.MAILIFY_EVIDENCE_DIR;
if (!evidenceDir) throw new Error('A private evidence directory is required.');
const config=mailifyConfig();
const directory=resolve(evidenceDir);
// An attempt is recorded before sending. Do not accidentally send twice on rerun.
const lock=await open(join(directory,'test-attempt.json'),'wx',0o600);
await lock.writeFile(JSON.stringify({attemptedAt:new Date().toISOString(),recipient}));await lock.close();
try {
  const result=await sendMailifyTest({recipient,name:'Aishwarya Naidu',subject:'TaskTracker Notification — connection test',content:'This is the authorized TaskTracker email connection test. Future task notifications have not been enabled. Open TaskTracker: https://168.144.155.51/'},config);
  const safe=JSON.stringify(result).split(config.key).join('[REDACTED]').split(config.secret).join('[REDACTED]');
  await writeFile(join(directory,'test-result.json'),safe,{mode:0o600});
  console.log(safe);
} catch {
  await writeFile(join(directory,'test-result.json'),JSON.stringify({outcome:'unconfirmed',message:'The request failed or timed out. Check the provider before retrying.'}),{mode:0o600});
  console.error('Delivery outcome is unconfirmed. No automatic retry was made.');process.exitCode=1;
}
