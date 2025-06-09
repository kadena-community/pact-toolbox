#!/usr/bin/env -S just --justfile

set windows-shell := ["powershell.exe", "-NoLogo", "-Command"]
set shell := ["bash", "-cu"]

_default:
  @just --list -u

alias r := ready
alias c := check
alias f := fix

# Make sure you have cargo-binstall and pnpm installed.
# You can download the pre-compiled binary from <https://github.com/cargo-bins/cargo-binstall#installation>
# or install via `cargo install cargo-binstall`
# Initialize the project by installing all the necessary tools.
init:
  # Rust related init
  cargo binstall watchexec-cli cargo-insta typos-cli cargo-shear dprint -y
  # Node.js related init
  pnpm install

# When ready, run the same CI commands
ready:
  git diff --exit-code --quiet
  typos
  just fmt
  just check
  just test
  just lint
  just doc
  git status


# Install git pre-commit to format files
install-hook:
  echo -e "#!/bin/sh\njust fmt" > .git/hooks/pre-commit
  chmod +x .git/hooks/pre-commit

watch *args='':
  watchexec --no-vcs-ignore {{args}}

watch-check:
  just watch "'cargo check; cargo clippy'"

# Run the example in `mining-trigger`
example tool *args='':
  cargo run -p {{tool}} --example {{tool}} -- {{args}}

watch-example *args='':
  just watch 'just example {{args}}'

# Build mining-trigger in release build; Run with `./target/release/mining-trigger`.
mining-trigger:
  cargo run -p mining-trigger --release

# Watch mining-trigger
watch-mining-trigger *args='':
  just watch 'cargo run -p mining-trigger -- {{args}}'

# Run cargo check
check:
  cargo ck

# Run all the tests
test:
  cargo test --all-features

# Lint the whole project
lint:
  cargo lint -- --deny warnings

# Format all files
fmt:
  -cargo shear --fix # remove all unused dependencies
  cargo fmt --all
  dprint fmt

[unix]
doc:
  RUSTDOCFLAGS='-D warnings' cargo doc --no-deps --document-private-items

[windows]
doc:
  $Env:RUSTDOCFLAGS='-D warnings'; cargo doc --no-deps --document-private-items

# Fix all auto-fixable format and lint issues. Make sure your working tree is clean first.
fix:
  cargo clippy --fix --allow-staged --no-deps
  just fmt
  typos -w
  git status

# Run all the conformance tests. See `tasks/coverage`,
coverage:
  cargo coverage

# Get code coverage
codecov:
  cargo codecov --html

# Run the benchmarks. See `tasks/benchmark`
benchmark:
  cargo benchmark

# Run the benchmarks for a single component.
# e.g. `just benchmark-one parser`.
# See `tasks/benchmark`.
benchmark-one *args:
  cargo benchmark --bench {{args}} --no-default-features --features {{args}}

# Automatically DRY up Cargo.toml manifests in a workspace.
autoinherit:
  cargo binstall cargo-autoinherit
  cargo autoinherit

