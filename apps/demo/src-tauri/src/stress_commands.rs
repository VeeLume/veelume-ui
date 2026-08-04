//! IPC for the stress dataset.
//!
//! The 1.5M rows are built **lazily, once**, on first request rather than at
//! startup — generation is fast but not free, and a demo whose other five
//! surfaces pay for a dataset they never touch would be its own kind of lie
//! about performance.
//!
//! Single-word IPC parameter names, per the rule in `demo_commands.rs`.

use std::sync::OnceLock;

use crate::stress::{Entry, EntryPage, StressData};

static DATA: OnceLock<StressData> = OnceLock::new();

fn data() -> &'static StressData {
    DATA.get_or_init(StressData::generate)
}

#[tauri::command]
#[specta::specta]
pub fn stress_page(
    search: String,
    kind: String,
    order: String,
    desc: bool,
    limit: i32,
    cursor: Option<String>,
) -> EntryPage {
    data().page(&search, &kind, &order, desc, limit, cursor)
}

#[tauri::command]
#[specta::specta]
pub fn stress_get(id: i32) -> Result<Entry, String> {
    data()
        .get(id)
        .ok_or_else(|| format!("entry {id} not found"))
}

/// Build the dataset without asking for a page — lets the UI show the one-off
/// generation cost rather than blaming it on the first query.
#[tauri::command]
#[specta::specta]
pub fn stress_warm() -> i32 {
    // Must touch `data()` — returning the constant would report a cost nobody
    // paid, which is the exact failure mode this command exists to measure.
    data().page("", "", "", false, 0, None).total
}
