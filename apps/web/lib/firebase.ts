import admin from "firebase-admin";

let initialized = false;

function getFirebaseAdmin(): admin.app.App {
  if (!initialized) {
    const serviceAccount = process.env["FIREBASE_SERVICE_ACCOUNT"];
    if (!serviceAccount) throw new Error("FIREBASE_SERVICE_ACCOUNT env var is not set.");
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(JSON.parse(serviceAccount) as admin.ServiceAccount),
      });
    }
    initialized = true;
  }
  return admin.app();
}

export async function verifyFirebaseIdToken(idToken: string): Promise<{ phone: string }> {
  const app = getFirebaseAdmin();
  const decoded = await app.auth().verifyIdToken(idToken);
  const phone = decoded.phone_number;
  if (!phone) throw new Error("No phone number in Firebase token.");
  return { phone };
}
