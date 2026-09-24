import test from "node:test";
import assert from "node:assert/strict";
import { runInNewContext } from "node:vm";
import { gazeDelta, gazePayload, lookCell } from "../src/pet-gaze.js";
import { petWindowHtml } from "../src/pet-window-html.js";

test("v2 注视与插件一致：上方起顺时针 16 向，中心死区不转头", () => {
  assert.deepEqual(lookCell(0, -100), { row: 9, col: 0 });
  assert.deepEqual(lookCell(100, 0), { row: 9, col: 4 });
  assert.deepEqual(lookCell(0, 100), { row: 10, col: 0 });
  assert.deepEqual(lookCell(-100, 0), { row: 10, col: 4 });
  assert.equal(lookCell(0, 0), null);
  assert.equal(lookCell(27, 0), null);
  assert.deepEqual(lookCell(28, 0), { row: 9, col: 4 });
});

test("光标偏移以透明窗口内的精灵中心为原点", () => {
  const size = 192;
  const bounds = { x: 100, y: 200, width: 320, height: 560 };
  const height = (size * 208) / 192;
  const center = {
    x: bounds.x + bounds.width - 12 - size / 2,
    y: bounds.y + bounds.height - 30 - height / 2,
  };
  assert.deepEqual(gazeDelta(center, bounds, size), { dx: 0, dy: 0 });
  assert.deepEqual(gazeDelta({ x: center.x + 80, y: center.y - 40 }, bounds, size), {
    dx: 80,
    dy: -40,
  });
});

test("主进程只在 v2 空闲时发布光标偏移", () => {
  const cursor = { x: 400, y: 300 };
  const bounds = { x: 10, y: 20, width: 320, height: 560 };
  const idle = {
    pet: { version: 2 as const },
    activity: { pose: "idle" },
    config: { size: 120 },
  };
  assert.deepEqual(gazePayload(idle, cursor, bounds), gazeDelta(cursor, bounds, 120));
  assert.equal(gazePayload({ ...idle, pet: { version: 1 } }, cursor, bounds), null);
  assert.equal(gazePayload({ ...idle, activity: { pose: "running" } }, cursor, bounds), null);
  assert.equal(gazePayload(null, cursor, bounds), null);
});

type PetNode = {
  className: string;
  style: { backgroundPosition?: string };
  onkeydown?: (event: { key: string }) => void;
  onpointerdown?: (event: { button: number; pointerId: number; screenX: number; screenY: number }) => void;
};

function bootPetWindow() {
  const frames: Array<(time: number) => void> = [];
  const nodes: PetNode[] = [];
  let onCursor: ((value: { dx: number; dy: number } | null) => void) | undefined;
  let onState: ((value: unknown) => void) | undefined;
  const make = () => {
    const node: PetNode = {
      className: "",
      style: {},
      setAttribute() {},
      append() {},
      replaceChildren() {},
      setPointerCapture() {},
      querySelectorAll() {
        return [];
      },
      contains() {
        return false;
      },
      classList: { add() {} },
    } as PetNode;
    nodes.push(node);
    return node;
  };
  const script = petWindowHtml("http://127.0.0.1:1234").match(/<script>([\s\S]+)<\/script>/)![1];
  runInNewContext(script, {
    window: {
      petWindow: {
        onState(fn: (value: unknown) => void) {
          onState = fn;
          return () => {};
        },
        onCursor(fn: (value: { dx: number; dy: number } | null) => void) {
          onCursor = fn;
          return () => {};
        },
        ready() {},
        pointer() {},
        move() {},
        command: async () => {},
        action() {},
      },
    },
    document: {
      body: { append() {} },
      createElement: () => make(),
      createElementNS: () => make(),
      addEventListener() {},
    },
    matchMedia: () => ({ matches: false }),
    requestAnimationFrame: (fn: (time: number) => void) => {
      frames.push(fn);
      return frames.length;
    },
    innerHeight: 800,
    setTimeout,
    clearTimeout,
  });
  const paint = (state: unknown, cursor: { dx: number; dy: number } | null, time = 20) => {
    onState?.(state);
    onCursor?.(cursor);
    frames.at(-1)?.(time);
    return nodes.find((node) => node.className === "sprite")?.style.backgroundPosition;
  };
  return { nodes, paint, onCursor };
}

const petState = (version: 1 | 2, pose: string) => ({
  pet: { id: "codex", name: "Codex", url: "data:image/webp;base64,AA==", version },
  config: { size: 120 },
  activity: { pose, title: "", text: "" },
  language: "zh",
});

test("原生渲染在 v2 空闲时使用主进程光标切到注视帧", () => {
  const { paint, onCursor } = bootPetWindow();
  assert.equal(typeof onCursor, "function");
  assert.equal(paint(petState(2, "idle"), { dx: 100, dy: 0 }), "-480px -1170px");
});

test("v1、非空闲、死区、招手和拖拽都不切注视帧", () => {
  const idle = bootPetWindow();
  assert.equal(idle.paint(petState(1, "idle"), { dx: 100, dy: 0 }), "0px 0px");
  const running = bootPetWindow();
  assert.equal(running.paint(petState(2, "running"), { dx: 100, dy: 0 }), "0px -910px");
  const dead = bootPetWindow();
  assert.equal(dead.paint(petState(2, "idle"), { dx: 10, dy: 0 }), "0px 0px");
  const waving = bootPetWindow();
  waving.paint(petState(2, "idle"), null, 0);
  const sprite = waving.nodes.find((node) => node.className === "pet");
  sprite?.onkeydown?.({ key: "Enter" });
  assert.equal(waving.paint(petState(2, "idle"), { dx: 100, dy: 0 }), "0px -390px");
  const dragging = bootPetWindow();
  dragging.paint(petState(2, "idle"), null, 0);
  dragging.nodes.find((node) => node.className === "pet")?.onpointerdown?.({
    button: 0,
    pointerId: 1,
    screenX: 0,
    screenY: 0,
  });
  assert.equal(dragging.paint(petState(2, "idle"), { dx: 100, dy: 0 }), "0px 0px");
});
