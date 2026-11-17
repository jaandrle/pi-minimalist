/** `/minimalist` (also `/minimalist config`) — Pi's SettingsList with live, conditional rows. */

import { truncateToWidth, type AutocompleteItem, type Component, type SettingItem, type SettingsList, type SettingsListTheme } from "@earendil-works/pi-tui";
import {
  BASIC_KEYS,
  LINGER_SECONDS,
  LOOK_KEYS,
  PARENTS,
  PRESET_NAMES,
  isPreset,
  type BasicKey,
  type BasicSettings,
  type Config,
  type Settings,
} from "./config.ts";

type Field = {
  key: BasicKey;
  label: string;
  description: string;
  /** Draw one blank line above this row: it starts a new section. */
  section?: boolean;
};

/**
 * Label and hover description for every basic setting, in display order.
 *
 * A sub-setting (one with an entry in `PARENTS`) is indented one step per
 * level and shown only while its parent is on.
 */
export const FIELDS: Field[] = [
  {
    key: "preset",
    label: "Preset",
    description: "off = native Pi, lite = one-line tool rows, full = + merged rows and thinking rows, max = + only the final reply. custom uses your own values. A preset only sets the compact, merge and final-reply rows; your other settings are kept.",
  },
  {
    key: "glyphStyle",
    label: "Symbol set",
    description: "Use ordinary Unicode symbols, or switch to ASCII if some symbols are missing or misaligned. A Nerd Font is not required.",
    section: true,
  },
  {
    key: "gutter",
    label: "Coloured bar left of each row",
    description: "Show a coloured bar to the left of each row, making tool calls easier to spot.",
  },
  {
    key: "timer",
    label: "Show running time on tool calls",
    description: "Show how long a running tool call has taken, updated once per second.",
  },
  {
    key: "compactRows",
    label: "Compact output blocks into rows",
    description: "Draw tool calls and thinking as one-line rows. Off restores Pi's native blocks; the choices below are kept for later.",
    section: true,
  },
  {
    key: "compactToolRows",
    label: "Compact tool call blocks",
    description: "Show each tool call as one line instead of Pi's full card. Ctrl+O still shows the output.",
  },
  {
    key: "keepActiveToolsExpanded",
    label: "Show a running tool call",
    description: "'merged with others' lets a running tool call join a merged row; 'as its own row' keeps it separate so you can watch it; 'expanded' also shows its output as it arrives, like Ctrl+O.",
  },
  {
    key: "toolLingerSeconds",
    label: "Keep that view after it ends",
    description: "How long a finished tool call keeps its running view (own row or expanded) before it folds or collapses. 0 = right away.",
  },
  {
    key: "thinkingAsToolCall",
    label: "Compact thinking blocks",
    description: "Show collapsed thinking as a one-line row. Off restores Pi's native thinking.",
  },
  {
    key: "keepActiveThinkingExpanded",
    label: "Expand thinking while generating",
    description: "Show the full thinking block as it arrives, instead of collapsed.",
  },
  {
    key: "thinkingLingerSeconds",
    label: "Keep it open after it ends",
    description: "How long thinking stays expanded after it is generated, so a short thought can be read. 0 = collapse right away.",
  },
  {
    key: "groupToolRuns",
    label: "Merge consecutive rows into one",
    description: "Replace consecutive finished rows with a single count, e.g. 'read ×2, edit ×1'.",
    section: true,
  },
  {
    key: "foldIntermediateActivity",
    label: "Show only the final reply",
    description: "Show only the latest reply of each turn. Earlier text, thinking and tool calls fold into one summary line.",
  },
  {
    key: "foldEarlierTurnsOnly",
    label: "Apply only to earlier turns",
    description: "Keep the current turn fully visible; it folds when you send the next prompt.",
  },
  {
    key: "activitySummary",
    label: "Summary of the hidden part",
    description: "Show either the elapsed work time or the tools used in place of the hidden part.",
  },
];

/** Rows with a blank line above them. */
const SECTION_STARTS = new Set<string>(FIELDS.filter((field) => field.section).map((field) => field.key));

/** How many parents a setting has, i.e. how far its label is indented. */
function depth(key: string): number {
  let level = 0;
  for (let parent = PARENTS[key as BasicKey]; parent; parent = PARENTS[parent]) level++;
  return level;
}

const indent = (key: string, label: string) => "  ".repeat(depth(key)) + label;

/**
 * A row is visible while every parent above it is on. The whole chain is
 * checked, not only the direct parent, so raw (un-layered) settings work too.
 */
function visible(key: BasicKey, settings: Settings): boolean {
  for (let parent = PARENTS[key]; parent; parent = PARENTS[parent]) {
    if (!settings[parent]) return false;
  }
  return true;
}

/** Visible fields, in display order. */
function visibleFields(settings: Settings): Field[] {
  return FIELDS.filter((field) => visible(field.key, settings));
}

type InputComponent = Component & { handleInput(data: string): void };
type SettingsListConstructor = new (...args: ConstructorParameters<typeof SettingsList>) => SettingsList;
type BasicValue = BasicSettings[BasicKey];

/** `custom` is the only preset whose look rows you can edit; say so where it is shown. */
const CUSTOM_LABEL = "custom (editable)";
const presetLabel = (preset: string) => (preset === "custom" ? CUSTOM_LABEL : preset);

const isLook = (key: string) => (LOOK_KEYS as readonly string[]).includes(key);

/** Conditional rows plus their display values. `dim` greys the look rows a preset owns. */
export function items(settings: Settings, dim?: (text: string) => string): SettingItem[] {
  return visibleFields(settings).map(
    ({ key, label: name, description }) => {
      const label = indent(key, name);
      const value = displayValue(key, settings[key]);
      // SettingsList has no disabled rows, so a locked row shows its dimmed value
      // as its ONLY value: Enter "cycles" to the same text and nothing changes.
      // The label is dimmed too: ordinary values are already `muted`, which is too
      // close to the hint colour to tell a locked row apart, while ordinary labels
      // are the default colour.
      if (dim && isLook(key)) {
        const dimmed = dim(value);
        const hint = `Set by the '${settings.preset}' preset. Switch Preset to 'custom (editable)' to edit (your custom values are kept).`;
        return { id: key, label: dim(label), description: hint, currentValue: dimmed, values: [dimmed] };
      }
      return { id: key, label, description, currentValue: value, values: choices(key).map(([, text]) => text) };
    },
  );
}

export type ConfigScreenDeps = {
  SettingsList: SettingsListConstructor;
  theme: SettingsListTheme;
  config: Config;
  onChange: (key: BasicKey, value: BasicValue) => void;
  /** Names of every tool known right now; read each time the picker opens, so it is never stale. */
  toolNames: () => string[];
  /** Called with the new `excludeTools` after every toggle in the picker. */
  onExcludeChange: (names: string[]) => void;
  onClose: () => void;
};

const EXCLUDE_ID = "excludeTools";
const PICKER_ROWS = 12;

/** "none", the names when there are one or two, else a count. */
export function excludedSummary(names: string[]): string {
  if (names.length === 0) return "none";
  return names.length <= 2 ? names.join(", ") : `${names.length} tools`;
}

/**
 * One row per tool; Enter flips it between `compact` and `excluded`. It reuses
 * SettingsList with its built-in search, so it has Pi's own keys and look and
 * no list/filter code of ours. Names in `excludeTools` that no loaded tool
 * carries (an extension not loaded this session) stay listed, or opening the
 * picker would quietly forget them.
 */
function toolPicker(deps: ConfigScreenDeps, done: (summary: string) => void): Component {
  const { SettingsList, theme, config, toolNames, onExcludeChange } = deps;
  let excluded = [...config.get("excludeTools")];
  const known = new Set(toolNames());
  const names = [...new Set([...known, ...excluded])].sort((a, b) => a.localeCompare(b));
  const rows: SettingItem[] = names.map((name) => ({
    id: name,
    label: name,
    description: known.has(name) ? undefined : "Not loaded in this session; kept in your settings.",
    currentValue: excluded.includes(name) ? "excluded" : "compact",
    values: ["compact", "excluded"],
  }));
  return new SettingsList(
    rows,
    Math.min(PICKER_ROWS, Math.max(rows.length, 1)),
    theme,
    (name, value) => {
      excluded = value === "excluded" ? [...excluded, name] : excluded.filter((n) => n !== name);
      onExcludeChange(excluded);
    },
    () => done(excludedSummary(excluded)),
    { enableSearch: true },
  );
}

/** Build a live screen; every change rebuilds the list, so sub-settings appear or disappear at once. */
export function createConfigScreen(deps: ConfigScreenDeps): InputComponent {
  const { SettingsList, theme, config, onChange, onClose } = deps;
  let list: SettingsList;
  let rows: SettingItem[] = [];
  let locked = false;
  // The section gaps are drawn around the main list only, never around the picker.
  let pickerOpen = false;

  const excludeRow = (): SettingItem => ({
    id: EXCLUDE_ID,
    // A child of "Compact tool call blocks", like the rows that follow it.
    label: "  ".repeat(depth("compactToolRows") + 1) + "Excluded tools",
    description: "Tools drawn with their own card instead of a one-line row, e.g. subagent. Enter to pick; type to search.",
    currentValue: excludedSummary(config.get("excludeTools")),
    submenu: (_current, done) => {
      pickerOpen = true;
      return toolPicker(deps, (summary) => {
        pickerOpen = false;
        done(summary);
      });
    },
  });

  const build = () => {
    locked = config.all().preset !== "custom";
    rows = items(config.all(), locked ? theme.hint : undefined);
    // The picker belongs to the tool call rows, so it sits right under them.
    const tools = rows.findIndex((row) => row.id === "compactToolRows");
    if (tools >= 0 && config.get("compactToolRows")) rows.splice(tools + 1, 0, excludeRow());
    return new SettingsList(
      rows,
      rows.length,
      theme,
      (id, text) => {
        if (!isBasicKey(id)) return;
        // Locked rows only echo their own text; do nothing (their description explains).
        if (locked && isLook(id)) return;
        const value = parseValue(id, text);
        if (value === undefined) return;
        config.set(id, value);
        onChange(id, value);
        // Any change can show or hide sub-settings (or lock rows, for Preset).
        list = build();
        list.selectItem(id);
      },
      onClose,
    );
  };

  /** Main-list line index of each row that starts a section, i.e. has a blank line above it. */
  const gaps = () => (pickerOpen ? [] : rows.flatMap((row, index) => (index > 0 && SECTION_STARTS.has(row.id) ? [index] : [])));

  list = build();
  return {
    render: (width) => {
      const lines = list.render(width);
      for (const index of gaps().reverse()) lines.splice(index, 0, "");
      return [...lines, truncateToWidth(theme.hint("  Changes apply live · Ctrl+O reveals tool output"), width)];
    },
    handleInput: (data) => list.handleInput(data),
    handleMouse: (event) => {
      // The blank lines are ours, so move `y` back to the line SettingsList drew.
      let y = event.y;
      for (const [count, index] of gaps().entries()) {
        const blank = index + count;
        if (event.y === blank) return undefined;
        if (event.y > blank) y--;
      }
      return list.handleMouse?.({ ...event, y });
    },
    invalidate: () => list.invalidate?.(),
  };
}

function isBasicKey(id: string): id is BasicKey {
  return (BASIC_KEYS as string[]).includes(id);
}

const LINGER_CHOICES: [BasicValue, string][] = LINGER_SECONDS.map((seconds) => [seconds, `${seconds}s`]);

/** Stored value and shown text of every non-boolean choice; booleans are on/off. */
const CHOICE_TEXT: Partial<Record<BasicKey, [BasicValue, string][]>> = {
  preset: PRESET_NAMES.map((name) => [name, presetLabel(name)]),
  glyphStyle: [["unicode", "Unicode"], ["ascii", "ASCII"]],
  keepActiveToolsExpanded: [[false, "merged with others"], [true, "as its own row"], ["expanded", "expanded, like Ctrl+O"]],
  toolLingerSeconds: LINGER_CHOICES,
  thinkingLingerSeconds: LINGER_CHOICES,
  activitySummary: [["elapsed", "elapsed time"], ["tools", "tools used"]],
};
const ON_OFF: [BasicValue, string][] = [[true, "on"], [false, "off"]];
const choices = (key: BasicKey) => CHOICE_TEXT[key] ?? ON_OFF;

function displayValue(key: BasicKey, value: BasicValue): string {
  // A hand-written number of seconds that is not one of the choices still reads as seconds.
  return choices(key).find(([stored]) => stored === value)?.[1] ?? (typeof value === "number" ? `${value}s` : String(value));
}

/** The stored value for a shown text; undefined (write nothing) for a text we never offered. */
function parseValue(key: BasicKey, text: string): BasicValue | undefined {
  return choices(key).find(([, shown]) => shown === text)?.[0];
}

/** Argument completions for `/minimalist ...`. */
export function argumentCompletions(prefix: string): AutocompleteItem[] | null {
  const items: AutocompleteItem[] = [
    { value: "config", label: "config", description: "Open the settings editor" },
    { value: "status", label: "status", description: "Show current settings" },
  ];
  const filtered = items.filter((item) => item.value.startsWith(prefix));
  return filtered.length > 0 ? filtered : null;
}

/** One-line-per-visible-setting summary for `/minimalist status`. */
export function summary(settings: Settings): string {
  const rows = visibleFields(settings).map(({ key, label }) => ({ key, label: indent(key, label) }));
  const width = Math.max(...rows.map((row) => row.label.length));
  return [
    ...rows.flatMap(({ key, label }, index) => {
      const dimmed = settings.preset !== "custom" && isLook(key) ? " (from preset)" : "";
      const line = `  ${label.padEnd(width)}  ${displayValue(key, settings[key])}${dimmed}`;
      return index > 0 && SECTION_STARTS.has(key) ? ["", line] : [line];
    }),
    "",
    "  /minimalist          change these",
    `  Excluded tools       ${excludedSummary(settings.excludeTools)}`,
    "  settings.json        custom glyphs and colours",
  ].join("\n");
}
