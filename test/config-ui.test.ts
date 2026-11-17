import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SettingsList, visibleWidth } from "@earendil-works/pi-tui";
import { BASIC_KEYS, Config, DEFAULTS } from "../src/config.ts";
import { FIELDS, GUIDES, argumentCompletions, createConfigScreen, items, summary, treeGuides } from "../src/config-ui.ts";

type Item = {
  id: string;
  label: string;
  description?: string;
  currentValue: string;
  values?: string[];
  submenu?: (current: string, done: (selected?: string) => void) => { render(w: number): string[] };
};

/**
 * Minimal stand-in for pi-tui's SettingsList, capturing what it was handed.
 *
 * Fields are assigned in the body, not declared as constructor parameter
 * properties: Node's type-stripping runs the TypeScript directly and rejects
 * that syntax (`ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX`).
 */
class FakeSettingsList {
  static last: FakeSettingsList | undefined;
  items: Item[];
  maxVisible: number;
  theme: unknown;
  onChange: (id: string, value: string) => void;
  onCancel: () => void;
  options: unknown;

  constructor(
    items: Item[],
    maxVisible: number,
    theme: unknown,
    onChange: (id: string, value: string) => void,
    onCancel: () => void,
    options?: unknown,
  ) {
    this.items = items;
    this.maxVisible = maxVisible;
    this.theme = theme;
    this.onChange = onChange;
    this.onCancel = onCancel;
    this.options = options;
    FakeSettingsList.last = this;
  }
  render(): string[] {
    return [];
  }
  invalidate(): void {}
  handleInput(): void {}
  selectItem(): void {}
}

function screen(config: Config, onChange = (_k: string, _v: unknown) => {}, onClose = () => {}) {
  createConfigScreen({
    SettingsList: FakeSettingsList as never,
    theme: { hint: (text: string) => text } as never,
    config,
    onChange: onChange as never,
    toolNames: () => [],
    onExcludeChange: () => {},
    onClose,
  });
  const list = FakeSettingsList.last;
  assert.ok(list, "SettingsList must be constructed");
  return list;
}

describe("config screen contents", () => {
  it("exposes exactly the command-editable keys", () => {
    // The advanced keys (glyphs, tokens, excludeTools) must stay
    // JSON-only: they need exact tool names or Pi palette knowledge, and a
    // chooser would imply they are casual choices.
    assert.deepEqual(
      FIELDS.map((field) => field.key).sort(),
      [...BASIC_KEYS].sort(),
    );
  });

  it("gives every setting a label and a hover description", () => {
    for (const field of FIELDS) {
      assert.ok(field.label.length > 0, field.key);
      // The description is the whole reason this is a screen and not a flag.
      assert.ok(field.description.length > 20, `${field.key} needs a real explanation`);
      assert.ok(!field.description.includes("_"), `${field.key} must read as prose, not a key name`);
    }
  });

  it("renders booleans as on/off rather than true/false", () => {
    const rendered = items({ ...DEFAULTS, groupToolRuns: true, timer: false });
    const byId = new Map(rendered.map((item) => [item.id, item]));
    assert.equal(byId.get("groupToolRuns")?.currentValue, "on");
    assert.equal(byId.get("timer")?.currentValue, "off");
    for (const item of rendered.filter((item) => !["preset", "activitySummary", "glyphStyle", "keepActiveToolsExpanded", "toolLingerSeconds"].includes(item.id))) {
      assert.deepEqual(item.values, ["on", "off"]);
    }
  });

  it("offers Unicode and ASCII while keeping custom glyph overrides", () => {
    const config = new Config({ ...DEFAULTS, glyphs: { done: "OK" } });
    const symbols = items(config.all()).find((item) => item.id === "glyphStyle");
    assert.deepEqual(symbols?.values, ["Unicode", "ASCII"]);
    assert.equal(symbols?.currentValue, "Unicode");
    screen(config).onChange("glyphStyle", "ASCII");
    assert.equal(config.get("glyphStyle"), "ascii");
    assert.equal(config.glyphs().done, "OK");
    assert.equal(config.glyphs().failed, "x");
    screen(config).onChange("glyphStyle", "Unicode");
    assert.equal(config.get("glyphStyle"), "unicode");
  });

  it("draws tree guides from row depths alone", () => {
    assert.deepEqual(treeGuides([0, 1, 2, 2, 3, 1, 2, 0, 1], GUIDES.unicode), [
      "", "├─ ", "│  ├─ ", "│  └─ ", "│     └─ ", "└─ ", "   └─ ", "", "└─ ",
    ]);
  });

  it("puts the guides in front of the labels, Excluded tools included", () => {
    const labels = new Map(
      screen(new Config({ ...DEFAULTS, thinkingAsToolCall: true, keepActiveToolsExpanded: true })).items.map((item) => [item.id, item.label]),
    );
    assert.equal(labels.get("compactRows"), "Shrink output blocks to one line");
    assert.equal(labels.get("compactToolRows"), "├─ Shrink tool call output");
    assert.equal(labels.get("excludeTools"), "│  ├─ Excluded tools");
    assert.equal(labels.get("keepActiveToolsExpanded"), "│  └─ Expand ongoing tool call");
    assert.equal(labels.get("toolLingerSeconds"), "│     └─ Keep it after it ends");
    assert.equal(labels.get("thinkingAsToolCall"), "└─ Shrink thinking output");
    assert.equal(labels.get("keepActiveThinkingExpanded"), "   └─ Expand ongoing thinking");

    // A hidden row changes the guides around it: with no linger row below it,
    // the running-tool row no longer draws a branch for it.
    const merged = new Map(
      screen(new Config({ ...DEFAULTS, keepActiveToolsExpanded: false })).items.map((item) => [item.id, item.label]),
    );
    assert.equal(merged.has("toolLingerSeconds"), false);
    assert.equal(merged.get("keepActiveToolsExpanded"), "│  └─ Expand ongoing tool call");
    assert.equal(merged.get("thinkingAsToolCall"), "└─ Shrink thinking output");
    const toolsOff = screen(new Config({ ...DEFAULTS, compactToolRows: false })).items;
    assert.equal(toolsOff.some((item) => item.id === "excludeTools"), false);

    const ascii = new Map(screen(new Config({ ...DEFAULTS, glyphStyle: "ascii" })).items.map((item) => [item.id, item.label]));
    assert.equal(ascii.get("compactToolRows"), "|- Shrink tool call output");
    assert.equal(ascii.get("keepActiveToolsExpanded"), "|  `- Expand ongoing tool call");
  });

  it("keeps every label, guide included, within SettingsList's 36-column label column", () => {
    const all = screen(new Config({
      ...DEFAULTS, keepActiveToolsExpanded: true, thinkingAsToolCall: true, keepActiveThinkingExpanded: true, foldIntermediateActivity: true,
    })).items;
    assert.equal(all.length, FIELDS.length + 1, "every row is visible, Excluded tools included");
    for (const item of all) assert.ok(visibleWidth(item.label) <= 36, `${item.label}: ${visibleWidth(item.label)}`);
  });

  it("paints the guide in the hint colour and only the name in the label colour", () => {
    createConfigScreen({
      SettingsList: FakeSettingsList as never,
      theme: { hint: (t: string) => `<h>${t}</h>`, label: (t: string, selected: boolean) => (selected ? `<S>${t}</S>` : `<l>${t}</l>`) } as never,
      config: new Config(DEFAULTS),
      onChange: () => {},
      toolNames: () => [],
      onExcludeChange: () => {},
      onClose: () => {},
    });
    const theme = FakeSettingsList.last!.theme as { label(t: string, s: boolean): string };
    assert.equal(theme.label("│  ├─ Excluded tools   ", true), "<h>│  ├─ </h><S>Excluded tools   </S>");
    assert.equal(theme.label("Symbol set", false), "<l>Symbol set</l>");
  });

  it("shows a sub-setting only while every parent above it is on", () => {
    const ids = (settings: typeof DEFAULTS) => items(new Config(settings).all()).map((item) => item.id);
    assert.equal(ids(DEFAULTS).includes("activitySummary"), false);
    const rendered = items({ ...DEFAULTS, foldIntermediateActivity: true, activitySummary: "tools" });
    const byId = new Map(rendered.map((item) => [item.id, item]));
    assert.equal(byId.get("activitySummary")?.currentValue, "tools used");
    assert.deepEqual(byId.get("activitySummary")?.values, ["elapsed time", "tools used"]);

    const off = ids({ ...DEFAULTS, compactRows: false });
    for (const id of ["compactToolRows", "keepActiveToolsExpanded", "thinkingAsToolCall", "keepActiveThinkingExpanded"]) {
      assert.equal(off.includes(id), false, id);
    }
    assert.equal(ids({ ...DEFAULTS, compactToolRows: false }).includes("keepActiveToolsExpanded"), false);
    // A grandchild stays hidden when only the grandparent is off.
    assert.equal(ids({ ...DEFAULTS, groupToolRuns: false, foldIntermediateActivity: true }).includes("activitySummary"), false);
  });

  it("orders the rows in sections: preset, appearance, one-line rows, merging", () => {
    const ids = items({ ...DEFAULTS, keepActiveToolsExpanded: true, thinkingAsToolCall: true, keepActiveThinkingExpanded: true, foldIntermediateActivity: true }).map((item) => item.id);
    assert.deepEqual(ids, [
      "preset",
      "glyphStyle", "gutter", "timer",
      "compactRows",
      "compactToolRows", "keepActiveToolsExpanded", "toolLingerSeconds",
      "thinkingAsToolCall", "keepActiveThinkingExpanded", "thinkingLingerSeconds",
      "groupToolRuns", "foldIntermediateActivity", "foldEarlierTurnsOnly", "activitySummary",
    ]);
  });

  it("draws a blank line and a title above each section, and maps clicks past them", () => {
    const lines = Array.from({ length: 30 }, (_, i) => `line ${i}`);
    const seen: number[] = [];
    class Drawing extends FakeSettingsList {
      render(): string[] {
        return lines.slice(0, this.items.length);
      }
      handleMouse(event: { y: number }) {
        seen.push(event.y);
        return { handled: true };
      }
    }
    const component = createConfigScreen({
      SettingsList: Drawing as never,
      theme: { hint: (text: string) => text, label: (text: string) => text } as never,
      config: new Config(DEFAULTS),
      onChange: () => {},
      toolNames: () => [],
      onExcludeChange: () => {},
      onClose: () => {},
    });
    const ids = FakeSettingsList.last!.items.map((item) => item.id);
    const drawn = component.render(40);
    // preset | blank | title | 3 appearance rows | blank | title | one-line rows ...
    assert.deepEqual(drawn.slice(0, 7), ["line 0", "", "  ── Appearance ────────────────────────", "line 1", "line 2", "line 3", ""]);
    assert.equal(drawn[7], "  ── One-line rows ─────────────────────");
    assert.equal(drawn[8], `line ${ids.indexOf("compactRows")}`);
    const event = { y: 0, x: 0, type: "click", button: "left" };
    for (const y of [1, 2, 6, 7]) assert.equal(component.handleMouse!({ ...event, y } as never), undefined, `line ${y} is not a row`);
    component.handleMouse!({ ...event, y: 8 } as never);
    assert.deepEqual(seen, [ids.indexOf("compactRows")]);
  });

  it("lines the titles up with pi-tui's real SettingsList, clicks included", () => {
    // The titles assume SettingsList draws item i on line i (no search, no scroll).
    const theme = { label: (t: string) => t, value: (t: string) => t, description: (t: string) => t, cursor: "> ", hint: (t: string) => t };
    const config = new Config(DEFAULTS);
    const component = createConfigScreen({
      SettingsList, theme, config, onChange: () => {}, toolNames: () => [], onExcludeChange: () => {}, onClose: () => {},
    });
    const lines = component.render(100);
    const at = (label: string) => lines.findIndex((line) => line.includes(label));
    assert.match(lines[at("Symbol set") - 1], /── Appearance ─/);
    assert.equal(lines[at("Symbol set") - 2], "");
    assert.match(lines[at("Shrink output blocks to one line") - 1], /── One-line rows ─/);
    assert.match(lines[at("Merge consecutive rows into one") - 1], /── Merging rows ─/);

    const click = (y: number) => {
      component.handleMouse!({ x: 4, y, type: "press", button: "left" } as never);
      component.handleMouse!({ x: 4, y, type: "release", button: "left" } as never);
      component.handleMouse!({ x: 4, y, type: "click", button: "left" } as never);
    };
    click(at("Show running time on tool calls"));
    assert.equal(config.get("timer"), false, "a click lands on the row drawn there");
  });

  it("hides Excluded tools while compact tool calls are off, and ignores unknown values", () => {
    screen(new Config({ ...DEFAULTS, compactToolRows: false }));
    assert.equal(FakeSettingsList.last!.items.some((item) => item.id === "excludeTools"), false);

    const config = new Config({ ...DEFAULTS, preset: "full" });
    const changes: unknown[] = [];
    screen(config, (k, v) => changes.push([k, v])).onChange("preset", "nonsense");
    assert.deepEqual(changes, [], "a text we never offered writes nothing");
    assert.equal(config.all().preset, "full");
  });

  it("offers the three running-tool views and the linger seconds", () => {
    const byId = new Map(items({ ...DEFAULTS, keepActiveToolsExpanded: "expanded", thinkingAsToolCall: true, keepActiveThinkingExpanded: true }).map((item) => [item.id, item]));
    assert.deepEqual(byId.get("keepActiveToolsExpanded")?.values, ["no, merge with others", "no, keep on its own row", "yes, like Ctrl+O"]);
    assert.equal(byId.get("keepActiveToolsExpanded")?.currentValue, "yes, like Ctrl+O");
    assert.deepEqual(byId.get("toolLingerSeconds")?.values, ["0s", "1s", "2s", "3s", "5s", "10s"]);
    assert.equal(byId.get("thinkingLingerSeconds")?.currentValue, "3s");
    assert.equal(items({ ...DEFAULTS, keepActiveToolsExpanded: true, toolLingerSeconds: 7 }).find((item) => item.id === "toolLingerSeconds")?.currentValue, "7s");
    assert.equal(items({ ...DEFAULTS, keepActiveToolsExpanded: false }).some((item) => item.id === "toolLingerSeconds"), false);

    const changes: [string, unknown][] = [];
    const list = screen(new Config(DEFAULTS), (key, value) => changes.push([key, value]));
    list.onChange("keepActiveToolsExpanded", "yes, like Ctrl+O");
    list.onChange("toolLingerSeconds", "10s");
    assert.deepEqual(changes, [["keepActiveToolsExpanded", "expanded"], ["toolLingerSeconds", 10]]);
  });

  it("shows every visible row without scrolling", () => {
    const list = screen(new Config(DEFAULTS));
    assert.equal(list.maxVisible, list.items.length);
  });

  it("shows a live-change and output hint under the settings list", () => {
    const component = createConfigScreen({
      SettingsList: FakeSettingsList as never,
      theme: { hint: (text: string) => text } as never,
      config: new Config(DEFAULTS),
      onChange: () => {},
      toolNames: () => [],
      onExcludeChange: () => {},
      onClose: () => {},
    });
    assert.match(component.render(80).at(-1)!, /Changes apply live · Ctrl\+O reveals tool output/);
    assert.ok(visibleWidth(component.render(20).at(-1)!) <= 20);
  });
});

describe("presets in the config screen", () => {
  it("puts the Preset row first and cycles all five presets", () => {
    const first = items(DEFAULTS)[0];
    assert.equal(first.id, "preset");
    assert.equal(first.currentValue, "custom (editable)");
    assert.deepEqual(first.values, ["off", "lite", "full", "max", "custom (editable)"]);
  });

  it("stores the preset named 'custom' when 'custom (editable)' is picked", () => {
    const config = new Config({ ...DEFAULTS, preset: "lite" });
    const changes: [string, unknown][] = [];
    screen(config, (k, v) => changes.push([k, v])).onChange("preset", "custom (editable)");
    assert.deepEqual(changes, [["preset", "custom"]]);
    assert.equal(config.all().preset, "custom");
  });

  it("dims the label AND the value of a locked row, and only of a locked row", () => {
    const dim = (text: string) => `<d>${text}</d>`;
    const locked = items({ ...DEFAULTS, preset: "lite" }, dim);
    const group = locked.find((row) => row.id === "groupToolRuns")!;
    assert.match(group.label, /^<d>.*<\/d>$/);
    assert.match(group.currentValue, /^<d>.*<\/d>$/);
    const timer = locked.find((row) => row.id === "timer")!;
    assert.equal(timer.label.includes("<d>"), false, "an editable row keeps its normal colours");
    assert.equal(timer.currentValue.includes("<d>"), false);
    const open = items({ ...DEFAULTS, preset: "custom" });
    assert.equal(open.some((row) => row.label.includes("<d>")), false, "nothing is dimmed under custom");
  });

  it("switching preset keeps the user's own keys and shows the preset's look keys", () => {
    const config = new Config({ ...DEFAULTS, groupToolRuns: true, gutter: false });
    const changes: [string, unknown][] = [];
    screen(config, (k, v) => changes.push([k, v])).onChange("preset", "lite");
    assert.deepEqual(changes, [["preset", "lite"]]);
    assert.equal(config.get("groupToolRuns"), false);
    assert.equal(config.get("gutter"), false, "not a look key: the user's value stays");
    screen(config).onChange("preset", "custom (editable)");
    assert.equal(config.get("groupToolRuns"), true);
  });

  it("greys only the look rows under a preset: activating one changes nothing", () => {
    const config = new Config({ ...DEFAULTS, preset: "lite", groupToolRuns: true, timer: false });
    const changes: unknown[] = [];
    const list = screen(config, (k, v) => changes.push([k, v]));
    const group = list.items.find((item) => item.id === "groupToolRuns")!;
    assert.deepEqual(group.values, [group.currentValue]);
    assert.match(group.description ?? "", /Set by the 'lite' preset.*custom/);
    list.onChange("groupToolRuns", group.currentValue);
    assert.deepEqual(changes, []);
    assert.equal(config.get("groupToolRuns"), false);
    for (const id of ["timer", "gutter", "glyphStyle", "keepActiveToolsExpanded"]) {
      assert.ok(list.items.find((item) => item.id === id)!.values!.length > 1, id);
    }
    list.onChange("timer", "on");
    assert.deepEqual(changes, [["timer", true]]);
  });

  it("shows the generic footer, with no Restore defaults row", () => {
    const component = createConfigScreen({
      SettingsList: FakeSettingsList as never,
      theme: { hint: (text: string) => text } as never,
      config: new Config({ ...DEFAULTS, preset: "full" }),
      onChange: () => {},
      toolNames: () => [],
      onExcludeChange: () => {},
      onClose: () => {},
    });
    assert.match(component.render(200).at(-1)!, /Changes apply live/);
    assert.equal(FakeSettingsList.last!.items.some((item) => /restore/i.test(item.label)), false);
  });

  it("status shows 'custom (editable)' for the custom preset", () => {
    assert.match(summary(new Config(DEFAULTS).all()), /Preset\s+custom \(editable\)/);
  });

  it("status marks preset-controlled rows", () => {
    const text = summary(new Config({ ...DEFAULTS, preset: "lite" }).all());
    assert.match(text, /Shrink output blocks to one line\s+on \(from preset\)/);
    assert.match(text, /├─ Shrink tool call output\s+on \(from preset\)/, "tree guides like on the screen");
    assert.match(text, /Show running time on tool calls\s+on\n/, "not a look row");
    assert.match(text, /lite\n\n  ── Appearance\n  Symbol set/, "section titles like on the screen");
  });
});

describe("config screen behaviour", () => {
  it("applies a change to the live config immediately", () => {
    // Applied at once so the transcript behind the overlay re-renders while the
    // user is still choosing — seeing the effect is the point of the screen.
    const config = new Config(DEFAULTS);
    const list = screen(config);
    assert.equal(config.get("gutter"), true);

    list.onChange("gutter", "off");
    assert.equal(config.get("gutter"), false);
  });

  it("reports boolean and summary changes to its caller", () => {
    const changes: [string, unknown][] = [];
    const list = screen(new Config({ ...DEFAULTS, foldIntermediateActivity: true }), (key, value) =>
      changes.push([key, value]),
    );

    list.onChange("groupToolRuns", "on");
    list.onChange("activitySummary", "tools used");
    assert.deepEqual(changes, [["groupToolRuns", true], ["activitySummary", "tools"]]);
  });

  it("adds dependent rows immediately when prose folding turns on", () => {
    const config = new Config(DEFAULTS);
    screen(config).onChange("foldIntermediateActivity", "on");
    assert.equal(config.get("foldIntermediateActivity"), true);
    assert.ok(FakeSettingsList.last?.items.some((item) => item.id === "activitySummary"));
  });

  it("ignores unknown ids instead of writing junk into settings", () => {
    const config = new Config(DEFAULTS);
    const before = config.all();
    screen(config).onChange("not-a-setting", "on");
    assert.deepEqual(config.all(), before);
  });

  it("closes through the cancel callback", () => {
    let closed = false;
    screen(new Config(DEFAULTS), undefined, () => {
      closed = true;
    }).onCancel();
    assert.equal(closed, true);
  });
});

describe("summary", () => {
  it("lists every visible setting with its state and where to find the rest", () => {
    const text = summary({ ...DEFAULTS, groupToolRuns: true });
    const hidden = ["toolLingerSeconds", "keepActiveThinkingExpanded", "thinkingLingerSeconds", "foldEarlierTurnsOnly", "activitySummary"];
    for (const field of FIELDS.filter((field) => !hidden.includes(field.key))) {
      assert.ok(text.includes(field.label), field.key);
    }
    assert.ok(!text.includes("Summary of the hidden part"), "a hidden sub-setting is not listed");
    assert.match(text, /Merge consecutive rows into one\s+on/);
    assert.match(text, /Show running time on tool calls\s+on/);
    assert.match(text, /Symbol set\s+Unicode/);
    // `/minimalist status` should point at both the editor and the JSON-only keys.
    assert.ok(text.includes("/minimalist          change these"));
    assert.ok(text.includes("settings.json"));
  });
});

describe("argumentCompletions", () => {
  it("suggests `config` and `status`, filtered by prefix", () => {
    const empty = argumentCompletions("");
    assert.deepEqual(empty?.map(({ value }) => value), ["config", "status"]);
    assert.ok(empty?.every((item) => item.description), "the suggestion menu shows descriptions");

    assert.deepEqual(argumentCompletions("con")?.map(({ value }) => value), ["config"]);
    assert.deepEqual(argumentCompletions("sta")?.map(({ value }) => value), ["status"]);
    assert.equal(argumentCompletions("x"), null, "no match means no menu");
  });
});

describe("excluded tools picker", () => {
  function open(excludeTools: string[], tools: string[]) {
    const excluded: string[][] = [];
    const config = new Config({ ...DEFAULTS, excludeTools });
    createConfigScreen({
      SettingsList: FakeSettingsList as never,
      theme: { hint: (text: string) => text } as never,
      config,
      onChange: () => {},
      toolNames: () => tools,
      onExcludeChange: (names) => excluded.push(names),
      onClose: () => {},
    });
    const main = FakeSettingsList.last!;
    const row = main.items.find((item) => item.id === "excludeTools")!;
    const closed: (string | undefined)[] = [];
    row.submenu!(row.currentValue, (selected) => closed.push(selected));
    return { main, row, picker: FakeSettingsList.last!, excluded, closed };
  }

  it("adds an 'Excluded tools' row that shows its current value", () => {
    assert.equal(open([], ["read"]).row.currentValue, "none");
    assert.equal(open(["subagent"], []).row.currentValue, "subagent");
    assert.equal(open(["a", "b", "c"], []).row.currentValue, "3 tools");
  });

  it("lists every known tool, sorted, with a search box and the current state", () => {
    const { picker } = open(["web_search"], ["web_search", "read", "bash"]);
    assert.deepEqual(picker.items.map((i) => [i.id, i.currentValue]), [
      ["bash", "one line"],
      ["read", "one line"],
      ["web_search", "own card"],
    ]);
    assert.deepEqual(picker.options, { enableSearch: true });
  });

  it("keeps an excluded name that no loaded tool carries", () => {
    const { picker } = open(["gone"], ["read"]);
    const gone = picker.items.find((i) => i.id === "gone")!;
    assert.equal(gone.currentValue, "own card");
    assert.match(gone.description!, /Not loaded/);
  });

  it("reports the full new list on every toggle", () => {
    const { picker, excluded } = open(["a"], ["a", "b"]);
    picker.onChange("b", "own card");
    picker.onChange("a", "one line");
    assert.deepEqual(excluded, [["a", "b"], ["b"]]);
  });

  it("closes with the new summary on Escape", () => {
    const { picker, closed } = open([], ["a"]);
    picker.onChange("a", "own card");
    picker.onCancel();
    assert.deepEqual(closed, ["a"]);
  });
});
