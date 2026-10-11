# Bolsillo

App de finanzas personales (Vite + React + Firebase).

1. `cp .env.example .env` y llena las 4 variables con las de tu proyecto Firebase.
2. `npm install`
3. `npm run dev` y abre http://localhost:5173
4. Publica `firestore.rules` en Firebase Console > Firestore > Reglas.
5. Cloudflare Pages: build `npm run build`, directorio de salida `dist`, y las mismas variables VITE_FIREBASE_*.
