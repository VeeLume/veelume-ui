# Your repo owns this file — the template never overwrites it (copier _skip_if_exists).
# Shared recipes live in common.just, kept in sync via `copier update`. `just --list` to see all.
import? 'common.just'

default:
    @just --list

# --- repo-local recipes below (add yours here) ---

# The demo's HTTP + SSE backend — the second transport, beside Tauri IPC.
# Behind a feature so `tauri dev`/`tauri build` never compile the web stack.
# Pair it with `pnpm --filter veelume-ui-demo dev` and open /http.
serve port="3001":
    PORT={{port}} cargo run --features serve --bin demo-server
