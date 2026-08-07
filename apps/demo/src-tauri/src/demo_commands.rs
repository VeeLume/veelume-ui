//! The demo domain's IPC surface — the Rust twin of `src/lib/fixtures/*`.
//!
//! ⚑ IPC parameter names are deliberately SINGLE WORDS.
//!
//! `#[tauri::command(rename_all = "snake_case")]` looked like the fix for
//! `edition_id`, and it is a trap: **tauri-specta does not honour it.** Tauri's
//! runtime would then expect `edition_id` while the generated binding sent
//! `editionId` — raw `invoke` working and the typed wrapper silently broken.
//! With one-word names camelCase and snake_case are identical and the question
//! cannot arise.

use tauri::{AppHandle, Emitter, State};

use crate::demo::{
    DemoState, Edition, Loan, LoanChange, LoanPage, Preferences, Probe, ProbePage, ProbePatch,
    ShelfEntry,
};

/// Announce a change the domain reported. Fire-and-forget: a command's response
/// must not couple to event delivery.
///
/// ⚑ This is the Tauri half of the transport split. The domain in `demo.rs`
/// decides WHAT changed and hands back a `LoanChange`; this decides how to say
/// so. `demo_http.rs` does the same job with an SSE broadcast, over the exact
/// same domain calls.
fn announce(app: &AppHandle, change: LoanChange) {
    let _ = app.emit("loans-changed", change);
}

// ── probes ─────────────────────────────────────────────────────────────────

#[tauri::command]
#[specta::specta]
pub fn probes_list(state: State<'_, DemoState>, scope: String) -> Vec<Probe> {
    state.0.lock().unwrap().probes_mut(&scope).clone()
}

#[tauri::command]
#[specta::specta]
pub fn probes_get(state: State<'_, DemoState>, id: String, scope: String) -> Result<Probe, String> {
    state
        .0
        .lock()
        .unwrap()
        .probes_mut(&scope)
        .iter()
        .find(|p| p.id == id)
        .cloned()
        .ok_or_else(|| format!("probe {id} not found"))
}

/// Full-replace semantics, matching stibu's `UpdateCustomerInput`.
#[tauri::command]
#[specta::specta]
pub fn probes_save(
    state: State<'_, DemoState>,
    body: Probe,
    scope: String,
) -> Result<Probe, String> {
    let mut data = state.0.lock().unwrap();
    let hijack = data.hijack.take();
    let list = data.probes_mut(&scope);
    let i = list
        .iter()
        .position(|p| p.id == body.id)
        .ok_or_else(|| format!("probe {} not found", body.id))?;

    let mut applied = body;
    if let Some(patch) = hijack {
        if let Some(note) = patch.note {
            applied.note = note;
        }
    }
    list[i] = applied.clone();
    Ok(applied)
}

/// Test control: make the next save return something else.
#[tauri::command]
#[specta::specta]
pub fn probes_hijack(state: State<'_, DemoState>, patch: ProbePatch) {
    state.0.lock().unwrap().hijack = Some(patch);
}

#[tauri::command]
#[specta::specta]
pub fn probes_reset(state: State<'_, DemoState>) {
    let mut data = state.0.lock().unwrap();
    let fresh = crate::demo::DemoData::seeded();
    data.probes_alpha = fresh.probes_alpha;
    data.probes_beta = fresh.probes_beta;
    data.probes_paged = fresh.probes_paged;
    data.hijack = None;
}

/// The paged rig: keyset paging plus a pushed-down search over a corpus small
/// enough to exhaust. This is the deterministic test bed for the collection's
/// search escalation — a 100 cap exhausts the 40-record base and search stays
/// local; a 20 cap leaves it capped and every term pushes down.
#[tauri::command]
#[specta::specta]
pub fn probes_page(
    state: State<'_, DemoState>,
    search: String,
    limit: i32,
    cursor: Option<String>,
) -> ProbePage {
    let data = state.0.lock().unwrap();
    let needle = search.trim().to_lowercase();
    let hits: Vec<&Probe> = data
        .probes_paged
        .iter()
        .filter(|p| {
            needle.is_empty()
                || p.name.to_lowercase().contains(&needle)
                || p.id.to_lowercase().contains(&needle)
        })
        .collect();

    let after = match cursor {
        Some(c) => hits.iter().position(|p| p.id == c).map_or(0, |i| i + 1),
        None => 0,
    };
    let take = limit.max(0) as usize;
    let slice: Vec<Probe> = hits
        .iter()
        .skip(after)
        .take(take)
        .map(|p| (*p).clone())
        .collect();
    let more = after + slice.len() < hits.len();

    ProbePage {
        cursor: if more {
            slice.last().map(|p| p.id.clone())
        } else {
            None
        },
        total: hits.len() as i32,
        done: !more,
        records: slice,
    }
}

// ── library ────────────────────────────────────────────────────────────────

#[tauri::command]
#[specta::specta]
pub fn editions_list(state: State<'_, DemoState>) -> Vec<Edition> {
    state.0.lock().unwrap().editions.clone()
}

#[tauri::command]
#[specta::specta]
pub fn shelf_list(state: State<'_, DemoState>) -> Vec<ShelfEntry> {
    state.0.lock().unwrap().shelf.clone()
}

/// Three-state cycle: none → owned → want → none. Not a record-shaped update,
/// which is why the frontend calls it directly and then refreshes rather than
/// routing it through the collection's write layer.
#[tauri::command]
#[specta::specta]
pub fn shelf_toggle(state: State<'_, DemoState>, id: String) {
    let mut data = state.0.lock().unwrap();
    match data.shelf.iter().position(|s| s.edition_id == id) {
        None => data.shelf.push(ShelfEntry {
            edition_id: id,
            state: "owned".into(),
        }),
        Some(i) if data.shelf[i].state == "owned" => data.shelf[i].state = "want".into(),
        Some(i) => {
            data.shelf.remove(i);
        }
    }
}

#[tauri::command]
#[specta::specta]
pub fn library_reset(state: State<'_, DemoState>) {
    let mut data = state.0.lock().unwrap();
    let fresh = crate::demo::DemoData::seeded();
    data.editions = fresh.editions;
    data.shelf = fresh.shelf;
}

// ── loans ──────────────────────────────────────────────────────────────────

#[tauri::command]
#[specta::specta]
pub fn loans_list(state: State<'_, DemoState>, year: String) -> Vec<Loan> {
    state.0.lock().unwrap().loan_list(&year)
}

/// The record-shaped edit — the only loan operation that belongs to the
/// collection's write layer.
#[tauri::command]
#[specta::specta]
pub fn loans_save(
    app: AppHandle,
    state: State<'_, DemoState>,
    body: Loan,
    year: String,
) -> Result<Loan, String> {
    let (saved, change) = state.0.lock().unwrap().loan_save(&year, body)?;
    announce(&app, change);
    Ok(saved)
}

/// 1 — soft delete. Returns the record.
#[tauri::command]
#[specta::specta]
pub fn loans_return(
    app: AppHandle,
    state: State<'_, DemoState>,
    id: String,
    year: String,
) -> Result<Loan, String> {
    let (loan, change) = state.0.lock().unwrap().loan_return(&year, &id)?;
    announce(&app, change);
    Ok(loan)
}

/// 2 — hard delete. Drafts only, returns nothing.
#[tauri::command]
#[specta::specta]
pub fn loans_cancel(
    app: AppHandle,
    state: State<'_, DemoState>,
    id: String,
    year: String,
) -> Result<(), String> {
    let change = state.0.lock().unwrap().loan_cancel(&year, &id)?;
    announce(&app, change);
    Ok(())
}

/// 3 — counter-document. Closes the original and issues a REPLACEMENT.
#[tauri::command]
#[specta::specta]
pub fn loans_mark_lost(
    app: AppHandle,
    state: State<'_, DemoState>,
    id: String,
    year: String,
) -> Result<Loan, String> {
    let (replacement, change) = state.0.lock().unwrap().loan_mark_lost(&year, &id)?;
    announce(&app, change);
    Ok(replacement)
}

/// 4 — soft, terminal. Returns nothing.
#[tauri::command]
#[specta::specta]
pub fn loans_archive(
    app: AppHandle,
    state: State<'_, DemoState>,
    id: String,
    year: String,
) -> Result<(), String> {
    let change = state.0.lock().unwrap().loan_archive(&year, &id)?;
    announce(&app, change);
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn loans_page(
    state: State<'_, DemoState>,
    year: String,
    limit: i32,
    cursor: Option<String>,
) -> Result<LoanPage, String> {
    state.0.lock().unwrap().loan_page(&year, limit, cursor)
}

#[tauri::command]
#[specta::specta]
pub fn loans_get(state: State<'_, DemoState>, id: String, year: String) -> Result<Loan, String> {
    state.0.lock().unwrap().loan_get(&year, &id)
}

/// The create path — reached by the list header's one forward action.
#[tauri::command]
#[specta::specta]
pub fn loans_create(
    app: AppHandle,
    state: State<'_, DemoState>,
    year: String,
) -> Result<Loan, String> {
    let (loan, change) = state.0.lock().unwrap().loan_create(&year)?;
    announce(&app, change);
    Ok(loan)
}

#[tauri::command]
#[specta::specta]
pub fn loans_reset(state: State<'_, DemoState>) {
    state.0.lock().unwrap().loans_reset();
}

// ── preferences ────────────────────────────────────────────────────────────

/// A collection of exactly one — archetype E's data.
#[tauri::command]
#[specta::specta]
pub fn prefs_list(state: State<'_, DemoState>) -> Vec<Preferences> {
    vec![state.0.lock().unwrap().prefs.clone()]
}

#[tauri::command]
#[specta::specta]
pub fn prefs_save(state: State<'_, DemoState>, body: Preferences) -> Preferences {
    state.0.lock().unwrap().prefs = body.clone();
    body
}

#[tauri::command]
#[specta::specta]
pub fn prefs_reset(state: State<'_, DemoState>) {
    state.0.lock().unwrap().prefs = Preferences::default();
}
