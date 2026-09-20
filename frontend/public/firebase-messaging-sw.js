importScripts(
  "https://www.gstatic.com/firebasejs/12.17.1/firebase-app-compat.js"
);

importScripts(
  "https://www.gstatic.com/firebasejs/12.17.1/firebase-messaging-compat.js"
);

/*
 * The Firebase web config (public keys) is supplied by the page via the
 * service-worker registration URL query string, so nothing is hard-coded
 * here. See buildMessagingSwUrl() in src/lib/firebase-messaging.ts.
 */
const swParams = new URLSearchParams(self.location.search);

firebase.initializeApp({
  apiKey: swParams.get("apiKey") || "",
  authDomain: swParams.get("authDomain") || "",
  projectId: swParams.get("projectId") || "",
  storageBucket: swParams.get("storageBucket") || "",
  messagingSenderId: swParams.get("messagingSenderId") || "",
  appId: swParams.get("appId") || "",
});

const messaging = firebase.messaging();

/*
|--------------------------------------------------------------------------
| BACKGROUND NOTIFICATION
|--------------------------------------------------------------------------
|
| The server sends a notification payload.
| Firebase displays it automatically when the
| SBC site is in the background / screen is off.
|
*/

/*
|--------------------------------------------------------------------------
| NOTIFICATION CLICK
|--------------------------------------------------------------------------
*/

self.addEventListener(
  "notificationclick",
  (event) => {
    event.notification.close();

    const url =
      event.notification?.data?.url ||
      "/student/dashboard";

    event.waitUntil(
      clients
        .matchAll({
          type: "window",
          includeUncontrolled: true,
        })
        .then((clientList) => {
          /*
           * If SBC is already open,
           * navigate/focus that tab.
           */

          for (const client of clientList) {
            if (
              "navigate" in client &&
              "focus" in client
            ) {
              return client
                .navigate(url)
                .then(() => client.focus());
            }
          }

          /*
           * Otherwise open SBC dashboard.
           */

          if (clients.openWindow) {
            return clients.openWindow(url);
          }

          return undefined;
        })
    );
  }
);