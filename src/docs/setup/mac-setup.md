# macOS Setup

Run initial setup scripts using corellia.

```sh
# In a regular terminal.
sh -c "$(curl -fsSL https://raw.githubusercontent.com/patrickhulce/corellia/main/src/scripts/setup/setup-zsh.sh)"
# Now the rest in an oh-my-zsh iTerm2 terminal.
sh -c "$(curl -fsSL https://raw.githubusercontent.com/patrickhulce/corellia/main/src/scripts/setup/setup-system.sh)"
source ~/.zshrc
sh -c "$(curl -fsSL https://raw.githubusercontent.com/patrickhulce/corellia/main/src/scripts/setup/setup-languages.sh)"
```

## Manual Configurations

1. System Preferences
   1. Show battery percentage ("Control Center" prefs)
   1. Enable tap to click, right click bottom corner of trackpad
   1. Hide the dock
   1. Uncheck "Close windows when quitting an application"
   1. Update device name in Preferences > Sharing
   1. Change default web browser
   1. Remove default Spotlight keyboard shortcut
1. Install [ScrollReverser](https://pilotmoon.com/scrollreverser/)
1. Install [VS Code Insiders](https://code.visualstudio.com/insiders/)
   1. Setup `code-insiders` to PATH (SHIFT+CMD+P, "Shell command")
   1. Enable Settings Sync (Login to GitHub)
1. Install [Google Drive client](https://www.google.com/drive/download/).
1. Install 1Password.
1. Configure Dock icons.
1. Configure Raycast (Cmd+Space)
1. Configure Spectacles (Cmd+Option+Ctrl+Up)
1. GitHub Public Key
   1. `cat ~/.ssh/id_ed25519.pub | pbcopy`
   1. Add that to
1. Keychain
   1. Manually Export Each Certificate and Private Key in Keychain Access (Must right-click and "Export" each one individually or they won't be included)

## Optional Steps

These steps used to be useful but not as necessary.

<details>
<summary>Homebrew packages</summary>

```
ansible		fontconfig	gradle		influxdb	libtiff		openjpeg	postgresql	webp
autoconf	freetype	grafana		jpeg		libtool		openssl		protobuf	x264
automake	fribidi		graphite2	jq		libvorbis	openssl@1.1	python		x265
bash		gdbm		harfbuzz	lame		libvpx		opus		python@2	xvid
cairo		gettext		heroku		libass		libyaml		pango		readline	xz
coreutils	giflib		heroku-node	libffi		little-cms2	pcre		redis
direnv		git-lfs		httrack		libgpg-error	mysql		pipenv		rename
fdk-aac		glib		hub		libksba		nasm		pixman		sqlite
ffmpeg		gnu-time	icu4c		libogg		nmap		pkg-config	texi2html
findutils	go		imagemagick	libpng		oniguruma	pngquant	tree
```

</details>

<details>
<summary>Homebrew Cask Packages</summary>

```
android-platform-tools          google-cloud-sdk                java8                           virtualbox
android-sdk                     inkscape                        react-native-debugger           virtualbox-extension-pack
android-studio                  iterm2                          spotify                         xquartz
```

</details>

<details>
<summary>NPM Packages</summary>

```
/Users/patrick/.nvm/versions/node/v10.15.3/lib
├── @patrickhulce/scripts@0.0.0 -> /Users/patrick/Code/OpenSource/hulk
├── @sentry/cli@1.41.1
├── appcenter-cli@1.1.5
├── cordova@8.1.2
├── cordova-icon@1.0.0
├── cordova-splash@1.0.0
├── create-react-app@3.0.1
├── diff-so-fancy@1.2.0
├── expo-cli@3.11.1
├── firebase-tools@7.5.0
├── gatsby-cli@2.7.53
├── http-server@0.11.1
├── imageoptim-cli@2.3.4
├── ionic@4.2.1
├── ios-deploy@1.9.4
├── jest@24.8.0
├── jest-codemods@0.19.1
├── lerna@3.4.3
├── UNMET PEER DEPENDENCY lighthouse@3.0.1
├── lighthouse-plugin-field-performance@1.0.3
├── mocha@5.2.0
├── ndb@1.1.5
├── npm@6.13.4
├── phonegap@8.0.0
├── pkgfiles@2.3.2
├── preact-cli@2.2.1
├── react-devtools@4.2.1
├── siegem@1.0.1
├── source-map-explorer@1.5.0
├── surge@0.20.1
├── tslint@5.10.0
├── typescript@3.7.4
├── uncss@0.16.2
├── webpack@4.15.1
├── yarn@1.21.1
└── yo@2.0.3
```

</details>

<details>
<summary>iTerm 2 Configuration</summary>

- General > Reuse previous session
- Text > 18pt Monaco
- Window > Transparency
- Terminal > 10000 Scrollback lines
- Keys > Add Cmd+\ Shortcut = "Split Vertically"
</details>

<details>
<summary>.zshrc</summary>

```
export GH_TOKEN=""
export PERSONAL_WPT_KEY=""
export WPT_KEY=""

export ANDROID_SDK_ROOT="/usr/local/share/android-sdk"
export ANDROID_BUILD_TOOLS="/usr/local/Caskroom/android-sdk/4333796/build-tools/27.0.3"
```

</details>

<details>
<summary>Windows VM</summary>

1. Setup Windows Development VM

- Install from WIndows Insider Preview ISO
- Enable Windows Subsystem for Linux
- Install Ubuntu LTS
- Setup Keybindings
  - Install Sharpkeys https://www.randyrants.com/category/sharpkeys/
    - Map Command to Ctrl + Ctrl to Command
  - Install Autohotkey https://www.autohotkey.com/
    - Map Ctrl+Tab to AltTab
    - Map Ctrl+Q to Alt+F4
    - Map Ctrl+Space to Win+Q
    - Map Ctrl+Alt+Win+Left to Win+Left (same for up/right)
    - Map Alt+C to Ctrl+C
    - Run script on startup
      - Find the script file, select it, and press Control+C.
      - Press Win+R to open the Run dialog, then enter shell:startup.
      - Right click inside the window, and click "Paste Shortcut".

```
LCtrl & Tab::AltTab
!Tab::Send {LCtrl down}{Tab}{LCtrl up}
!+Tab::Send {Shift down}{LCtrl down}{Tab}{LCtrl up}{Shift up}
LCtrl & Space::Send {LWin down}q{LWin up}
LAlt & c::Send {LCtrl down}c{LCtrl up}
LCtrl & q::Send !{f4}
```

    - In macOS remove Cmd+Q === Quit binding
        - open ~/Library/Preferences/org.virtualbox.app.VirtualBoxVM.plist
        - Add `NSUserKeyEquivalents` dictionary, `Quit VirtualBox VM` key, `@~^\` value

- Setup Ubuntu Environment
  - Copy ssh key to Ubuntu VM
  - Enable [QuickEdit + Copy/Paste](https://stackoverflow.com/questions/38832230/copy-paste-in-bash-on-ubuntu-on-windows)
- Install VS Code Insiders
- Install Git bash
  - Copy ssh key to Git bash ssh dir
- Install Node LTS (installs choco too)
- Install nvm-windows

</details>

<details>
<summary>Epson Scan</summary>

Disable the stupid epson scan notifications
https://stevenwestmoreland.com/2020/07/how-to-remove-the-epson-scansmart-icon-from-the-macos-menu-bar.html
Type `id` change the “501” part of the commands below to match your uid.
Type `launchctl disable gui/501/com.epson.scannermonitor`
Type `launchctl disable gui/501/com.epson.eventmanager.agent`

</details>
