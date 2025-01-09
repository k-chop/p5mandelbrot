# Reference Orbit Calculation Client

This Rust client enables high-speed calculation of reference orbits.

With this client, calculations are approximately 40 times faster. wow.

## How to Use

- Launch the WebSocket server:
  - `pnpm run server`
- Launch the reference orbit calculation client:
  - `cd rust_client`
  - `cargo run`

## Restrictions

- This client likely cannot run natively on Windows.
  - Use WSL instead.
