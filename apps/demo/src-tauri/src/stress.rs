//! The extreme case: 1.5M entries, really held, with a real footprint.
//!
//! ⚑ Two things this deliberately does NOT do, because both would make the
//! surface lie about the case it exists to expose:
//!
//!  1. **No procedural serving.** The dataset is materialised once and sliced.
//!     A backend computing rows from an index would hand the client
//!     identical-looking pages while being unable to answer the questions the
//!     working-set model actually asks — "the 2 000 largest matching X" cannot
//!     be derived from `i`.
//!  2. **No interning, no columnar packing.** Every row owns its strings. An
//!     earlier version stored indices into a 2 048-name pool and cost ~24MB;
//!     that is a cheat twice over — it hides the footprint, and it caps search
//!     selectivity so that no query can ever return a single row out of 1.5M,
//!     which is precisely the case worth testing.
//!
//! The consequence is a real ~300MB resident and ~4.5M allocations at build.
//! That cost is the finding, not an accident to be optimised away. Generation
//! is lazy (see `stress_commands`), so the other surfaces never pay it.

use serde::{Deserialize, Serialize};

/// How many entries the stress dataset holds.
pub const COUNT: usize = 1_500_000;

/// The facet axis — small and fixed, as a status column would be.
pub const KINDS: [&str; 6] = [
    "invoice",
    "receipt",
    "refund",
    "credit",
    "transfer",
    "adjustment",
];

const SURNAMES: [&str; 32] = [
    "Grunwald",
    "Petersen",
    "Kowalski",
    "Ferreira",
    "Nakamura",
    "Oyelaran",
    "Bergström",
    "Dvorak",
    "Halvorsen",
    "Ivanova",
    "Jankowski",
    "Kaufmann",
    "Lindqvist",
    "Moreau",
    "Nielsen",
    "Okonkwo",
    "Pavlenko",
    "Quintero",
    "Rasmussen",
    "Sørensen",
    "Takahashi",
    "Ueberroth",
    "Vasquez",
    "Weisskopf",
    "Xiong",
    "Yamamoto",
    "Zieliński",
    "Abadi",
    "Broekhuis",
    "Castellano",
    "Duarte",
    "Eriksdottir",
];

const GIVEN: [&str; 16] = [
    "Anja", "Boris", "Clara", "Dmitri", "Elif", "Farid", "Greta", "Hugo", "Ines", "Jonas", "Kira",
    "Lucas", "Mira", "Nils", "Olga", "Piotr",
];

/// 16 × 32 × 10 000 ≈ 5.1M possible names over 1.5M rows, so most are unique
/// while surnames still repeat heavily.
///
/// That spread is the point: `Grunwald` matches ~47 000 rows, `Anja Grunwald
/// 4213` matches one. A search that can only ever return thousands cannot test
/// the case where you know exactly what you are looking for.
const NAME_SUFFIX: u32 = 10_000;

/// A stored row. Owns its strings — see the module note.
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct Entry {
    /// i32, not i64 — specta refuses i64 at the IPC boundary
    /// (`BigIntForbidden`), a JS number cannot represent its range.
    pub id: i32,
    pub date: String,
    pub party: String,
    pub kind: String,
    pub cents: i32,
}

/// One accumulation step, mirroring the kit's `FetchPage`.
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct EntryPage {
    pub records: Vec<Entry>,
    pub cursor: Option<String>,
    pub total: i32,
    pub done: bool,
}

/// Deterministic and cheap, and matched exactly by the fixture twin — so
/// "does it behave the same over IPC?" compares one dataset rather than two.
fn lcg(state: &mut u64) -> u32 {
    *state = state
        .wrapping_mul(6_364_136_223_846_793_005)
        .wrapping_add(1_442_695_040_888_963_407);
    (*state >> 33) as u32
}

/// Civil-from-days (Hinnant), epoch shifted to 2006-01-01 — 13 149 days after
/// the Unix epoch.
fn date_of(day: i32) -> String {
    let z = day as i64 + 13_149 + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z.rem_euclid(146_097);
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = if m <= 2 { y + 1 } else { y };
    format!("{y:04}-{m:02}-{d:02}")
}

pub struct StressData {
    rows: Vec<Entry>,
    /// Lowercased party, precomputed. Without it every search allocates 1.5M
    /// temporary strings per keystroke — which is a fixture artefact rather
    /// than a property of the data, and would drown the signal we are after.
    party_lc: Vec<String>,
}

impl StressData {
    pub fn generate() -> Self {
        let mut seed = 0x5EED_1234_ABCD_0001_u64;
        let mut rows = Vec::with_capacity(COUNT);
        let mut party_lc = Vec::with_capacity(COUNT);

        for id in 0..COUNT {
            let r1 = lcg(&mut seed);
            let r2 = lcg(&mut seed);
            let party = format!(
                "{} {} {}",
                GIVEN[(r2 % GIVEN.len() as u32) as usize],
                SURNAMES[((r2 / 16) % SURNAMES.len() as u32) as usize],
                r1 % NAME_SUFFIX
            );
            party_lc.push(party.to_lowercase());
            rows.push(Entry {
                id: id as i32,
                // Twenty years of history, ascending, so the default relevance
                // order is meaningful and year-scoping has something to bite on.
                date: date_of((id / 205) as i32),
                party,
                kind: KINDS[(r1 % KINDS.len() as u32) as usize].to_string(),
                cents: (r1 % 500_000) as i32 - 50_000,
            });
        }
        Self { rows, party_lc }
    }

    /// Everything matching, as indices, in the requested order.
    ///
    /// Deliberately honest work: a full scan of 1.5M plus a sort of the matches.
    /// If that is slow, the slowness is the finding.
    fn matching(&self, search: &str, kind: &str, order: &str, desc: bool) -> Vec<u32> {
        let needle = search.trim().to_lowercase();
        let as_id: Option<i32> = needle.parse().ok();

        let mut hits: Vec<u32> = (0..self.rows.len() as u32)
            .filter(|&i| {
                let r = &self.rows[i as usize];
                (kind.is_empty() || r.kind == kind)
                    && (needle.is_empty()
                        || self.party_lc[i as usize].contains(&needle)
                        || as_id == Some(r.id))
            })
            .collect();

        match order {
            "amount" => hits.sort_by_key(|&i| self.rows[i as usize].cents),
            "party" => {
                hits.sort_by(|&a, &b| self.party_lc[a as usize].cmp(&self.party_lc[b as usize]))
            }
            // Ids are already in date order by construction — as an indexed
            // column would be — so the default order needs no sort.
            _ => {}
        }
        if desc {
            hits.reverse();
        }
        hits
    }

    /// Keyset paging over the ordered match list: the cursor is the last row's
    /// id and the next page starts *after* it.
    pub fn page(
        &self,
        search: &str,
        kind: &str,
        order: &str,
        desc: bool,
        limit: i32,
        cursor: Option<String>,
    ) -> EntryPage {
        let hits = self.matching(search, kind, order, desc);

        let start = match cursor.and_then(|c| c.parse::<i32>().ok()) {
            Some(id) => hits
                .iter()
                .position(|&i| self.rows[i as usize].id == id)
                .map_or(0, |p| p + 1),
            None => 0,
        };
        let take = limit.max(0) as usize;
        let records: Vec<Entry> = hits
            .iter()
            .skip(start)
            .take(take)
            .map(|&i| self.rows[i as usize].clone())
            .collect();
        let more = start + records.len() < hits.len();

        EntryPage {
            cursor: if more {
                records.last().map(|e| e.id.to_string())
            } else {
                None
            },
            total: hits.len() as i32,
            done: !more,
            records,
        }
    }

    pub fn get(&self, id: i32) -> Option<Entry> {
        self.rows.get(id as usize).cloned()
    }
}
