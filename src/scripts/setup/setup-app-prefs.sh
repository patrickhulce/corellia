#!/usr/bin/env bash
#
# Phase 4 of the macOS setup: the per-app preferences System Settings can't reach.
# Safe to re-run.
#
#   ./src/scripts/setup/setup-app-prefs.sh              apply src/conf/defaults
#   ./src/scripts/setup/setup-app-prefs.sh --export     capture this machine
#
# The two directions are the whole point. Configure an app by hand once, --export
# it into the repo, and every machine after this one gets the same setup without
# clicking through a preferences window.

set -euo pipefail

# shellcheck source-path=SCRIPTDIR source=lib/common.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/common.sh"

PREFS_DIR="$CORELLIA_CONF_DIR/defaults"
APP_PREFS_PY="$CORELLIA_SETUP_DIR/lib/app_prefs.py"

MODE="apply"

# <domain>[:<key>,<key>,...]
#
# Every domain here is also the app's bundle identifier, which is what lets the
# script quit and relaunch the right app around a write.
#
# A key list narrows what gets captured, for domains where a whole-domain copy
# would be mostly noise. Only superwhisper needs one so far: the rest of its
# domain is a cached model catalogue that changes on every launch, Sparkle
# updater state, licence status, recorder window coordinates, and the microphone
# this particular machine happens to have.
#
# Amphetamine is deliberately absent: installed by the Brewfile, but not
# configured far enough from its defaults to be worth versioning, and it starts
# fresh on each machine at no cost.
#
# Thaw, the menu bar manager, is absent for a narrower reason. It is configured,
# but its domain carries KnownDisplays and the MenuBarItemManager.* keys, which
# describe the monitors and menu bar items of one particular machine, so a
# whole-domain capture would be mostly churn. Tracking it means a key list like
# superwhisper's below.
PREF_DOMAINS=(
  "com.knollsoft.Rectangle"
  "com.pilotmoon.scroll-reverser"
  "net.pornel.ImageOptim"
  "com.superduper.superwhisper:KeyboardShortcuts_toggleRecording,KeyboardShortcuts_pushToTalk"
)

# Glob patterns dropped from every capture. Without these, a whole-domain export
# is mostly noise: window frames encode the resolution of the display they were
# last opened on, Sparkle writes a timestamp on every launch, and an app records
# which preferences panel you happened to leave open.
#
# The first-run, migration, version, and permission flags are excluded for a
# stronger reason than noise. Carrying a `hasMigrated*` flag or Rectangle's
# `lastVersion` to a fresh install would tell the app a migration had already
# happened when it hadn't, and carrying HasRequestedAccessibilityPermission would
# suppress a prompt a new machine genuinely needs to show.
#
# The patterns below outlive the domain that taught us about them: the status
# item and split view frames came from a menu bar app that is no longer tracked,
# and they're kept because the next domain added here will write the same kind of
# thing.
PREF_EXCLUDES=(
  "NSWindow Frame *"
  "NSStatusItem Preferred Position *"
  "NSStatusItem Visible *"
  "NSSplitView Subview Frames *"
  "NSTableView *"
  "SULastCheckTime"
  "SUUpdateGroupIdentifier"
  "SUUpdateRelaunchingMarker"
  "SUSkippedVersion"
  "SUHasLaunchedBefore"
  "HasRunBefore"
  "hasMigrated*"
  "HasRequested*Permission"
  "installVersion"
  "lastVersion"
  "internalTilingNotified"
  "PrefsLastUsedPanel"
  "TerminatedWithPrefsWindowOpen"
)

usage() {
  cat <<EOF
Usage: $(basename "$0") [options]

Applies the app preferences committed in src/conf/defaults, or captures the
current machine's back into it.

Options:
  --export            Capture the allowlisted domains into src/conf/defaults
                      instead of applying them, then show what changed.
$(common_flags_help)

Domains:
$(printf '  %s\n' "${PREF_DOMAINS[@]}")
EOF
}

parse_args() {
  local rest=""
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --export) MODE="export" ;;
      *) rest="$rest $1" ;;
    esac
    shift
  done

  # shellcheck disable=SC2086 # deliberate word splitting of the leftovers
  parse_common_flags $rest
}

# --- domain specs -----------------------------------------------------------

spec_domain() { printf '%s' "${1%%:*}"; }

# Empty when the spec has no key list, meaning "the whole domain".
spec_keys() {
  case "$1" in
    *:*) printf '%s' "${1#*:}" ;;
    *) printf '' ;;
  esac
}

# Comma rather than space, because several preference keys contain spaces.
join_commas() {
  local IFS=","
  printf '%s' "$*"
}

# --- app lifecycle ----------------------------------------------------------

# A running app holds its preferences in memory and writes them back when it
# quits, which would silently undo everything below. So it gets quit first and
# relaunched afterwards.
app_is_running() {
  osascript -e "application id \"$1\" is running" 2>/dev/null | grep -q '^true$'
}

quit_app() {
  osascript -e "quit application id \"$1\"" >/dev/null 2>&1 || true

  # Up to five seconds, because quitting is asynchronous and writing while the app
  # is still shutting down is the race we're trying to avoid.
  local waited=0
  while [ "$waited" -lt 10 ]; do
    if ! app_is_running "$1"; then
      # "Not running" is reported before the process has necessarily finished
      # flushing its preferences, and a late flush lands on top of our write.
      # verify_domain is the real guard, but a settle margin makes it rare.
      sleep 1
      return 0
    fi
    sleep 0.5
    waited=$((waited + 1))
  done

  warn "$1 is still running; it may overwrite these preferences when it quits"
}

# --- apply ------------------------------------------------------------------

apply_domain() {
  local spec="$1"
  local domain
  domain="$(spec_domain "$spec")"
  local file="$PREFS_DIR/$domain.plist"

  if [ ! -f "$file" ]; then
    skip "$domain has nothing committed yet"
    return
  fi

  local relaunch=0
  if app_is_running "$domain"; then
    relaunch=1
    step "Quitting $domain"
    quit_app "$domain"
  fi

  local live merged
  live="$(mktemp -t corellia-prefs-live)"
  merged="$(mktemp -t corellia-prefs-merged)"

  # Merge rather than import the committed file directly: for a domain with a key
  # list, that file holds two keys out of twenty, and importing it wholesale would
  # throw away the app's licence and onboarding state. A domain that doesn't exist
  # yet just merges onto nothing, which is the fresh-machine case.
  defaults export "$domain" "$live" 2>/dev/null || : >"$live"
  python3 "$APP_PREFS_PY" merge "$live" "$file" "$merged"
  defaults import "$domain" "$merged"
  rm -f "$live" "$merged"

  step "Applied $domain"

  if [ "$relaunch" -eq 1 ]; then
    open -b "$domain" >/dev/null 2>&1 || warn "could not relaunch $domain"
    # Let it finish reading, and writing, its preferences before checking.
    sleep 2
  fi

  verify_domain "$domain" "$file"
}

# Confirms the values actually stuck. An app that is quitting, or one that
# rewrites its preferences on launch, can drop a key we just wrote; without this
# that happens silently and the setting is simply gone.
verify_domain() {
  local domain="$1"
  local file="$2"

  local live drifted
  live="$(mktemp -t corellia-prefs-verify)"
  defaults export "$domain" "$live" 2>/dev/null || : >"$live"

  if ! drifted="$(python3 "$APP_PREFS_PY" compare "$live" "$file")"; then
    warn "$domain did not keep: $(echo "$drifted" | tr '\n' ' ')"
    warn "  quit it, re-run this script, and check the app's own settings window"
  fi

  rm -f "$live"
}

# --- export -----------------------------------------------------------------

export_domain() {
  local spec="$1"
  local domain keys
  domain="$(spec_domain "$spec")"
  keys="$(spec_keys "$spec")"

  local live
  live="$(mktemp -t corellia-prefs-live)"

  if ! defaults export "$domain" "$live" 2>/dev/null; then
    rm -f "$live"
    skip "$domain has no preferences on this machine"
    return
  fi

  if python3 "$APP_PREFS_PY" filter "$live" "$PREFS_DIR/$domain.plist" \
    --keys "$keys" --exclude "$(join_commas "${PREF_EXCLUDES[@]}")"; then
    step "Captured $domain"
  else
    skip "$domain had nothing worth capturing"
  fi

  rm -f "$live"
}

report_changes() {
  have git || return 0

  log "Review before committing"
  git -C "$CORELLIA_ROOT" status --short -- "$PREFS_DIR" ||
    warn "could not read git status for $PREFS_DIR"
}

# --- main -------------------------------------------------------------------

main() {
  require_macos
  parse_args "$@"

  [ -f "$APP_PREFS_PY" ] || die "missing $APP_PREFS_PY"

  local spec

  if [ "$MODE" = "export" ]; then
    mkdir -p "$PREFS_DIR"
    log "Capturing app preferences"
    for spec in "${PREF_DOMAINS[@]}"; do
      export_domain "$spec"
    done
    report_changes
    return
  fi

  log "Applying app preferences"
  for spec in "${PREF_DOMAINS[@]}"; do
    apply_domain "$spec"
  done

  cat <<'EOF'

Preferences applied. Anything that was running has been relaunched; anything that
wasn't will pick these up the next time it starts.

To capture a change you made by hand:

  ./src/scripts/setup/setup-app-prefs.sh --export
EOF
}

main "$@"
