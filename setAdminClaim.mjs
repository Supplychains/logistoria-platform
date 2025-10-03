// setAdminClaim.mjs
// Запуск: node setAdminClaim.mjs
// Требуется: serviceAccountKey.json (Firebase Console → Service accounts)

import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import serviceAccount from './serviceAccountKey.json' assert { type: 'json' };

// ⚠️ ВСТАВЬ сюда UID из Firebase Console → Authentication → Users
const UID = 'lkbo98bGmRerXt4cUuo4T8xIXBu1';

initializeApp({ credential: cert(serviceAccount) });

try {
  await getAuth().setCustomUserClaims(UID, { admin: true });
  console.log(`✅ Admin claim set for UID: ${UID}. Re-login in the app to refresh token.`);
} catch (e) {
  console.error('❌ Failed to set admin claim:', e);
  process.exit(1);
}
