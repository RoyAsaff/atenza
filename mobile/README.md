# ATENZA — App móvil (estudiantes)

Flutter con Clean Architecture por features (espejo de `web/`):

```
lib/
  core/          # cliente HTTP, errores, almacén de sesión persistente
  features/
    auth/        # E1: login (contexto estudiante, sesión persistente) + registro
      domain/    #   entidades + interfaces de repositorio
      data/      #   implementación contra la API
      presentation/
    materias/    # E3: mis materias inscritas + unirse por código (HU-10)
```

## Primera vez

Este directorio trae `lib/` y `pubspec.yaml`; las carpetas de plataforma
(android/, etc.) se generan con:

```bash
cd mobile
flutter create . --platforms android
flutter pub get
```

## Ejecutar

**El default de `apiUrl` (`lib/core/api/api_cliente.dart`) apunta al backend
de producción** (`https://api-atenza.atenzabo.com`). Para desarrollar contra
tu backend local (`cd backend && npm run dev`, puerto 3000) hay que pisarlo
explícitamente con `--dart-define`:

```bash
# Emulador Android (10.0.2.2 = localhost de tu PC):
flutter run --dart-define=API_URL=http://10.0.2.2:3000

# Teléfono físico en la misma red (usa la IP de tu PC):
flutter run --dart-define=API_URL=http://192.168.x.x:3000
```

Un `flutter run`/`flutter build` **sin** `--dart-define=API_URL=...` queda
apuntando a producción — es lo que se quiere para generar el release
(`flutter build apk --release`), pero ojo si la idea era probar contra el
backend local.

## Decisiones aplicadas

- D-03: el login envía `contexto: 'estudiante'` explícito; la sesión se
  guarda en `shared_preferences` y persiste al cerrar y abrir la app.
- D-04: el código de estudiante se pide AL UNIRSE a cada materia
  (pertenece a la inscripción, no a la cuenta).
- Si la API responde 401 (sesión expirada/cerrada), se limpia la sesión
  y se vuelve al login.
