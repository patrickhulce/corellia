#!/usr/bin/env bash
# SSH identity and the GitHub sign-in, shared by the macOS and Linux setups.
# Source this after lib/common.sh, don't run it.

SSH_KEY="${CORELLIA_SSH_KEY:-$HOME/.ssh/id_ed25519}"

machine_name() {
  if is_macos; then
    scutil --get ComputerName 2>/dev/null || hostname -s
  else
    hostname -s 2>/dev/null || hostname
  fi
}

# An ordinary on-disk ed25519 key. ssh-agent holds it for the session and, on
# macOS, the login Keychain remembers the passphrase, so this is a one-time
# prompt. 1Password is for secrets (see mac-setup.md#secrets), not for ssh.
configure_ssh() {
  mkdir -p "$HOME/.ssh"
  chmod 700 "$HOME/.ssh"

  if [ -f "$SSH_KEY" ]; then
    skip "$SSH_KEY already exists"
  else
    step "Generating an ed25519 key"
    note "It asks for a passphrase. Choose one; the agent remembers it."
    ssh-keygen -t ed25519 -C "$CORELLIA_GIT_EMAIL ($(machine_name))" -f "$SSH_KEY"
  fi

  configure_ssh_defaults
  trust_github_host_key
  load_ssh_key
  upload_ssh_key
}

# A catch-all appended after any existing Host blocks, which is the right place
# for it: ssh takes the first value it finds for most keywords, so anything more
# specific already in the file still wins.
#
# A function for the same reason as zshrc_loader_block: a heredoc nested in a
# command substitution is a bash 3.2 parse error waiting for someone to write an
# apostrophe in it.
ssh_config_block() {
  # UseKeychain is Apple's, and OpenSSH elsewhere rejects the keyword outright
  # rather than ignoring it — which would break every ssh on the machine, this
  # being a `Host *` block. Built as a variable rather than branching on the
  # whole heredoc, so the two platforms can't drift in the rest of it.
  local keychain=""
  if is_macos; then
    keychain='
  # The login Keychain answers the passphrase prompt, so it survives reboots.
  UseKeychain yes'
  fi

  cat <<EOF
# >>> corellia >>>
Host *
  # Load the key into the agent on first use, so the passphrase is asked once.
  AddKeysToAgent yes$keychain
  IdentityFile $SSH_KEY
# <<< corellia <<<
EOF
}

configure_ssh_defaults() {
  if ensure_block "$HOME/.ssh/config" '>>> corellia >>>' "$(ssh_config_block)"; then
    step "Wrote ssh defaults to ~/.ssh/config"
  else
    skip "ssh defaults already in ~/.ssh/config"
  fi
  chmod 600 "$HOME/.ssh/config"
}

# GitHub's published ed25519 host key fingerprint:
# https://docs.github.com/authentication/keeping-your-account-and-data-secure/githubs-ssh-key-fingerprints
GITHUB_HOST_KEY="SHA256:+DiY3wvvV6TuJJhbpZisF/zLDA0zPMSvHdkr4UvCOqU"
GITHUB_KNOWN_HOSTS="$HOME/.ssh/known_hosts"

# Without this the first clone stops on "The authenticity of host 'github.com'
# can't be established", in the middle of the stretch where nothing else needs
# you. Checking what ssh-keyscan returns against the fingerprint GitHub
# publishes also makes it a better decision than the prompt, which most people
# answer "yes" to without comparing anything.
trust_github_host_key() {
  if [ -f "$GITHUB_KNOWN_HOSTS" ] &&
    ssh-keygen -F github.com -f "$GITHUB_KNOWN_HOSTS" >/dev/null 2>&1; then
    skip "github.com already in ~/.ssh/known_hosts"
    return
  fi

  local scanned fingerprint
  if ! scanned="$(ssh-keyscan -t ed25519 github.com 2>/dev/null)" || [ -z "$scanned" ]; then
    warn "could not reach github.com for its host key; the first clone will ask"
    return
  fi

  if ! fingerprint="$(printf '%s\n' "$scanned" | ssh-keygen -lf - | awk '{print $2}')" ||
    [ "$fingerprint" != "$GITHUB_HOST_KEY" ]; then
    warn "github.com offered an unrecognised host key ($fingerprint); not trusting it"
    return
  fi

  printf '%s\n' "$scanned" >>"$GITHUB_KNOWN_HOSTS"
  step "Added the github.com host key to ~/.ssh/known_hosts"
}

# macOS runs an agent for every session through launchd. A Linux box reached
# over ssh usually has none, and `ssh-add` there fails with "Could not open a
# connection to your authentication agent" — which reads like the key is at
# fault rather than like there is nothing to add it to.
start_ssh_agent() {
  if is_macos; then
    return 0
  fi

  # 0 is an agent holding keys and 1 an agent holding none; only 2 means there
  # is no agent to talk to.
  local status=0
  ssh-add -l >/dev/null 2>&1 || status=$?
  if [ "$status" -ne 2 ]; then
    return 0
  fi

  step "Starting ssh-agent"
  note "This one is for this shell only; your login shell starts its own."
  eval "$(ssh-agent -s)" >/dev/null
}

load_ssh_key() {
  local fingerprint
  fingerprint="$(key_fingerprint)"

  start_ssh_agent

  if ssh-add -l 2>/dev/null | grep -qF "$fingerprint"; then
    skip "key already loaded in ssh-agent"
    return
  fi

  step "Adding the key to ssh-agent"
  # --apple-use-keychain is what hands the passphrase to the login Keychain, so
  # it is asked for once rather than once per session. There is no equivalent
  # elsewhere; a Linux box asks again after every reboot.
  local keychain_flag=""
  if is_macos; then
    keychain_flag="--apple-use-keychain"
  fi

  # shellcheck disable=SC2086 # empty off macOS, and must not become an argument
  ssh-add $keychain_flag "$SSH_KEY" ||
    warn "could not add the key to the agent; run 'ssh-add $keychain_flag $SSH_KEY'"
}

key_fingerprint() {
  ssh-keygen -lf "$SSH_KEY.pub" | awk '{print $2}'
}

# The base64 key material, without the type or comment around it. This is what
# `gh ssh-key list` prints, and the fingerprint is not, so comparing fingerprints
# never matched and every run tried to re-add a key that was already there.
key_body() {
  awk '{print $2}' "$SSH_KEY.pub"
}

# Uploading a key needs a scope the default login doesn't request.
GH_KEY_SCOPE="admin:public_key"

upload_ssh_key() {
  if ! have gh; then
    warn "gh is not installed; add $SSH_KEY.pub to GitHub yourself"
    return
  fi

  # Explicitly zero: a sign-in you skipped or abandoned has already warned, and
  # is not a reason to take the phases after this one down with it.
  sign_in_to_github || return 0

  if gh ssh-key list 2>/dev/null | grep -qF "$(key_body)"; then
    skip "public key already on GitHub"
    return
  fi

  step "Adding the public key to GitHub"
  gh ssh-key add "$SSH_KEY.pub" --title "$(machine_name)" ||
    warn "could not add the key automatically; add it at https://github.com/settings/keys"
}

# Nothing that can prompt may be redirected here. Both commands below stop and
# ask you to copy a one-time code, and one of them used to run with its output
# on /dev/null: from the outside that is indistinguishable from a hung script,
# and it is exactly where this setup appeared to freeze. `gh auth status` is the
# exception, since it only reports.
sign_in_to_github() {
  if ! gh auth status >/dev/null 2>&1; then
    # The device flow prints a code and then polls for it for fifteen minutes.
    # With no terminal to read the code off — a container, a provisioning run,
    # anything started under nohup — that is a quarter of an hour of a setup
    # that has, to all appearances, hung.
    if [ ! -t 0 ]; then
      warn "not a terminal; run 'gh auth login' yourself and re-run this script"
      return 1
    fi

    step "Signing in to GitHub"
    note "gh prints a one-time code and a URL to enter it at. It waits for you."
    # --skip-ssh-key: the upload happens below, with a title naming the machine.
    gh auth login --hostname github.com --git-protocol ssh \
      --scopes "$GH_KEY_SCOPE" --skip-ssh-key || {
      warn "GitHub sign-in did not complete; re-run this script once it has"
      return 1
    }
    return 0
  fi

  # An older login won't have the scope, since it wasn't asked for until now.
  if gh auth status 2>&1 | grep -q "$GH_KEY_SCOPE"; then
    skip "already signed in to GitHub"
    return 0
  fi

  step "Granting gh the $GH_KEY_SCOPE scope"
  note "gh prints a one-time code and a URL to enter it at. It waits for you."
  gh auth refresh --hostname github.com --scopes "$GH_KEY_SCOPE" || {
    warn "could not grant $GH_KEY_SCOPE; add the key at https://github.com/settings/keys"
    return 1
  }
}
