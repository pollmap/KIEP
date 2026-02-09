# ─── Stage 1: Build ───
FROM rust:bookworm AS builder

WORKDIR /app
COPY Cargo.toml Cargo.lock* ./
COPY crates/ crates/
COPY sql/ sql/

# Build release binary
RUN cargo build --release --bin kiep-api && \
    cargo build --release --bin kiep-cli

# ─── Stage 2: Runtime ───
FROM debian:bookworm-slim

RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates libssl3 && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /app/target/release/kiep-api /usr/local/bin/kiep-api
COPY --from=builder /app/target/release/kiep-cli /usr/local/bin/kiep-cli
COPY sql/ sql/

ENV RUST_LOG=info
EXPOSE 3100

CMD ["kiep-api"]
