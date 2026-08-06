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

use tauri::State;

use crate::demo::{
    DemoState, Edition, Loan, LoanPage, Preferences, Probe, ProbePage, ProbePatch, ShelfEntry,
};

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
    state
        .0
        .lock()
        .unwrap()
        .loans_mut(&year)
        .map(|l| l.clone())
        .unwrap_or_default()
}

/// The record-shaped edit — the only loan operation that belongs to the
/// collection's write layer.
#[tauri::command]
#[specta::specta]
pub fn loans_save(state: State<'_, DemoState>, body: Loan, year: String) -> Result<Loan, String> {
    let mut data = state.0.lock().unwrap();
    let list = data.loans_mut(&year).ok_or("unknown year")?;
    let i = list
        .iter()
        .position(|l| l.id == body.id)
        .ok_or_else(|| format!("loan {} not found", body.id))?;
    list[i] = body.clone();
    Ok(body)
}

/// 1 — soft delete. Returns the record.
#[tauri::command]
#[specta::specta]
pub fn loans_return(state: State<'_, DemoState>, id: String, year: String) -> Result<Loan, String> {
    let mut data = state.0.lock().unwrap();
    let list = data.loans_mut(&year).ok_or("unknown year")?;
    let loan = list
        .iter_mut()
        .find(|l| l.id == id)
        .ok_or("loan not found")?;
    loan.status = "returned".into();
    Ok(loan.clone())
}

/// 2 — hard delete. Drafts only, returns nothing.
#[tauri::command]
#[specta::specta]
pub fn loans_cancel(state: State<'_, DemoState>, id: String, year: String) -> Result<(), String> {
    let mut data = state.0.lock().unwrap();
    let list = data.loans_mut(&year).ok_or("unknown year")?;
    let i = list
        .iter()
        .position(|l| l.id == id)
        .ok_or("loan not found")?;
    if list[i].status != "draft" {
        return Err("only a draft can be cancelled".into());
    }
    list.remove(i);
    Ok(())
}

/// 3 — counter-document. Closes the original and issues a REPLACEMENT, which is
/// what makes this impossible to model as a deletion.
#[tauri::command]
#[specta::specta]
pub fn loans_mark_lost(
    state: State<'_, DemoState>,
    id: String,
    year: String,
) -> Result<Loan, String> {
    let mut data = state.0.lock().unwrap();
    let list = data.loans_mut(&year).ok_or("unknown year")?;
    let i = list
        .iter()
        .position(|l| l.id == id)
        .ok_or("loan not found")?;

    let mut replacement = list[i].clone();
    replacement.id = format!("{id}-R");
    replacement.status = "draft".into();
    replacement.replaced_by = None;
    replacement.fine_cents = 0;
    replacement.note = format!("Replacement for {id}");

    list[i].status = "lost".into();
    list[i].replaced_by = Some(replacement.id.clone());
    list.push(replacement.clone());
    Ok(replacement)
}

/// 4 — soft, terminal. Returns nothing.
#[tauri::command]
#[specta::specta]
pub fn loans_archive(state: State<'_, DemoState>, id: String, year: String) -> Result<(), String> {
    let mut data = state.0.lock().unwrap();
    let list = data.loans_mut(&year).ok_or("unknown year")?;
    let loan = list
        .iter_mut()
        .find(|l| l.id == id)
        .ok_or("loan not found")?;
    loan.status = "archived".into();
    Ok(())
}

/// Keyset paging — the shape you write over SQLite, TrailBase or Postgres.
/// The cursor is the last row's id and the next page starts *after* it, so a row
/// inserted mid-accumulation cannot shift a window or be re-emitted, which is
/// exactly what offset paging gets wrong.
#[tauri::command]
#[specta::specta]
pub fn loans_page(
    state: State<'_, DemoState>,
    year: String,
    limit: i32,
    cursor: Option<String>,
) -> Result<LoanPage, String> {
    let mut data = state.0.lock().unwrap();
    let list = data.loans_mut(&year).ok_or("unknown year")?;

    let after = match cursor {
        Some(c) => list.iter().position(|l| l.id == c).map_or(0, |i| i + 1),
        None => 0,
    };
    let take = limit.max(0) as usize;
    let slice: Vec<Loan> = list.iter().skip(after).take(take).cloned().collect();
    let more = after + slice.len() < list.len();

    Ok(LoanPage {
        cursor: if more {
            slice.last().map(|l| l.id.clone())
        } else {
            None
        },
        // Cheap here, and cheap in reality: a COUNT(*) over an indexed predicate.
        total: list.len() as i32,
        done: !more,
        records: slice,
    })
}

/// One record by key — what a deep link or a server-side search hit needs, since
/// neither belongs to a working set the client already holds.
#[tauri::command]
#[specta::specta]
pub fn loans_get(state: State<'_, DemoState>, id: String, year: String) -> Result<Loan, String> {
    let mut data = state.0.lock().unwrap();
    let list = data.loans_mut(&year).ok_or("unknown year")?;
    list.iter()
        .find(|l| l.id == id)
        .cloned()
        .ok_or_else(|| "loan not found".into())
}

/// The create path. Archetype B is "list + detail + form", and a demo built only
/// from seeded data never exercises the third of those — nor the list header's
/// one forward action, which is what create is reached by.
#[tauri::command]
#[specta::specta]
pub fn loans_create(state: State<'_, DemoState>, year: String) -> Result<Loan, String> {
    let mut data = state.0.lock().unwrap();
    let list = data.loans_mut(&year).ok_or("unknown year")?;
    let loan = Loan {
        // Seeded ids are `loan-<year>-<n>`; a `new` segment keeps a created record
        // from colliding with one a reset would re-seed.
        id: format!("loan-{year}-new-{}", list.len() + 1),
        title: "Untitled loan".into(),
        borrower: String::new(),
        lent_on: format!("{year}-01-01"),
        due_on: format!("{year}-01-31"),
        status: "draft".into(),
        replaced_by: None,
        fine_cents: 0,
        note: String::new(),
    };
    list.push(loan.clone());
    Ok(loan)
}

#[tauri::command]
#[specta::specta]
pub fn loans_reset(state: State<'_, DemoState>) {
    state.0.lock().unwrap().loans = crate::demo::DemoData::seeded().loans;
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
