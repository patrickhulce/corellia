#!/usr/bin/env bash
#
# System Settings, scripted. These were all manual checklist items in
# src/docs/setup/mac-setup.md; only the ones macOS genuinely won't let you
# script are still listed there.
#
# `defaults write` is idempotent, so this is safe to re-run.
#
#   ./src/scripts/setup/setup-macos-defaults.sh [--name Loki]

set -euo pipefail

# shellcheck source-path=SCRIPTDIR source=lib/common.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/common.sh"

COMPUTER_NAME=""

usage() {
  cat <<EOF
Usage: $(basename "$0") [--name <computer-name>]

Applies personal macOS system preferences.

Options:
  --name <name>       Set the computer, host, and local host name (needs sudo).
                      Skipped when not provided.
$(common_flags_help)
EOF
}

parse_args() {
  local rest=""
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --name)
        [ "$#" -ge 2 ] || die "--name needs a value"
        COMPUTER_NAME="$2"
        shift
        ;;
      *) rest="$rest $1" ;;
    esac
    shift
  done

  # shellcheck disable=SC2086 # deliberate word splitting of the leftovers
  parse_common_flags $rest
}

set_computer_name() {
  if [ -z "$COMPUTER_NAME" ]; then
    skip "No --name given, leaving the computer name alone"
    return
  fi

  if [ "$(scutil --get ComputerName 2>/dev/null)" = "$COMPUTER_NAME" ]; then
    skip "Computer name is already $COMPUTER_NAME"
    return
  fi

  step "Setting the computer name to $COMPUTER_NAME"
  sudo scutil --set ComputerName "$COMPUTER_NAME"
  sudo scutil --set HostName "$COMPUTER_NAME"
  sudo scutil --set LocalHostName "$COMPUTER_NAME"
  sudo defaults write /Library/Preferences/SystemConfiguration/com.apple.smb.server \
    NetBIOSName -string "$COMPUTER_NAME"
}

configure_control_center() {
  step "Showing the battery percentage"
  defaults write com.apple.controlcenter BatteryShowPercentage -bool true
  defaults -currentHost write com.apple.controlcenter BatteryShowPercentage -bool true
}

configure_trackpad() {
  step "Enabling tap to click and bottom-right secondary click"

  local domain
  for domain in com.apple.AppleMultitouchTrackpad \
    com.apple.driver.AppleBluetoothMultitouch.trackpad; do
    defaults write "$domain" Clicking -bool true
    defaults write "$domain" TrackpadRightClick -bool true
    # 2 = bottom right corner.
    defaults write "$domain" TrackpadCornerSecondaryClick -int 2
  done

  defaults write NSGlobalDomain com.apple.mouse.tapBehavior -int 1
  defaults -currentHost write NSGlobalDomain com.apple.mouse.tapBehavior -int 1
}

configure_dock() {
  step "Hiding the Dock"
  defaults write com.apple.dock autohide -bool true
  defaults write com.apple.dock autohide-delay -float 0
  defaults write com.apple.dock autohide-time-modifier -float 0.3
}

configure_windows() {
  # The System Settings checkbox is "Close windows when quitting an application";
  # keeping windows is the un-checked state.
  step "Keeping windows when quitting an application"
  defaults write NSGlobalDomain NSQuitAlwaysKeepsWindows -bool true
}

configure_screenshots() {
  step "Saving screenshots to ~/Pictures/Screenshots"
  mkdir -p "$HOME/Pictures/Screenshots"
  defaults write com.apple.screencapture location "$HOME/Pictures/Screenshots"
}

# disable_symbolic_hotkey <id> <ascii> <keycode> <modifiers>
#
# Turns off one of the shortcuts macOS reserves in com.apple.symbolichotkeys. The
# parameters are the shortcut's own default, written back alongside enabled=false
# so re-enabling it in System Settings restores the right combination instead of
# whatever we happened to leave behind.
#
# <ascii> is 65535 for keys with no character, <keycode> is the virtual key code,
# and <modifiers> is an additive Cocoa mask: shift 131072, control 262144,
# option 524288, command 1048576, fn 8388608.
disable_symbolic_hotkey() {
  local id="$1"
  local ascii="$2"
  local keycode="$3"
  local modifiers="$4"

  defaults write com.apple.symbolichotkeys AppleSymbolicHotKeys -dict-add "$id" "
    <dict>
      <key>enabled</key><false/>
      <key>value</key>
      <dict>
        <key>type</key><string>standard</string>
        <key>parameters</key>
        <array>
          <integer>$ascii</integer>
          <integer>$keycode</integer>
          <integer>$modifiers</integer>
        </array>
      </dict>
    </dict>
  "
}

# Cmd+Space goes to Raycast, and Cmd+F5 to superwhisper. Both are taken by macOS
# out of the box.
#
# The VoiceOver and Accessibility masks carry the fn bit (8388608) on top of the
# values every reference table lists, because macOS records fn as part of a
# function-key shortcut on a keyboard where F5 is a media key. Dictation's does
# not — these are the defaults macOS actually ships, read back from
# com.apple.symbolichotkeys rather than derived, so don't "fix" the odd one out.
disable_reserved_hotkeys() {
  step "Freeing Cmd+Space for Raycast"
  disable_symbolic_hotkey 64 32 49 1048576 # Spotlight search
  disable_symbolic_hotkey 65 32 49 1572864 # Finder search window, Opt+Cmd+Space

  step "Freeing Cmd+F5 for dictation"
  disable_symbolic_hotkey 59 65535 96 9437184  # Turn VoiceOver on or off
  disable_symbolic_hotkey 162 65535 96 9961472 # Accessibility Shortcuts panel

  # Apple's own dictation, on Ctrl+Opt+Cmd+F5. Only the shortcut goes: leaving
  # AppleDictationAutoEnable alone keeps Dictation reachable from the Edit menu,
  # so nothing is lost if superwhisper is ever uninstalled.
  disable_symbolic_hotkey 164 65535 96 1835008

  # Ask the settings daemon to reload rather than waiting for a logout.
  /System/Library/PrivateFrameworks/SystemAdministration.framework/Resources/activateSettings -u \
    >/dev/null 2>&1 || true
}

restart_affected_apps() {
  step "Restarting Dock, Finder, and the menu bar"
  local app
  for app in Dock Finder SystemUIServer ControlCenter; do
    killall "$app" >/dev/null 2>&1 || true
  done
}

main() {
  require_macos
  parse_args "$@"

  log "System preferences"
  set_computer_name
  configure_control_center
  configure_trackpad
  configure_dock
  configure_windows
  configure_screenshots
  disable_reserved_hotkeys

  log "Applying"
  restart_affected_apps

  cat <<'EOF'

Defaults applied. A couple of caveats:

  - Keyboard shortcut changes may need a logout to fully take hold.
  - Anything already running reads ~/Library/KeyBindings at launch, so restart
    apps to pick up the Home/End fix.
EOF
}

main "$@"
