# PATH additions.

# Personal scripts. Symlinked to src/scripts/global/bin by src/scripts/global/init.sh.
export PATH="$HOME/.scripts:$PATH"

# Tools installed with `uv tool install`.
export PATH="$HOME/.local/bin:$PATH"

# Rust. The rustup formula is keg-only because it conflicts with `rust`, so the
# cargo, rustc, and rustfmt proxies it ships are not linked into the Homebrew
# prefix and have to be added by hand.
if [ -d "${HOMEBREW_PREFIX:-/opt/homebrew}/opt/rustup/bin" ]; then
  export PATH="${HOMEBREW_PREFIX:-/opt/homebrew}/opt/rustup/bin:$PATH"
fi

# Binaries from `cargo install`.
export PATH="$HOME/.cargo/bin:$PATH"
