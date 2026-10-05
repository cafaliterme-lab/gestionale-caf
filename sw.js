// Service worker minimo: serve solo a rendere il programma installabile come app.
// Non salva nulla in memoria: ogni apertura carica sempre la versione aggiornata dal server.
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', function () { /* rete normale */ });
