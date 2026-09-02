// E9 · App de escritorio (exámenes de código) — el lado Rust no tiene
// lógica de negocio propia: solo registra los plugins que el frontend usa
// (store para la sesión persistida, opener por si algún día hace falta
// abrir un link externo). Todo el modo kiosko (fullscreen, detección de
// pérdida de foco/minimizado/cierre) se maneja desde React vía
// @tauri-apps/api/window — ver desktop/src/core/kiosco/useModoKiosko.ts.

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
