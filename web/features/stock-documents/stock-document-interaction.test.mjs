import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { setImmediate } from "node:timers/promises";
import { test } from "node:test";
import ts from "typescript";
import * as rules from "./stock-document.logic.ts";
import * as linesRules from "./stock-document-lines.logic.ts";
import * as inventoryRules from "../inventory/inventory.logic.ts";

// Run the real event handlers with delayed requests, without a browser or another test dependency.
function fixture(kind, roles = ["ADMIN"], headerPatch = {}) {
  let active;
  const lock = rules.createStockDocumentLock(() => {});
  const calls = [];
  let complete, fail;
  const pending = new Promise((resolve, reject) => { complete = resolve; fail = reject; });
  const request = async (path, options) => {
    // Panel reloads are GETs; only mutations are counted.
    if (!options?.method) return { data: { count: header, transfer: header, items: [line] } };
    calls.push({ path, options });
    await pending;
    return { data: {} };
  };
  class ApiError extends Error {
    constructor(message, status) { super(message); this.status = status; }
  }
  const react = {
    startTransition(fn) { fn(); },
    useState(initial) {
      const owner = active, index = owner.index++;
      if (!(index in owner.state)) owner.state[index] = typeof initial === "function" ? initial() : initial;
      return [owner.state[index], (value) => {
        owner.state[index] = typeof value === "function" ? value(owner.state[index]) : value;
      }];
    },
    useRef(initial) {
      const index = active.refIndex++;
      return active.refs[index] ??= { current: initial };
    },
    useEffect(effect, deps) {
      active.effects.push({ effect, deps });
      if (deps.length === 1 && deps[0] === lock && !active.cleanup)
        active.cleanup = effect();
    },
  };
  const jsx = (type, props) => ({ type, props: props ?? {} });
  function load(path, extra = "") {
    const source = readFileSync(new URL(path, import.meta.url), "utf8") + extra;
    const { outputText } = ts.transpileModule(source, { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
    } });
    const loaded = { exports: {} };
    const require = (name) => {
      if (name === "react") return react;
      if (name === "react/jsx-runtime") return { jsx, jsxs: jsx, Fragment: "Fragment" };
      if (name.endsWith("stock-document-lines.logic")) return linesRules;
      if (name.endsWith("stock-document.logic")) return rules;
      if (name === "@/features/stock-documents") return {
        ...rules, useStockDocumentLock: () => lock,
        // The selected document lives in the URL; a state slot stands in for it here.
        useStockDocumentQuery: () => react.useState(null),
        StockDocumentLines: "StockDocumentLines", StockDocumentReview: "StockDocumentReview",
      };
      if (name.includes("features/auth")) return {
        useAuthenticatedRequest: () => request,
        useAuthContext: () => ({ selectedFarmId: "farm" }),
        useFarmMembership: () => ({ membership: { roles, memberId: "creator" } }),
      };
      if (name === "@/shared/api/client") return { ApiError };
      if (name === "@/features/inventory") return {
        ...inventoryRules, WarehouseLotSelect: "WarehouseLotSelect",
      };
      return new Proxy({}, { get: (_, key) => key });
    };
    new Function("require", "module", "exports", "window", outputText)(
      require, loaded, loaded.exports, { confirm: () => true },
    );
    return loaded.exports;
  }
  function render(component, props, state = []) {
    const owner = { state, refs: [], effects: [], index: 0, refIndex: 0 };
    return {
      state,
      props,
      tree() { active = owner; owner.index = 0; owner.refIndex = 0; owner.effects = []; return component(props); },
      /** Runs the effect that depends on `value`, as React would after it changes. */
      async run(value) {
        this.tree();
        owner.effects.find(({ deps }) => deps.includes(value)).effect();
        await setImmediate();
      },
      unmount() { owner.cleanup?.(); },
    };
  }
  const counts = kind === "counts";
  const name = counts ? "FarmCountsScreen" : "FarmTransfersScreen";
  const Screen = load(`../${kind}/components/${kind}-screen.tsx`, `\nexport { ${name} };`)[name];
  const line = {
    id: "line", itemId: "item", itemCode: "A", itemName: "Material", trackingMode: "QUANTITY",
    lotId: null, quantity: "1", actualQuantity: "1", systemQuantity: "10", difference: "-9", note: null,
  };
  const header = {
    id: "doc", countCode: "COUNT", transferCode: "TRANSFER", status: "DRAFT",
    createdByMemberId: "creator", warehouseId: "warehouse", note: null, ...headerPatch,
  };
  const screen = render(Screen, {}, [
    [header], [], [], "ALL", 1, 0, 1, 1, "farm", false, false, null, null, "doc",
  ]);
  const initial = screen.tree();
  const panel = render(load("./stock-document-lines.tsx").StockDocumentLines,
    nodes(initial).find((node) => node.type === "StockDocumentLines").props,
    [{ revision: 0, detail: { header, lines: [line] } }]);
  const review = render(load("./stock-document-review.tsx").StockDocumentReview, {
    ...nodes(initial).find((node) => node.type === "StockDocumentReview").props,
    canSubmit: true,
  });
  return { lock, calls, complete, fail, ApiError, screen, initial, panel, review };
}

function nodes(node) {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!node || typeof node !== "object") return [];
  return [node, ...nodes(node.props?.children)];
}
const button = (tree, label) => nodes(tree).find((node) => node.type === "Button" && node.props.children === label);

for (const kind of ["counts", "transfers"]) {
  test(`${kind}: editing and a slow save block confirm, cancel and submit, even through stale handlers`, async () => {
    const f = fixture(kind);
    const edit = button(f.panel.tree(), "Sửa nháp");
    edit.props.onClick();
    nodes(f.panel.tree()).find((node) => node.type === "Input").props.onChange({ target: { value: "8" } });
    button(f.initial, "Xác nhận").props.onClick();
    button(f.initial, "Hủy").props.onClick();
    await button(f.review.tree(), "Gửi duyệt").props.onClick();
    assert.equal(f.calls.length, 0);
    assert.equal(button(f.screen.tree(), "Xác nhận").props.disabled, true);
    button(f.panel.tree(), "Lưu thay đổi").props.onClick();
    button(f.initial, "Xác nhận").props.onClick();
    await button(f.review.tree(), "Gửi duyệt").props.onClick();
    button(f.panel.tree(), "Bỏ sửa").props.onClick();
    button(f.panel.tree(), "Đóng").props.onClick();
    assert.equal(f.lock.locked, true);
    assert.equal(f.screen.state[13], "doc");
    assert.equal(f.calls.length, 1);
    assert.equal(f.calls[0].options.method, "PATCH");
    assert.equal(f.calls[0].options.data.items[0][kind === "counts" ? "actualQuantity" : "quantity"], "8");
    f.complete();
    await setImmediate();
    assert.equal(f.screen.state[5], 1, "save triggers the existing reload");
    assert.equal(f.lock.locked, true, "the edit stays locked until the panel is refreshed");
    // The panel reloads in place (same key, new revision) rather than remounting.
    f.panel.props.revision = f.screen.state[5];
    await f.panel.run(f.panel.props.revision);
    assert.equal(f.panel.state[1], null, "the reload replaces the draft");
    assert.equal(f.lock.locked, false, "the reload ends the edit lock");
    assert.equal(button(f.panel.tree(), "Sửa nháp").props.disabled, false);
  });

  test(`${kind}: closing the panel while editing releases the lock`, () => {
    const f = fixture(kind);
    button(f.panel.tree(), "Sửa nháp").props.onClick();
    assert.equal(f.lock.locked, true);
    f.panel.unmount();
    assert.equal(f.lock.locked, false);
  });

  test(`${kind}: pending confirmation blocks editing and duplicate requests, then unlocks after failure`, async () => {
    const f = fixture(kind);
    const edit = button(f.panel.tree(), "Sửa nháp");
    button(f.initial, "Xác nhận").props.onClick();
    edit.props.onClick();
    button(f.initial, "Xác nhận").props.onClick();
    await button(f.review.tree(), "Gửi duyệt").props.onClick();
    assert.equal(f.calls.length, 1);
    assert.equal(f.panel.state[1], null);
    assert.equal(button(f.panel.tree(), "Sửa nháp").props.disabled, true);
    f.fail(new f.ApiError("Only active documents can be confirmed", 409));
    await setImmediate();
    assert.equal(f.lock.locked, false);
    assert.match(f.screen.state[12], /Only active/);
    assert.equal(f.screen.state[5], 1);
    edit.props.onClick();
    assert.equal(f.lock.locked, true);
    button(f.panel.tree(), "Bỏ sửa").props.onClick();
    assert.equal(f.lock.locked, false);
  });

  test(`${kind}: discarding edits blocks a stale save handler`, () => {
    const f = fixture(kind);
    button(f.panel.tree(), "Sửa nháp").props.onClick();
    const save = button(f.panel.tree(), "Lưu thay đổi");
    button(f.panel.tree(), "Bỏ sửa").props.onClick();
    save.props.onClick();
    assert.equal(f.calls.length, 0);
    assert.equal(f.lock.locked, false);
  });

  test(`${kind}: submitting blocks edits and releases the lock after auth, conflict and network errors`, async () => {
    for (const status of [401, 403, 409, null]) {
      const f = fixture(kind);
      button(f.review.tree(), "Gửi duyệt").props.onClick();
      button(f.panel.tree(), "Sửa nháp").props.onClick();
      button(f.initial, "Xác nhận").props.onClick();
      assert.equal(f.lock.locked, true);
      assert.equal(f.calls.length, 1);
      assert.match(f.calls[0].path, /\/submit$/);
      f.fail(status ? new f.ApiError("failed", status) : new Error("network"));
      await setImmediate();
      assert.equal(f.lock.locked, false);
      assert.ok(f.screen.state[12]);
      assert.equal(f.screen.state[5], status === 401 || status === 403 ? 0 : 1);
    }
  });
}

for (const kind of ["counts", "transfers"]) {
  test(`${kind}: an owner can clear a requested code while editing the draft`, () => {
    const f = fixture(kind, ["FARM_OWNER"], { requestedCode: "DUP-1", requestedCodeReason: "Giấy" });
    button(f.panel.tree(), "Sửa nháp").props.onClick();
    const fields = nodes(f.panel.tree()).find((node) => node.type === "NumberingOptionsFields");
    assert.deepEqual(fields.props.value, { externalReference: "", requestedCode: "DUP-1", requestedCodeReason: "Giấy" });
    fields.props.onChange({ ...fields.props.value, requestedCode: "" });
    button(f.panel.tree(), "Lưu thay đổi").props.onClick();
    assert.equal(f.calls.length, 1);
    assert.equal(f.calls[0].options.data.requestedCode, null);
  });

  test(`${kind}: other approvers neither see nor send numbering options`, () => {
    const f = fixture(kind, ["ADMIN"], { requestedCode: "DUP-1", requestedCodeReason: "Giấy" });
    button(f.panel.tree(), "Sửa nháp").props.onClick();
    assert.equal(nodes(f.panel.tree()).some((node) => node.type === "NumberingOptionsFields"), false);
    button(f.panel.tree(), "Lưu thay đổi").props.onClick();
    assert.equal("requestedCode" in f.calls[0].options.data, false);
  });
}
