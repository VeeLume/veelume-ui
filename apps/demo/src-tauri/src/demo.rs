//! The demo domain, in Rust.
//!
//! Mirrors `src/lib/fixtures/*` exactly — same shapes, same seeds, same
//! behaviour — because that is the point: **the same UI, over two transports.**
//! The fixture backend proves the frontend is not coupled to Tauri; this proves
//! it is not coupled to the fixtures either. If a surface behaves differently
//! here than in the browser, the abstraction leaked.
//!
//! Deliberately in-memory rather than SQLite. State that survives a restart
//! would be a third thing to keep in sync for no gain — TrailBase is the real
//! persistence step, and this is not a stand-in for it.
//!
//! IPC parameter names are single words on purpose — see `demo_commands.rs`.

use std::sync::Mutex;

use serde::{Deserialize, Serialize};

// ── probes: the test rig ───────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct Probe {
    pub id: String,
    pub name: String,
    pub note: String,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, specta::Type)]
pub struct ProbePatch {
    pub note: Option<String>,
}

fn seed_probes(scope: &str) -> Vec<Probe> {
    (1..=3)
        .map(|i| Probe {
            id: format!("{scope}-{i}"),
            name: format!("{scope} probe {i}"),
            note: "initial".into(),
        })
        .collect()
}

/// One accumulation step over the paged probes. Mirrors the kit's `FetchPage`.
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct ProbePage {
    pub records: Vec<Probe>,
    pub cursor: Option<String>,
    pub total: i32,
    pub done: bool,
}

/// 8 × 5 cycling with period 40 → every name distinct, every word shared by
/// several rows — so a one-word search has a small, countable answer.
const PAGED_GIVEN: [&str; 8] = [
    "amber", "birch", "cedar", "fjord", "garnet", "heron", "juniper", "krill",
];
const PAGED_KIND: [&str; 5] = ["array", "beacon", "circuit", "dynamo", "filament"];

/// The paged-rig corpus: 40 records — big enough to page, small enough to
/// exhaust under a 100 cap, which is what makes the search escalation's two
/// regimes reachable deterministically.
fn seed_probes_paged() -> Vec<Probe> {
    (0..40usize)
        .map(|i| Probe {
            id: format!("paged-{:02}", i + 1),
            name: format!("{} {} {}", PAGED_GIVEN[i % 8], PAGED_KIND[i % 5], i + 1),
            note: "initial".into(),
        })
        .collect()
}

// ── library: reference data + overlay ──────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct Edition {
    pub id: String,
    pub work_id: String,
    pub work_title: String,
    pub author: String,
    pub year: i32,
    pub format: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct ShelfEntry {
    pub edition_id: String,
    pub state: String,
}

const AUTHORS: [&str; 6] = [
    "Ursula K. Le Guin",
    "Iain M. Banks",
    "Octavia Butler",
    "Stanisław Lem",
    "Ann Leckie",
    "Becky Chambers",
];
const TITLES: [&str; 12] = [
    "The Dispossessed",
    "Use of Weapons",
    "Kindred",
    "Solaris",
    "Ancillary Justice",
    "A Closed and Common Orbit",
    "The Left Hand of Darkness",
    "Player of Games",
    "Parable of the Sower",
    "The Cyberiad",
    "Provenance",
    "Record of a Spaceborn Few",
];
const FORMATS: [&str; 3] = ["hardcover", "paperback", "ebook"];

fn seed_editions() -> Vec<Edition> {
    let mut out = Vec::new();
    for (w, title) in TITLES.iter().enumerate() {
        // 1–3 editions per work, so leaf rows and bundle rows both occur.
        let n = (w % 3) + 1;
        for e in 0..n {
            out.push(Edition {
                id: format!("ed-{w}-{e}"),
                work_id: format!("work-{w}"),
                work_title: (*title).into(),
                author: AUTHORS[w % AUTHORS.len()].into(),
                year: 1969 + (w as i32) * 3 + e as i32,
                format: FORMATS[e % FORMATS.len()].into(),
            });
        }
    }
    out
}

fn seed_shelf() -> Vec<ShelfEntry> {
    vec![
        ShelfEntry {
            edition_id: "ed-0-0".into(),
            state: "owned".into(),
        },
        ShelfEntry {
            edition_id: "ed-2-1".into(),
            state: "owned".into(),
        },
        ShelfEntry {
            edition_id: "ed-4-0".into(),
            state: "want".into(),
        },
    ]
}

// ── loans: scoped by year, four closing operations ─────────────────────────

/// `i32`, not `i64`: specta forbids `i64` at the IPC boundary because a JS
/// number cannot represent its full range. Any real backend with a BIGINT money
/// or id column hits the same wall — the fix there is a string, not a wider int.
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct Loan {
    pub id: String,
    pub title: String,
    pub borrower: String,
    pub lent_on: String,
    pub due_on: String,
    pub status: String,
    pub replaced_by: Option<String>,
    pub fine_cents: i32,
    pub note: String,
}

/// One accumulation step. Mirrors the kit's `FetchPage`: rows, a continuation
/// token, the matching total, and an explicit end-of-data flag.
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct LoanPage {
    pub records: Vec<Loan>,
    pub cursor: Option<String>,
    pub total: i32,
    pub done: bool,
}

/// What goes on the `loans-changed` event — the kit's `ChangeInfo`, with the
/// scope under its domain name. `kind: "delete"` + keys is tier-2 deletion:
/// the frontend removes those records locally without a refetch.
#[derive(Debug, Clone, Serialize, specta::Type)]
pub struct LoanChange {
    pub kind: String,
    pub keys: Vec<String>,
    pub year: String,
}

const BORROWERS: [&str; 5] = ["Petra", "Norbert", "Dr. Nagel", "Markus", "Anja"];
const STATUSES: [&str; 6] = ["draft", "out", "out", "returned", "lost", "archived"];

fn seed_loans(year: &str, y: usize) -> Vec<Loan> {
    (0..6 + y)
        .map(|i| {
            let month = format!("{:02}", ((i * 2 + y) % 12) + 1);
            Loan {
                id: format!("loan-{year}-{}", i + 1),
                title: TITLES[(i + y) % TITLES.len()].into(),
                borrower: BORROWERS[(i + y * 2) % BORROWERS.len()].into(),
                lent_on: format!("{year}-{month}-05"),
                due_on: format!("{year}-{month}-25"),
                status: STATUSES[(i + y) % STATUSES.len()].into(),
                replaced_by: None,
                fine_cents: if i % 3 == 0 {
                    0
                } else {
                    (i as i32 + 1) * 12345
                },
                note: String::new(),
            }
        })
        .collect()
}

// ── preferences: one record ────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct Preferences {
    pub id: String,
    pub display_name: String,
    pub default_loan_days: i32,
    pub fine_per_day_cents: i32,
    pub preferred_format: String,
    pub notes: String,
}

impl Default for Preferences {
    fn default() -> Self {
        Self {
            id: "me".into(),
            display_name: "Valerie".into(),
            default_loan_days: 28,
            fine_per_day_cents: 150,
            preferred_format: "paperback".into(),
            notes: String::new(),
        }
    }
}

// ── the managed state ──────────────────────────────────────────────────────

pub struct DemoData {
    pub probes_alpha: Vec<Probe>,
    pub probes_beta: Vec<Probe>,
    /// Read-only corpus for the paged rig — never mutated, reset with probes.
    pub probes_paged: Vec<Probe>,
    /// Applied INSTEAD of the requested body on the next probe save — the
    /// deterministic write conflict the record-store spike had to race for.
    pub hijack: Option<ProbePatch>,
    pub editions: Vec<Edition>,
    pub shelf: Vec<ShelfEntry>,
    pub loans: Vec<(String, Vec<Loan>)>,
    pub prefs: Preferences,
}

impl DemoData {
    pub fn seeded() -> Self {
        Self {
            probes_alpha: seed_probes("alpha"),
            probes_beta: seed_probes("beta"),
            probes_paged: seed_probes_paged(),
            hijack: None,
            editions: seed_editions(),
            shelf: seed_shelf(),
            loans: ["2024", "2025", "2026"]
                .iter()
                .enumerate()
                .map(|(y, year)| ((*year).to_string(), seed_loans(year, y)))
                .collect(),
            prefs: Preferences::default(),
        }
    }

    pub fn probes_mut(&mut self, scope: &str) -> &mut Vec<Probe> {
        if scope == "beta" {
            &mut self.probes_beta
        } else {
            &mut self.probes_alpha
        }
    }

    pub fn loans_mut(&mut self, year: &str) -> Option<&mut Vec<Loan>> {
        self.loans
            .iter_mut()
            .find(|(y, _)| y == year)
            .map(|(_, l)| l)
    }
}

// ── the loans domain, transport-free ───────────────────────────────────────
//
// ⚑ Every operation lives HERE, not in an adapter, and each mutation returns
// the `LoanChange` it caused rather than announcing it. That split is what
// makes one implementation serve two transports: the domain decides *what
// changed*, the adapter decides *how to say so* — a Tauri `emit` on one side,
// an SSE broadcast on the other. The logic used to live in `demo_commands.rs`,
// which meant the HTTP server would have had to duplicate it — and a
// duplicated closer is exactly the drift the demo exists to catch.

impl LoanChange {
    fn new(year: &str, kind: &str, keys: Vec<String>) -> Self {
        Self {
            kind: kind.into(),
            keys,
            year: year.into(),
        }
    }
}

impl DemoData {
    /// Keyset paging — the shape you write over SQLite, TrailBase or Postgres.
    /// The cursor is the last row's id and the next page starts *after* it, so a
    /// row inserted mid-accumulation cannot shift a window or be re-emitted,
    /// which is exactly what offset paging gets wrong.
    pub fn loan_page(
        &mut self,
        year: &str,
        limit: i32,
        cursor: Option<String>,
    ) -> Result<LoanPage, String> {
        let list = self.loans_mut(year).ok_or("unknown year")?;
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

    pub fn loan_list(&mut self, year: &str) -> Vec<Loan> {
        self.loans_mut(year).map(|l| l.clone()).unwrap_or_default()
    }

    /// One record by key — what a deep link or a server-side search hit needs.
    pub fn loan_get(&mut self, year: &str, id: &str) -> Result<Loan, String> {
        self.loans_mut(year)
            .ok_or("unknown year")?
            .iter()
            .find(|l| l.id == id)
            .cloned()
            .ok_or_else(|| "loan not found".into())
    }

    /// The record-shaped edit — the only loan operation that belongs to the
    /// collection's write layer.
    pub fn loan_save(&mut self, year: &str, body: Loan) -> Result<(Loan, LoanChange), String> {
        let list = self.loans_mut(year).ok_or("unknown year")?;
        let i = list
            .iter()
            .position(|l| l.id == body.id)
            .ok_or_else(|| format!("loan {} not found", body.id))?;
        list[i] = body.clone();
        let change = LoanChange::new(year, "update", vec![body.id.clone()]);
        Ok((body, change))
    }

    /// 1 — soft delete. Returns the record.
    pub fn loan_return(&mut self, year: &str, id: &str) -> Result<(Loan, LoanChange), String> {
        let list = self.loans_mut(year).ok_or("unknown year")?;
        let loan = list
            .iter_mut()
            .find(|l| l.id == id)
            .ok_or("loan not found")?;
        loan.status = "returned".into();
        let out = loan.clone();
        Ok((out, LoanChange::new(year, "update", vec![id.into()])))
    }

    /// 2 — hard delete. Drafts only, returns nothing. The keyed `delete` change
    /// is tier-2 deletion: any OTHER client holding this record learns of its
    /// absence without a refetch.
    pub fn loan_cancel(&mut self, year: &str, id: &str) -> Result<LoanChange, String> {
        let list = self.loans_mut(year).ok_or("unknown year")?;
        let i = list
            .iter()
            .position(|l| l.id == id)
            .ok_or("loan not found")?;
        if list[i].status != "draft" {
            return Err("only a draft can be cancelled".into());
        }
        list.remove(i);
        Ok(LoanChange::new(year, "delete", vec![id.into()]))
    }

    /// 3 — counter-document. Closes the original and issues a REPLACEMENT, which
    /// is what makes this impossible to model as a deletion.
    pub fn loan_mark_lost(&mut self, year: &str, id: &str) -> Result<(Loan, LoanChange), String> {
        let list = self.loans_mut(year).ok_or("unknown year")?;
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
        // Both ids: the closed original AND the issued replacement — which is
        // what makes the counter-document work over keyed refresh.
        let change = LoanChange::new(year, "update", vec![id.into(), replacement.id.clone()]);
        Ok((replacement, change))
    }

    /// 4 — soft, terminal. Returns nothing.
    pub fn loan_archive(&mut self, year: &str, id: &str) -> Result<LoanChange, String> {
        let list = self.loans_mut(year).ok_or("unknown year")?;
        let loan = list
            .iter_mut()
            .find(|l| l.id == id)
            .ok_or("loan not found")?;
        loan.status = "archived".into();
        Ok(LoanChange::new(year, "update", vec![id.into()]))
    }

    /// The create path. Archetype B is "list + detail + form", and a demo built
    /// only from seeded data never exercises the third of those.
    pub fn loan_create(&mut self, year: &str) -> Result<(Loan, LoanChange), String> {
        let list = self.loans_mut(year).ok_or("unknown year")?;
        let loan = Loan {
            // Seeded ids are `loan-<year>-<n>`; a `new` segment keeps a created
            // record from colliding with one a reset would re-seed.
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
        let change = LoanChange::new(year, "create", vec![loan.id.clone()]);
        Ok((loan, change))
    }

    pub fn loans_reset(&mut self) {
        self.loans = DemoData::seeded().loans;
    }
}

pub struct DemoState(pub Mutex<DemoData>);

impl Default for DemoState {
    fn default() -> Self {
        Self(Mutex::new(DemoData::seeded()))
    }
}
