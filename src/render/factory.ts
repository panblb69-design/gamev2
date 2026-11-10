import type { GameState } from "../core/model";
import { machines } from "../data/catalog";
import { Application, Container, Graphics, Text } from "pixi.js";
export interface FactoryRenderer {
  init(
    host: HTMLElement,
    onSelect: (x: number, y: number) => void,
  ): Promise<void>;
  resetCamera(): void;
  zoom(factor: number): void;
  pan(dx: number, dy: number): void;
  update(state: GameState): void;
  animate(state: GameState, time: number): void;
  destroy(): void;
}
export class PixiFactory implements FactoryRenderer {
  private labels = new Container();
  private labelRevision = "";
  private scene = new Graphics();
  private actors = new Graphics();
  private ready = false;
  private signature = "";
  private app = new Application();
  private world = new Container();
  private selection = new Graphics();
  private host!: HTMLElement;
  private observer!: ResizeObserver;
  private cleanup: (() => void)[] = [];
  private drag: {
    x: number;
    y: number;
    startX: number;
    startY: number;
    button: number;
  } | null = null;
  async init(
    host: HTMLElement,
    onSelect: (x: number, y: number) => void,
  ): Promise<void> {
    this.host = host;
    await this.app.init({
      preference: "webgl",
      background: 0x111e29,
      antialias: true,
      resolution: Math.min(devicePixelRatio, 2),
      autoDensity: true,
      width: host.clientWidth,
      height: host.clientHeight,
    });
    host.append(this.app.canvas);
    this.app.stage.addChild(this.world);
    const grid = new Graphics();
    grid.rect(0, 0, 1000, 700).fill(0x1b3038);
    for (let x = 0; x <= 1000; x += 10) grid.moveTo(x, 0).lineTo(x, 700);
    for (let y = 0; y <= 700; y += 10) grid.moveTo(0, y).lineTo(1000, y);
    grid.stroke({ color: 0x36505a, width: 0.5 });
    grid.rect(0, 0, 1000, 700).stroke({ color: 0x75b8ae, width: 2 });
    this.world.addChild(
      grid,
      this.scene,
      this.labels,
      this.actors,
      this.selection,
    );
    this.ready = true;
    this.resetCamera();
    this.observer = new ResizeObserver(() => {
      this.app.renderer.resize(host.clientWidth, host.clientHeight);
    });
    this.observer.observe(host);
    const listen = (type: string, fn: EventListener) => {
      host.addEventListener(type, fn);
      this.cleanup.push(() => host.removeEventListener(type, fn));
    };
    listen("contextmenu", (e) => e.preventDefault());
    listen("pointerdown", (e) => {
      const p = e as PointerEvent;
      this.drag = {
        x: p.clientX,
        y: p.clientY,
        startX: p.clientX,
        startY: p.clientY,
        button: p.button,
      };
      host.setPointerCapture(p.pointerId);
    });
    listen("pointermove", (e) => {
      const p = e as PointerEvent;
      if (this.drag) {
        this.pan(p.clientX - this.drag.x, p.clientY - this.drag.y);
        this.drag.x = p.clientX;
        this.drag.y = p.clientY;
      }
    });
    listen("pointerup", (e) => {
      const p = e as PointerEvent;
      const d = this.drag;
      this.drag = null;
      if (
        !d ||
        d.button !== 0 ||
        Math.hypot(p.clientX - d.startX, p.clientY - d.startY) > 4
      )
        return;
      const r = host.getBoundingClientRect();
      const x = Math.floor(
          (p.clientX - r.left - this.world.x) / this.world.scale.x / 10,
        ),
        y = Math.floor(
          (p.clientY - r.top - this.world.y) / this.world.scale.y / 10,
        );
      if (x >= 0 && x < 100 && y >= 0 && y < 70) {
        this.selection
          .clear()
          .rect(x * 10, y * 10, 10, 10)
          .fill({ color: 0xf3b85a, alpha: 0.7 });
        onSelect(x, y);
      }
    });
    listen("pointercancel", () => {
      this.drag = null;
    });
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = host.getBoundingClientRect();
      this.zoomAt(
        Math.exp(-e.deltaY * 0.001),
        e.clientX - r.left,
        e.clientY - r.top,
      );
    };
    host.addEventListener("wheel", wheel, { passive: false });
    this.cleanup.push(() => host.removeEventListener("wheel", wheel));
  }
  update(state: GameState): void {
    if (!this.ready) return;
    const signature = JSON.stringify([
      state.factory.revision,
      state.factory.hall,
      state.world.owned,
      state.machines.map((m) => [
        m.id,
        m.status,
        m.x,
        m.y,
        m.orientation,
        m.definitionId,
      ]),
      state.factory.machines.map((m) => m.power),
    ]);
    if (signature !== this.signature) {
      this.signature = signature;
      this.scene.clear();
      const h = state.factory.hall;
      if (h)
        this.scene
          .rect(h.x * 10, h.y * 10, h.width * 10, h.height * 10)
          .fill({ color: 0x527180, alpha: 0.2 })
          .stroke({ color: 0xa0b7be, width: 2 });
      this.scene.rect(10, 10, 25, 25).fill(0xd3aa63);
      for (const m of state.machines) {
        const d = machines.find((d) => d.id === m.definitionId)!;
        const rotated = m.orientation === 90 || m.orientation === 270;
        const w = rotated ? d.footprint.height : d.footprint.width,
          hh = rotated ? d.footprint.width : d.footprint.height;
        const production = state.factory.machines.find((x) => x.id === m.id)!;
        if (production.powerPath.length) {
          this.scene.moveTo(25, 25);
          for (const p of production.powerPath)
            this.scene.lineTo(p.x * 10 + 5, p.y * 10 + 5);
          this.scene.stroke({ color: 0xd5a946, width: 1 });
        }
        this.scene
          .rect(m.x * 10, m.y * 10, w * 10, hh * 10)
          .fill(
            m.status === "running"
              ? 0x42b898
              : m.status === "blocked"
                ? 0xc8784a
                : 0x58758b,
          )
          .stroke({ color: 0xb6cdd5, width: 1 });
        this.scene.circle(m.x * 10 - 5, m.y * 10 + 5, 3).fill(0xe9c779);
      }
    }
    const labelKey = JSON.stringify(
      state.machines.map((m) => [m.id, m.x, m.y, m.definitionId]),
    );
    if (this.labelRevision !== labelKey) {
      this.labelRevision = labelKey;
      this.labels.removeChildren().forEach((c) => c.destroy());
      for (const m of state.machines) {
        const label = new Text({
          text: m.definitionId,
          style: { fontFamily: "sans-serif", fontSize: 9, fill: 0xffffff },
        });
        label.position.set(m.x * 10 + 3, m.y * 10 + 3);
        this.labels.addChild(label);
      }
    }
  }
  animate(state: GameState, time: number): void {
    if (!this.ready) return;
    this.actors.clear();
    for (const task of state.factory.transfers) {
      if (task.started === null || task.due === null) continue;
      const progress = Math.max(
        0,
        Math.min(1, (time - task.started) / (task.due - task.started)),
      );
      const position = progress * (task.path.length - 1),
        i = Math.floor(position),
        a = task.path[i]!,
        b = task.path[Math.min(i + 1, task.path.length - 1)]!;
      this.actors
        .rect(
          (a.x + (b.x - a.x) * (position - i)) * 10,
          (a.y + (b.y - a.y) * (position - i)) * 10,
          7,
          7,
        )
        .fill(0xf4bd55);
    }
  }
  private zoomAt(factor: number, x: number, y: number): void {
    const old = this.world.scale.x;
    const next = Math.min(6, Math.max(0.25, old * factor));
    this.world.x = x - ((x - this.world.x) * next) / old;
    this.world.y = y - ((y - this.world.y) * next) / old;
    this.world.scale.set(next);
  }
  zoom(factor: number): void {
    this.zoomAt(factor, this.host.clientWidth / 2, this.host.clientHeight / 2);
  }
  pan(dx: number, dy: number): void {
    this.world.x += dx;
    this.world.y += dy;
  }
  resetCamera(): void {
    const scale = Math.min(
      (this.host.clientWidth - 70) / 1000,
      (this.host.clientHeight - 70) / 700,
    );
    this.world.scale.set(Math.max(0.25, scale));
    this.world.position.set(
      (this.host.clientWidth - 1000 * this.world.scale.x) / 2,
      (this.host.clientHeight - 700 * this.world.scale.x) / 2,
    );
  }
  destroy(): void {
    this.observer?.disconnect();
    this.cleanup.forEach((f) => f());
    this.app.destroy(true, { children: true });
  }
}
