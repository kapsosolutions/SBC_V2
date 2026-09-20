import {
  getMessaging,
  getToken,
  isSupported,
  onMessage,
  type MessagePayload,
} from "firebase/messaging";

import { getApp } from "firebase/app";

import { auth, db } from "@/lib/firebase";

import {
  doc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";

const VAPID_KEY =
  process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

/*
 * Build the messaging service-worker URL, passing the (public) Firebase
 * web config as query params so the static SW file does not need any
 * hard-coded configuration.
 */
function buildMessagingSwUrl(): string {
  const params = new URLSearchParams({
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
    messagingSenderId:
      process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
  });
  return `/firebase-messaging-sw.js?${params.toString()}`;
}

/*
|--------------------------------------------------------------------------
| ENABLE STUDENT NOTIFICATIONS
|--------------------------------------------------------------------------
*/

export async function enableStudentNotifications() {
  if (typeof window === "undefined") {
    throw new Error(
      "Notifications are only available in a browser."
    );
  }

  if (!("Notification" in window)) {
    throw new Error(
      "This browser does not support notifications."
    );
  }

  if (!VAPID_KEY) {
    throw new Error(
      "Firebase VAPID key is not configured."
    );
  }

  const supported = await isSupported();

  if (!supported) {
    throw new Error(
      "Web push is not supported in this browser."
    );
  }

  const user = auth.currentUser;

  if (!user) {
    throw new Error(
      "Please login first."
    );
  }

  /*
   * Request browser permission
   */

  const permission =
    await Notification.requestPermission();

  if (permission !== "granted") {
    throw new Error(
      "Notification permission was not granted."
    );
  }

  /*
   * Register Firebase Messaging Service Worker
   */

  const registration =
    await navigator.serviceWorker.register(
      buildMessagingSwUrl()
    );

  /*
   * Wait until service worker is ready
   */

  await navigator.serviceWorker.ready;

  const app = getApp();

  const messaging =
    getMessaging(app);

  /*
   * Get FCM token
   */

  const token = await getToken(
    messaging,
    {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration:
        registration,
    }
  );

  if (!token) {
    throw new Error(
      "Unable to get notification token."
    );
  }

  console.log(
    "✅ FCM token generated successfully."
  );

  /*
   * Save FCM token
   */

  await setDoc(
    doc(
      db,
      "fcmTokens",
      token
    ),
    {
      token,

      studentId:
        user.uid,

      platform:
        "web",

      userAgent:
        navigator.userAgent,

      createdAt:
        serverTimestamp(),

      updatedAt:
        serverTimestamp(),
    },
    {
      merge: true,
    }
  );

  console.log(
    "✅ FCM token saved to Firestore."
  );

  return token;
}

/*
|--------------------------------------------------------------------------
| FOREGROUND NOTIFICATION LISTENER
|--------------------------------------------------------------------------
|
| This handles notifications when the
| Student Dashboard is currently open.
|
*/

export async function listenForStudentNotifications(
  onNotification?: (
    payload: MessagePayload
  ) => void
) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const supported =
    await isSupported();

  if (!supported) {
    console.log(
      "Firebase Messaging is not supported."
    );

    return () => {};
  }

  const app = getApp();

  const messaging =
    getMessaging(app);

  const unsubscribe =
    onMessage(
      messaging,
      async (payload) => {
        console.log(
          "🔔 SBC foreground FCM message received:",
          payload
        );

        /*
         * Send payload to caller
         */

        if (onNotification) {
          onNotification(
            payload
          );
        }

        /*
         * Show notification while
         * dashboard is open.
         */

        try {
          if (
            Notification.permission !==
            "granted"
          ) {
            console.log(
              "Notification permission is not granted."
            );

            return;
          }

          /*
           * Get registered Firebase
           * messaging service worker.
           */

          const registration =
            await navigator.serviceWorker.getRegistration(
              "/firebase-messaging-sw.js"
            );

          const title =
            payload.notification
              ?.title ||
            "SBC Notification";

          const body =
            payload.notification
              ?.body ||
            "";

          const url =
            payload.data?.url ||
            "/student/dashboard";

          /*
           * Prefer Service Worker
           * notification.
           */

          if (registration) {
            await registration.showNotification(
              title,
              {
                body,

                icon:
                  "/icon-192.png",

                data: {
                  url,
                },

                badge:
                  "/icon-192.png",

              }
            );

            console.log(
              "✅ Foreground notification displayed."
            );

            return;
          }

          /*
           * Browser fallback.
           */

          new Notification(
            title,
            {
              body,

              icon:
                "/icon-192.png",
            }
          );

        } catch (error) {
          console.error(
            "Foreground notification display error:",
            error
          );
        }
      }
    );

  console.log(
    "✅ SBC foreground notification listener started."
  );

  return unsubscribe;
}