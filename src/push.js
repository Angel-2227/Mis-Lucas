import { getMessaging, getToken, isSupported } from 'firebase/messaging'
import { app } from './firebase'

export async function enablePush(api) {
  if (!import.meta.env.PROD) throw new Error('Las notificaciones solo funcionan en la versión publicada.')
  if (!(await isSupported())) throw new Error('Este navegador no admite notificaciones push. En iPhone o iPad instala primero la app (Compartir > Añadir a pantalla de inicio).')
  if ((await Notification.requestPermission()) !== 'granted') throw new Error('Permiso denegado. Actívalo en la configuración del navegador para este sitio.')
  const reg = await navigator.serviceWorker.ready
  const token = await getToken(getMessaging(app), { vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY, serviceWorkerRegistration: reg })
  if (!token) throw new Error('No se pudo obtener el token de notificaciones.')
  api.addToken(token)
}
