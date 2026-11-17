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
  /** This row starts a new section: a blank line and this title are drawn above it. */
  section?: string;
};

/**
 * Label and hover description for every basic setting, in display order.
 *
 * A sub-setting (one with an entry in `PARENTS`) is drawn under its parent
 * with tree guides and shown only while its parent is on.
 */
export const FIELDS: Field[] = [
  {
    key: "preset",
    label: "Preset",
    description: "off = native Pi, lite = one-line tool rows, full = + merged rows and thinking rows, max = + only the final reply. custom uses your own values. A preset only sets the three Shrink rows, Merge consecutive rows and Show only the final reply; your other settings are kept.",
  },
  {
    key: "glyphStyle",
    label: "Symbol set",
    description: "Use ordinary Unicode symbols, or switch to ASCII if some symbols are missing or misaligned. A Nerd Font is not required.",
    section: "Appearance",
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
    label: "Shrink output blocks to one line",
    description: "Draw tool calls and thinking as one-line rows. Off restores Pi's native blocks; the choices below are kept for later.",
    section: "One-line rows",
  },
  {
    key: "compactToolRows",
    label: "Shrink tool call output",
    description: "Show each tool call as one line instead of Pi's full card. Ctrl+O still shows the output.",
  },
  {
    key: "keepActiveToolsExpanded",
    label: "Expand ongoing tool call",
    description: "Expand a running tool call like Ctrl+O, so its output shows as it arrives. 'no' keeps it as one line: merged with the rows around it, or on its own row so you can watch it.",
  },
  {
    key: "toolLingerSeconds",
    label: "Keep it after it ends",
    description: "How long a finished tool call keeps that view (own row or expanded) before it merges or collapses. 0 = right away.",
  },
  {
    key: "thinkingAsToolCall",
    label: "Shrink thinking output",
    description: "Show thinking as one line instead of Pi's thinking block. Off restores Pi's native thinking.",
  },
  {
    key: "keepActiveThinkingExpanded",
    label: "Expand ongoing thinking",
    description: "Show the full thinking as it arrives, instead of one line.",
  },
  {
    key: "thinkingLingerSeconds",
    label: "Keep it after it ends",
    description: "How long thinking stays expanded after it is generated, so a short thought can be read. 0 = collapse right away.",
  },
  {
    key: "groupToolRuns",
    label: "Merge consecutive rows into one",
    description: "Replace consecutive finished rows with a single count, e.g. 'read ×2, edit ×1'.",
    section: "Merging rows",
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

/** Section title by the id of the row that starts it. */
const SECTIONS = new Map(FIELDS.flatMap((field) => (field.section ? [[field.key as string, field.section]] : [])));

const EXCLUDE_ID = "excludeTools";

/** How many parents a row has, i.e. how deep it sits in the tree. */
function depth(id: string): number {
  // The tool picker row is a child of "Shrink tool call output".
  if (id === EXCLUDE_ID) return depth("compactToolRows") + 1;
  let level = 0;
  for (let parent = PARENTS[id as BasicKey]; parent; parent = PARENTS[parent]) level++;
  return level;
}

type GuideStyle = { pipe: string; tee: string; last: string; rule: string };
export const GUIDES: Record<"unicode" | "ascii", GuideStyle> = {
  unicode: { pipe: "│  ", tee: "├─ ", last: "└─ ", rule: "─" },
  ascii: { pipe: "|  ", tee: "|- ", last: "`- ", rule: "-" },
};
/** A label's guide prefix: only guide characters and spaces, as every setting name starts with a letter. */
const GUIDE_PREFIX = /^[│├└─|`\- ]*/;
const guideStyle = (glyphStyle: string) => GUIDES[glyphStyle === "ascii" ? "ascii" : "unicode"];

/** Lines drawn above each section: a blank line and the title. */
const TITLE_LINES = 2;
/** Fixed cap, so the title rule does not span very wide terminals. */
const TITLE_WIDTH = 64;

/**
 * Tree guides for rows in display order, from their depths alone.
 *
 * A row gets `├─` when a sibling follows before the tree climbs above it, else
 * `└─`; each ancestor level gets `│` while that ancestor still has a sibling to
 * come, else blank. Depth-0 rows are roots and get no guide.
 */
export function treeGuides(depths: number[], style: GuideStyle): string[] {
  /** True when a row at `level` follows `index` before any shallower row. */
  const continues = (index: number, level: number) => {
    for (let next = index + 1; next < depths.length; next++) {
      if (depths[next] < level) return false;
      if (depths[next] === level) return true;
    }
    return false;
  };
  return depths.map((level, index) => {
    if (level === 0) return "";
    let guide = "";
    for (let ancestor = 1; ancestor < level; ancestor++) guide += continues(index, ancestor) ? style.pipe : "   ";
    return guide + (continues(index, level) ? style.tee : style.last);
  });
}

/** Prefix each label with its tree guide. */
function withGuides<T extends { id: string; label: string }>(rows: T[], style: GuideStyle): T[] {
  const guides = treeGuides(rows.map((row) => depth(row.id)), style);
  return rows.map((row, index) => ({ ...row, label: guides[index] + row.label }));
}

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

/**
 * Conditional rows plus their display values, without tree guides (the screen
 * adds them once the picker row is in place). `dim` greys the look rows a preset owns.
 */
export function items(settings: Settings, dim?: (text: string) => string): SettingItem[] {
  return visibleFields(settings).map(
    ({ key, label, description }) => {
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

const PICKER_ROWS = 12;

/** "none", the names when there are one or two, else a count. */
export function excludedSummary(names: string[]): string {
  if (names.length === 0) return "none";
  return names.length <= 2 ? names.join(", ") : `${names.length} tools`;
}

/**
 * One row per tool; Enter flips it between `one line` and `own card`. It reuses
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
    currentValue: excluded.includes(name) ? "own card" : "one line",
    values: ["one line", "own card"],
  }));
  return new SettingsList(
    rows,
    Math.min(PICKER_ROWS, Math.max(rows.length, 1)),
    theme,
    (name, value) => {
      excluded = value === "own card" ? [...excluded, name] : excluded.filter((n) => n !== name);
      onExcludeChange(excluded);
    },
    () => done(excludedSummary(excluded)),
    { enableSearch: true },
  );
}

/** Build a live screen; every change rebuilds the list, so sub-settings appear or disappear at once. */
export function createConfigScreen(deps: ConfigScreenDeps): InputComponent {
  const { SettingsList, config, onChange, onClose } = deps;
  // Tree guides are drawn in the hint colour and the setting name in the
  // label colour. They cannot share one coloured string: the guide's colour
  // reset would also end the selected row's highlight.
  const theme: SettingsListTheme = {
    ...deps.theme,
    label: (text, selected) => {
      const guide = text.match(GUIDE_PREFIX)?.[0] ?? "";
      return (guide ? deps.theme.hint(guide) : "") + deps.theme.label(text.slice(guide.length), selected);
    },
  };
  let list: SettingsList;
  let rows: SettingItem[] = [];
  let locked = false;
  // The section titles are drawn around the main list only, never around the picker.
  let pickerOpen = false;

  const excludeRow = (): SettingItem => ({
    id: EXCLUDE_ID,
    label: "Excluded tools",
    description: "Tools that keep their own card instead of one line, e.g. subagent. Enter to pick; type to search.",
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
    rows = withGuides(rows, guideStyle(config.get("glyphStyle")));
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

  /** Main-list line index of each row that starts a section, i.e. has a title above it. */
  const sections = () =>
    pickerOpen ? [] : rows.flatMap((row, index) => (index > 0 && SECTIONS.has(row.id) ? [index] : []));

  list = build();
  return {
    render: (width) => {
      const lines = list.render(width);
      const { rule } = guideStyle(config.get("glyphStyle"));
      for (const index of sections().reverse()) {
        lines.splice(index, 0, "", sectionTitle(SECTIONS.get(rows[index].id)!, rule, width, theme.hint));
      }
      return [...lines, truncateToWidth(theme.hint("  Changes apply live · Ctrl+O reveals tool output"), width)];
    },
    handleInput: (data) => list.handleInput(data),
    handleMouse: (event) => {
      // Each section adds two lines of ours (blank + title): move `y` back to the
      // line SettingsList drew, and ignore clicks on our own lines.
      let y = event.y;
      for (const [count, index] of sections().entries()) {
        const top = index + count * TITLE_LINES;
        if (event.y >= top && event.y < top + TITLE_LINES) return undefined;
        if (event.y >= top + TITLE_LINES) y -= TITLE_LINES;
      }
      return list.handleMouse?.({ ...event, y });
    },
    invalidate: () => list.invalidate?.(),
  };
}

/** `── Appearance ─────`, indented like the labels, in the hint colour. */
function sectionTitle(name: string, rule: string, width: number, paint: (text: string) => string): string {
  const head = `${rule}${rule} ${name} `;
  const length = Math.max(head.length, Math.min(width - 2, TITLE_WIDTH));
  return truncateToWidth(`  ${paint(head + rule.repeat(length - head.length))}`, width);
}

function isBasicKey(id: string): id is BasicKey {
  return (BASIC_KEYS as string[]).includes(id);
}

const LINGER_CHOICES: [BasicValue, string][] = LINGER_SECONDS.map((seconds) => [seconds, `${seconds}s`]);

/** Stored value and shown text of every non-boolean choice; booleans are on/off. */
const CHOICE_TEXT: Partial<Record<BasicKey, [BasicValue, string][]>> = {
  preset: PRESET_NAMES.map((name) => [name, presetLabel(name)]),
  glyphStyle: [["unicode", "Unicode"], ["ascii", "ASCII"]],
  keepActiveToolsExpanded: [[false, "no, merge with others"], [true, "no, keep on its own row"], ["expanded", "yes, like Ctrl+O"]],
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

/** One-line-per-visible-setting summary for `/minimalist status`, laid out like the screen. */
export function summary(settings: Settings): string {
  const style = guideStyle(settings.glyphStyle);
  const rows = withGuides(visibleFields(settings).map(({ key, label }) => ({ id: key, label })), style);
  const width = Math.max(...rows.map((row) => row.label.length));
  const rule = style.rule;
  return [
    ...rows.flatMap(({ id: key, label }, index) => {
      const dimmed = settings.preset !== "custom" && isLook(key) ? " (from preset)" : "";
      const line = `  ${label.padEnd(width)}  ${displayValue(key, settings[key])}${dimmed}`;
      const title = SECTIONS.get(key);
      return index > 0 && title ? ["", `  ${rule}${rule} ${title}`, line] : [line];
    }),
    "",
    "  /minimalist          change these",
    `  Excluded tools       ${excludedSummary(settings.excludeTools)}`,
    "  settings.json        custom glyphs and colours",
  ].join("\n");
}
