mod commands;
mod demo;
mod demo_commands;
mod settings;
mod state;
mod store;
mod stress;
mod stress_commands;

pub use demo::DemoState;
pub use state::AppState;

// Only used by the debug-only bindings export; gate the import so release
// builds don't warn about it.
#[cfg(all(debug_assertions, desktop))]
use specta_typescript::Typescript;
use tauri::Manager;
use tauri_specta::{collect_commands, Builder};

/// Where the generated TypeScript IPC bindings land. Anchored to the crate
/// directory, not the working directory — `tauri dev` and `cargo run` from the
/// workspace root have different cwds, and a relative path silently writes the
/// file into the wrong tree.
pub fn bindings_path() -> std::path::PathBuf {
    std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../src/lib/bindings.ts")
}

/// The single definition of the IPC surface. A command missing from this list
/// exists in Rust but not on the frontend.
///
/// Shared with `src/bin/export_bindings.rs` so CI can regenerate the bindings
/// without launching a window.
pub fn specta_builder() -> Builder<tauri::Wry> {
    Builder::<tauri::Wry>::new().commands(collect_commands![
        commands::settings_get,
        commands::settings_save,
        // The demo domain — the Rust twin of src/lib/fixtures/*. Same shapes,
        // same seeds, same behaviour, so the same UI runs over both transports.
        demo_commands::probes_list,
        demo_commands::probes_get,
        demo_commands::probes_save,
        demo_commands::probes_hijack,
        demo_commands::probes_reset,
        demo_commands::probes_page,
        demo_commands::editions_list,
        demo_commands::shelf_list,
        demo_commands::shelf_toggle,
        demo_commands::library_reset,
        demo_commands::loans_list,
        demo_commands::loans_page,
        demo_commands::loans_get,
        demo_commands::loans_save,
        demo_commands::loans_return,
        demo_commands::loans_cancel,
        demo_commands::loans_mark_lost,
        demo_commands::loans_archive,
        demo_commands::loans_create,
        demo_commands::loans_reset,
        demo_commands::prefs_list,
        demo_commands::prefs_save,
        demo_commands::prefs_reset,
        stress_commands::stress_page,
        stress_commands::stress_get,
        stress_commands::stress_warm,
    ])
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = specta_builder();

    // Writes into the source tree, which doesn't exist on a device — running
    // this on mobile panics and kills the app.
    #[cfg(all(debug_assertions, desktop))]
    builder
        .export(Typescript::default(), bindings_path())
        .expect("failed to export typescript bindings");

    #[allow(unused_mut)]
    let mut app = tauri::Builder::default();

    app.plugin(tauri_plugin_opener::init())
        .invoke_handler(builder.invoke_handler())
        .setup(move |app| {
            builder.mount_events(app);

            #[cfg(desktop)]
            {
                app.handle()
                    .plugin(tauri_plugin_updater::Builder::new().build())?;
                app.handle().plugin(tauri_plugin_process::init())?;
            }

            let data_dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&data_dir)?;
            let state = AppState::load(&data_dir);

            app.manage(state);
            // Seeded per run and never persisted: this is a harness, and state
            // surviving a restart would be a third thing to keep in sync with
            // the fixtures for no gain.
            app.manage(DemoState::default());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
