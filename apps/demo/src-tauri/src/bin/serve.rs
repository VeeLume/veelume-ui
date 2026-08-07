//! The demo's HTTP + SSE backend.
//!
//!     just serve            # or: cargo run --features serve --bin demo-server
//!
//! Serves the same seeded loans the Tauri app serves, over the second
//! transport. State is in-memory and per-run, exactly as the Tauri side is —
//! persistence would be a third thing to keep in sync for no gain.

use veelume_ui_demo_lib::demo_http::{router, Server};

#[tokio::main]
async fn main() {
    let port: u16 = std::env::var("PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        // Clear of the Tauri range: 1420 is vite dev's strictPort and 1421 is
        // Tauri's LAN HMR socket.
        .unwrap_or(3001);

    let listener = tokio::net::TcpListener::bind(("127.0.0.1", port))
        .await
        .unwrap_or_else(|e| panic!("demo-server: cannot bind 127.0.0.1:{port} — {e}"));

    println!("demo-server: http://127.0.0.1:{port}/api/loans?year=2025");
    println!("demo-server: events at /api/events, drop them with POST /api/debug/drop-streams");

    axum::serve(listener, router(Server::new()))
        .with_graceful_shutdown(async {
            let _ = tokio::signal::ctrl_c().await;
        })
        .await
        .expect("demo-server: serve failed");
}
