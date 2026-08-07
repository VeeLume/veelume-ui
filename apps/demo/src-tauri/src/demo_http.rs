//! The HTTP + SSE adapter — the demo's second transport.
//!
//! ⚑ This file contains NO loans logic. Every handler locks the shared
//! `DemoState`, calls the same `DemoData` method `demo_commands.rs` calls, and
//! broadcasts the `LoanChange` the domain hands back. That is the whole claim
//! the second transport exists to prove: one implementation of the four
//! closers, two entry points. If a closer ever behaves differently over HTTP
//! than over IPC, it is because someone put logic here.
//!
//! The wire shape is the kit's contract, not this app's invention:
//! `{ records, cursor?, total?, done? }` from a page, and change events
//! carrying `{ kind, keys, scope }`.

use std::{convert::Infallible, sync::Arc};

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::{
        sse::{Event, KeepAlive, Sse},
        IntoResponse, Response,
    },
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use tokio::sync::broadcast;
use tokio_stream::{wrappers::BroadcastStream, Stream, StreamExt};
use tower_http::cors::{Any, CorsLayer};

use crate::demo::{DemoState, Loan, LoanChange};

/// What the SSE stream carries. `Drop` is the deliberate-disconnect signal —
/// see `drop_streams`.
#[derive(Clone, Debug)]
enum Signal {
    Change(LoanChange),
    Drop,
}

#[derive(Clone)]
pub struct Server {
    pub data: Arc<DemoState>,
    tx: broadcast::Sender<Signal>,
}

impl Server {
    pub fn new() -> Self {
        let (tx, _) = broadcast::channel(256);
        Self {
            data: Arc::new(DemoState::default()),
            tx,
        }
    }

    /// The SSE half of the transport split — `demo_commands.rs::announce` is
    /// the Tauri half. Fire-and-forget: `send` fails only when nobody is
    /// listening, which is not an error.
    fn announce(&self, change: LoanChange) {
        let _ = self.tx.send(Signal::Change(change));
    }
}

impl Default for Server {
    fn default() -> Self {
        Self::new()
    }
}

/// A domain error, as JSON. The kit classifies by STATUS, so the code carries
/// the meaning and the body is for humans.
struct ApiError(StatusCode, String);

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        #[derive(Serialize)]
        struct Body {
            message: String,
        }
        (self.0, Json(Body { message: self.1 })).into_response()
    }
}

/// Every domain error is a 422 here: the seeded demo has no auth and no
/// upstream, so "only a draft can be cancelled" is the only kind there is. A
/// real backend maps its own failures onto 401/403/409/422 — which is exactly
/// what the kit's `classifyError` is reading.
fn bad(e: String) -> ApiError {
    ApiError(StatusCode::UNPROCESSABLE_ENTITY, e)
}

#[derive(Deserialize)]
struct ScopeQuery {
    year: String,
}

#[derive(Deserialize)]
struct PageQuery {
    year: String,
    #[serde(default)]
    limit: Option<i32>,
    #[serde(default)]
    cursor: Option<String>,
}

pub fn router(server: Server) -> Router {
    Router::new()
        .route("/api/loans", get(page).post(create))
        .route("/api/loans/{id}", get(one).put(save))
        .route("/api/loans/{id}/return", post(ret))
        .route("/api/loans/{id}/cancel", post(cancel))
        .route("/api/loans/{id}/mark-lost", post(mark_lost))
        .route("/api/loans/{id}/archive", post(archive))
        .route("/api/loans/reset", post(reset))
        .route("/api/events", get(events))
        .route("/api/debug/drop-streams", post(drop_streams))
        // Permissive on purpose: this is a harness, and the frontend is served
        // from Vite on another port. A real deployment pins its origins.
        .layer(
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods(Any)
                .allow_headers(Any),
        )
        .with_state(server)
}

async fn page(
    State(s): State<Server>,
    Query(q): Query<PageQuery>,
) -> Result<impl IntoResponse, ApiError> {
    let page = s
        .data
        .0
        .lock()
        .unwrap()
        .loan_page(&q.year, q.limit.unwrap_or(50), q.cursor)
        .map_err(bad)?;
    Ok(Json(page))
}

async fn one(
    State(s): State<Server>,
    Path(id): Path<String>,
    Query(q): Query<ScopeQuery>,
) -> Result<impl IntoResponse, ApiError> {
    let loan = s
        .data
        .0
        .lock()
        .unwrap()
        .loan_get(&q.year, &id)
        .map_err(bad)?;
    Ok(Json(loan))
}

async fn save(
    State(s): State<Server>,
    Path(_id): Path<String>,
    Query(q): Query<ScopeQuery>,
    Json(body): Json<Loan>,
) -> Result<impl IntoResponse, ApiError> {
    let (saved, change) = s
        .data
        .0
        .lock()
        .unwrap()
        .loan_save(&q.year, body)
        .map_err(bad)?;
    s.announce(change);
    Ok(Json(saved))
}

async fn create(
    State(s): State<Server>,
    Query(q): Query<ScopeQuery>,
) -> Result<impl IntoResponse, ApiError> {
    let (loan, change) = s.data.0.lock().unwrap().loan_create(&q.year).map_err(bad)?;
    s.announce(change);
    Ok(Json(loan))
}

async fn ret(
    State(s): State<Server>,
    Path(id): Path<String>,
    Query(q): Query<ScopeQuery>,
) -> Result<impl IntoResponse, ApiError> {
    let (loan, change) = s
        .data
        .0
        .lock()
        .unwrap()
        .loan_return(&q.year, &id)
        .map_err(bad)?;
    s.announce(change);
    Ok(Json(loan))
}

async fn cancel(
    State(s): State<Server>,
    Path(id): Path<String>,
    Query(q): Query<ScopeQuery>,
) -> Result<impl IntoResponse, ApiError> {
    let change = s
        .data
        .0
        .lock()
        .unwrap()
        .loan_cancel(&q.year, &id)
        .map_err(bad)?;
    s.announce(change);
    Ok(StatusCode::NO_CONTENT)
}

async fn mark_lost(
    State(s): State<Server>,
    Path(id): Path<String>,
    Query(q): Query<ScopeQuery>,
) -> Result<impl IntoResponse, ApiError> {
    let (replacement, change) = s
        .data
        .0
        .lock()
        .unwrap()
        .loan_mark_lost(&q.year, &id)
        .map_err(bad)?;
    s.announce(change);
    Ok(Json(replacement))
}

async fn archive(
    State(s): State<Server>,
    Path(id): Path<String>,
    Query(q): Query<ScopeQuery>,
) -> Result<impl IntoResponse, ApiError> {
    let change = s
        .data
        .0
        .lock()
        .unwrap()
        .loan_archive(&q.year, &id)
        .map_err(bad)?;
    s.announce(change);
    Ok(StatusCode::NO_CONTENT)
}

async fn reset(State(s): State<Server>) -> impl IntoResponse {
    s.data.0.lock().unwrap().loans_reset();
    // No keys and no scope: everything may have changed. The client's
    // degradation path reloads every declaration it holds.
    s.announce(LoanChange {
        kind: "update".into(),
        keys: vec![],
        year: String::new(),
    });
    StatusCode::NO_CONTENT
}

/// The invalidation stream. One `LoanChange` per message, JSON-encoded.
async fn events(State(s): State<Server>) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    let rx = s.tx.subscribe();
    let stream = BroadcastStream::new(rx)
        // ⚑ `take_while` on `Drop` is what ENDS the response, which is how the
        // client is made to reconnect. A lagged receiver also ends here — and
        // that is correct rather than lossy: the reconnect is itself the
        // "you missed something" signal the kit's contract relies on.
        .take_while(|msg| !matches!(msg, Ok(Signal::Drop)))
        .filter_map(|msg| match msg {
            Ok(Signal::Change(c)) => Some(Ok(Event::default()
                .event("loans-changed")
                .data(serde_json::to_string(&c).unwrap_or_default()))),
            _ => None,
        });

    // A comment every 15s, so a proxy idling the connection out is visible as a
    // reconnect rather than as silence.
    Sse::new(stream).keep_alive(KeepAlive::default())
}

/// Deterministically drop every open SSE connection.
///
/// ⚑ The reconnect path is the one genuinely new thing HTTP brings, and an
/// untestable recovery path is an unimplemented one. This is the same trick
/// `probes_hijack` plays for write divergence: make the rare failure a button
/// instead of a race. Clients see the stream end, `EventSource` reconnects on
/// its own, and the adapter must then re-invalidate — see the kit's
/// `CollectionIO.subscribe` contract.
async fn drop_streams(State(s): State<Server>) -> impl IntoResponse {
    let _ = s.tx.send(Signal::Drop);
    StatusCode::NO_CONTENT
}
