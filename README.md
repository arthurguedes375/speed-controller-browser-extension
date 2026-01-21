# Video Speed Controller

A tiny, browser extension that gives you precise, keyboard-driven control over **any HTML5 video** on the web. It injects a lightweight overlay showing the current playback speed and lets you change speed instantly without opening player menus or fighting site-specific UIs.

This extension is intentionally simple: no popups, no permissions gymnastics, no tracking. It just works wherever a `<video>` tag exists.

This project was made for fun in almost an hour so don't judge me for the funny code base. I just wanted to get this code up and running as soon as possible because I was so pissed that every video speed controller extension had malwares included in their codebase that I decided to code my own with a few lines of code. This extension has no malwares or anything like that, take a look at the code. I hope I save you an hour of coding your own browser extension.

---

## Keyboard controls

These shortcuts apply to the currently playing video on the page:

- **`D`** → Increase playback speed by **+0.1×**  
  Useful for slowly ramping up comprehension without sounding like chipmunks.

- **`S`** → Decrease playback speed by **−0.1×**  
  Handy when a speaker suddenly decides to outrun causality.

- **`R`** → Toggle **1.0× (normal speed)**  
  Press again to return to your previous speed.

- **`G`** → Toggle **2.0× speed**  
  Press again to snap back to your last speed.

The extension remembers the *last non‑preset speed* so toggling feels natural instead of destructive.

---

## Installation (Chrome, Brave, Edge)

This extension is loaded **unpacked**, which is perfect for development and personal use.

1. Clone or download this repository
2. Open your browser and navigate to:
   - **Chrome / Edge**: `chrome://extensions`
   - **Brave**: `brave://extensions`
3. Enable **Developer mode** (top right)
4. Click **“Load unpacked”**
5. Select the **root folder of this project** (the one containing `manifest.json`)
6. Open any website with a video and press `D`, `S`, `R`, or `G`

The extension runs immediately — no browser restart required.

---

## Features

- Works on **all websites** (any page with a video tag)
- Keyboard shortcuts for instant speed changes
- On‑screen speed indicator overlay
- Automatically detects videos added dynamically (SPAs, infinite scroll, etc.)
- No configuration, no UI clutter

---

## How it works (high level)

- A content script is injected into every page
- It scans for `<video>` elements and wraps them in a lightweight container
- A small overlay displays the current playback rate
- A `MutationObserver` watches the DOM so videos loaded later also get support
- Global key listeners adjust `video.playbackRate` directly

No magic. Just DOM, events, and respect for your attention.

---

## Why this exists

Video players love hiding speed controls three clicks deep—or worse, not offering fine‑grained control at all. This project aims to:

- Make playback speed **universal** across websites
- Enable **incremental speed changes** (not just 1×, 1.5×, 2×)
- Keep interaction **muscle‑memory friendly** via the keyboard
- Stay invisible until you need it

Think of it as a physics dial for time. Turn gently, observe the system, repeat.

---

## Project structure

- `manifest.json` — Chrome Extension Manifest (v3)
- `src/content-scripts/load.js` — Core logic: DOM injection, keyboard handling, observers
- `assets/` — Extension icons

---

## Design philosophy

- **Minimal surface area**: no popup, no options page
- **Keyboard-first**: speed is a continuous variable, not a menu choice
- **Predictable behavior**: toggles remember where you came from
- **Local only**: no network calls, no storage, no surprises

---

## Future ideas (not promises)

- Per‑site or per‑video speed memory
- Customizable key bindings
- Optional mouse controls
- Visual polish for different video layouts

The current version is intentionally small. Complexity is easy to add later; restraint is harder.

---


<p align="center"> Made with :heart: by <bold>Arthur Guedes</bold>
</p>

