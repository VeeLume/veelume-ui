//! App-global preferences: one JSON file, one snapshot struct, whole-snapshot
//! updates. Per-key setters can come back if the surface grows past what one
//! settings page edits.
//!
//! `#[serde(default)]` keeps old settings files loading after new fields are
//! added — never rename or repurpose a field, add a new one.
//!
//! Display preferences (theme, density) deliberately live in the frontend's
//! localStorage instead: they must apply before any IPC round-trip completes.

use serde::{Deserialize, Serialize};

/// Derived rather than hand-written: with every field at its type default a
/// manual `impl Default` trips `clippy::derivable_impls`, which the pre-push
/// gate treats as an error. Swap back to a manual impl the moment a field needs
/// a non-default starting value.
#[derive(Debug, Clone, Default, Serialize, Deserialize, specta::Type)]
#[serde(default)]
pub struct AppSettings {
    /// Whether first-launch onboarding has been completed or skipped.
    pub onboarding_completed: bool,
}
