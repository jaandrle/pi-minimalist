# pi-minimalist

**English** | [简体中文](README.zh-CN.md) | [Français](README.fr.md)

**Less scrolling. More room for the answer.**

A quieter transcript for [Pi](https://pi.dev): turn bulky tool calls into one-line summaries, and open the full output whenever you need it.

## See the difference

**Before:** one tool call takes up most of the screen.

<img width="656" height="550" alt="before" src="https://github.com/user-attachments/assets/aa1602f7-5db1-49b8-a4d3-cbd1aef69ea0" />

**After:** the same call, one line.

<img width="699" height="50" alt="after" src="https://github.com/user-attachments/assets/c0e8bca4-afa7-42c1-9bf0-69f267d18d9f" />

**Click** a folded line to open it into separate rows. Click one row to see only its output. Click the `▾ Expanded · click to fold` line above an opened run to fold it back.

<img src="docs/click.png" width="600" alt="Clicking a folded line opens it into rows; clicking one row expands only that row">

Press **Ctrl+O** to expand tool output—including diffs and syntax highlighting. Expanded rows also wrap long commands instead of cutting them off. Nothing is removed from the session or hidden from the model; only the display changes.

## Install

```bash
pi install npm:pi-minimalist
```

Restart Pi, and tool calls appear as compact rows. No configuration needed.

## Choose how quiet you want it

Run **`/minimalist`** to change settings live. The settings come in three sections, and a sub-setting shows only while the setting above it is on:

- **Appearance**: the symbol set (Unicode or ASCII), the coloured bar left of each row, and the running time on tool calls.
- **Compact output blocks into rows**: tool calls and thinking as one-line rows. Under it, choose which tools keep their own card (**Excluded tools**: type to search, press Enter on a tool to flip it), whether a running tool call stays on its own row, and whether thinking is expanded while it is generated.
- **Merge consecutive rows into one** summary, such as `read ×2, edit ×1`. Under it, **Show only the final reply** keeps the latest reply in focus and folds everything before it into elapsed work time or tool counts.

When you turn a setting off, the choices under it are kept and come back when you turn it on again.

A fresh install starts on the **`full`** preset (see below): compact tool rows, grouped calls and compact thinking. Show only the final reply is opt-in. Choose `lite` if you prefer to see each call separately.

### Presets

The **Preset** row at the top of `/minimalist` sets five options at once: **Compact output blocks into rows**, **Compact tool call blocks**, **Compact thinking blocks**, **Merge consecutive rows into one** and **Show only the final reply**.

| Preset | What you get |
| --- | --- |
| `off` | Pi's native tool cards. |
| `lite` | One-line tool rows, each call on its own line. |
| `full` | `lite` plus combined consecutive calls and compact thinking rows. |
| `max` | `full` plus only the final reply (`Worked for …`). |
| `custom` | Your own values for those five options. |

<img src="docs/presets.png" width="600" alt="Clicking a folded line opens it into rows; clicking one row expands only that row">

A preset never overwrites your settings. While `off`, `lite`, `full` or `max` is selected, only those five rows are greyed out and show the preset's values; pressing Enter on one does nothing. Every other option (the appearance settings, Show a running tool call and so on) stays yours and stays editable, as long as the setting above it is on (a preset that turns a row off also hides the settings under it). Your own values are kept and come back when you choose `custom`. The first time you choose `custom`, it starts from `lite`.

**Upgrading:** if your settings already contain a `minimalist` block, you stay on `custom` and keep your values. One rule is new: a setting under one that is off is ignored, for example **Show only the final reply** while **Merge consecutive rows into one** is off. Only a user with no `minimalist` settings at all starts on `full`, which makes thinking rows compact. To pick another look, change **Preset**.

### Everyday controls

| Control | Action |
| --- | --- |
| `/minimalist` | Open settings (`/minimalist config` also works) |
| `/minimalist status` | Show current settings |
| Ctrl+O | Expand or collapse tool output |
| Ctrl+T | Expand or collapse thinking |

Settings apply to existing conversation history and are saved globally. If a symbol looks wrong in your terminal, choose **Symbol set → ASCII**. No Nerd Font required.

## Go back to Pi's usual view

Turn off **Compact output blocks into rows** to restore native tool cards and thinking, or **Compact tool call blocks** for tool cards only. Or choose the `off` preset.

To disable the extension completely, run `pi config`, disable pi-minimalist, and restart Pi

## Compatibility

Tested with Pi **1.0.0**. Pi updates can affect rendering compatibility; [report a problem](https://github.com/EviHex/pi-minimalist/issues) with your Pi version, terminal, and a screenshot.

[MIT licensed](LICENSE).
