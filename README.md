# Sistema de Control de Acceso — Comedor

PWA mobile-first para el auto-registro de comensales y la exportación del padrón Hikvision (Excel + ZIP de fotos).

## Stack

React 18+ (Vite) · TypeScript · Tailwind CSS · Firebase (Firestore + Storage + Auth) · PWA

## Configuración rápida

1. Copie `.env.example` a `.env.local` y complete las claves del proyecto Firebase.
2. En Firebase Console:
   - Active **Authentication → Email/Password**.
   - Cree el usuario `VITE_ADMIN_EMAIL` con contraseña igual a `VITE_ADMIN_PIN`.
   - Cree Firestore y Storage.
   - Despliegue reglas: `firebase deploy --only firestore:rules,storage`.
3. CORS de Storage (necesario para armar el ZIP en el navegador):

```bash
gsutil cors set storage-cors.json gs://SU_BUCKET
```

4. Instale y ejecute:

```bash
npm install
npm run dev
```

- Enrolamiento (QR en mesas): `/`
- Administración: `/admin`

## Exportación Hikvision

- **Nómina `.xlsx`**: filas 1–6 de reglas oficiales, encabezados en fila 7 (`ID`, `*First Name`, `*Last Name`, `*Department`, `*Email`), datos desde fila 8.
- **Fotos `.zip`**: JPEG nombrados `APELLIDO NOMBRE_DNI.jpg` (ejemplo: `SOTARELLO GUSTAVO ANTONIO_13748426.jpg`).
