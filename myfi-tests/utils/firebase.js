import 'dotenv/config';
import { initializeApp, applicationDefault, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

export function getDb() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const useEmu = String(process.env.USE_EMULATORS).toLowerCase() === 'true';

  if (!getApps().length) {
    const opts = useEmu
      ? { projectId }
      : {
          credential: process.env.GOOGLE_APPLICATION_CREDENTIALS
            ? cert(process.env.GOOGLE_APPLICATION_CREDENTIALS)
            : applicationDefault(),
          projectId
        };
    initializeApp(opts);
    if (useEmu) {
      process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
      process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
    }
  }
  return getFirestore();
}
