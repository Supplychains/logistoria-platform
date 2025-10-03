// setAdminClaim.cjs (CommonJS версия для Node.js)
// Запуск: node setAdminClaim.cjs

const { initializeApp, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const serviceAccount = require('./serviceAccountKey.json');

// ⚠️ ВСТАВЬ сюда UID из Firebase Console → Authentication → Users
const UID = 'lkbo98bGmRerXt4cUuo4T8xIXBu1';

initializeApp({ credential: cert(serviceAccount) });

getAuth()
  .setCustomUserClaims(UID, { admin: true })
  .then(() => console.log(`✅ Admin claim set for UID: ${UID}. Re-login in the app to refresh token.`))
  .catch((e) => {
    console.error('❌ Failed to set admin claim:', e);
    process.exit(1);
  });
