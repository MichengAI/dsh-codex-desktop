/** 在 DSH 主世界主动消费插件接口；此函数序列化注入，不捕获模块变量。 */
export function installPetSourceAdapter(): void {
  type Snapshot = {
    pet: { id: string; url: string } | null;
    config: { visible: boolean };
    language: string;
    notifications: {
      activity: unknown;
      items: Array<{ id: string; token: string }>;
    };
  };
  type Api = {
    version: number;
    getSnapshot(): Snapshot | null;
    subscribe(fn: () => void): () => void;
    acquireDisplay(): () => void;
    command(value: unknown): Promise<void>;
    updateConfig(value: unknown): Promise<void>;
    openSettings(): void;
  };
  type Bridge = {
    sync(value: unknown): Promise<void>;
    onCommand(fn: (value: unknown) => Promise<void>): () => void;
    onAction(fn: (value: string) => void): () => void;
  };
  const page = window as unknown as {
    dshPet?: Api;
    dshPetHost?: Bridge;
    __disposePetAdapter?: () => void;
  };
  page.__disposePetAdapter?.();
  const bridge = page.dshPetHost;
  if (!bridge) return;
  let api: Api | undefined,
    off: (() => void) | undefined,
    release: (() => void) | undefined;
  let requested = 0,
    processed = 0,
    running = false,
    disposed = false;
  let displayRevision = 0;
  let imageUrl = "",
    imageData = "";
  const loadImage = async (pet: NonNullable<Snapshot["pet"]>) => {
    if (pet.url !== `/dsh-codex-pet/asset/${encodeURIComponent(pet.id)}`)
      throw new Error("宠物图片路径无效");
    if (imageUrl === pet.url && imageData) return imageData;
    const response = await fetch(pet.url, {
      credentials: "same-origin",
      redirect: "error",
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error(`宠物图片加载失败：${response.status}`);
    const blob = await response.blob();
    if (
      !["image/png", "image/webp"].includes(blob.type) ||
      blob.size > 16 * 1024 * 1024
    )
      throw new Error("宠物图片格式或大小无效");
    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
    imageUrl = pet.url;
    imageData = data;
    return data;
  };
  const releaseDisplay = () => {
    // 作废正在等待同步的接管，避免隐藏或关闭后旧请求再次隐藏页内宠物。
    displayRevision++;
    release?.();
    release = undefined;
  };
  const pump = async () => {
    if (running) return;
    running = true;
    try {
      while (processed !== requested) {
        processed = requested;
        const revision = processed,
          current = api,
          display = displayRevision;
        try {
          const snapshot = current?.getSnapshot();
          const sprite =
            snapshot?.pet && snapshot.config.visible
              ? await loadImage(snapshot.pet)
              : undefined;
          if (
            current !== api ||
            revision !== requested ||
            disposed ||
            display !== displayRevision
          ) {
            if (disposed) await bridge.sync(null);
            continue;
          }
          await bridge.sync(
            snapshot?.pet
              ? {
                  ...snapshot,
                  sprite,
                  activity: snapshot.notifications.activity,
                }
              : null,
          );
          if (
            current !== api ||
            revision !== requested ||
            disposed ||
            display !== displayRevision
          )
            continue;
          if (snapshot?.pet && snapshot.config.visible)
            release ??= current!.acquireDisplay();
          else releaseDisplay();
        } catch (error) {
          releaseDisplay();
          console.warn("[dsh-pet] 桌面适配失败，恢复页内显示", error);
          await bridge.sync(null).catch(() => {});
        }
      }
    } finally {
      running = false;
    }
  };
  const update = () => {
    requested++;
    void pump();
  };
  const connect = () => {
    if (disposed) return;
    off?.();
    off = undefined;
    releaseDisplay();
    imageUrl = "";
    imageData = "";
    api = page.dshPet?.version === 1 ? page.dshPet : undefined;
    if (api) off = api.subscribe(update);
    update();
  };
  const offCommand = bridge.onCommand(async (command) => {
    if (!api) throw new Error("宠物插件未就绪");
    await api.command(command);
  });
  const offAction = bridge.onAction((action) => {
    if (action === "release") {
      releaseDisplay();
      return;
    }
    if (action === "hide") releaseDisplay();
    if (!api) return;
    if (action === "settings") api.openSettings();
    if (action === "hide") {
      const current = api;
      void Promise.resolve()
        .then(() => current.updateConfig({ visible: false }))
        .catch((error) =>
          console.warn("[dsh-pet] 隐藏失败，已恢复页内显示", error),
        );
    }
    if (action === "open") {
      const item = api.getSnapshot()?.notifications.items[0];
      if (item)
        void api
          .command({ type: "open", id: item.id, token: item.token })
          .catch((error) => console.warn("[dsh-pet] 打开任务失败", error));
    }
  });
  window.addEventListener("dsh-pet-ready", connect);
  window.addEventListener("dsh-pet-disposed", connect);
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    off?.();
    releaseDisplay();
    api = undefined;
    update();
    offCommand();
    offAction();
    window.removeEventListener("dsh-pet-ready", connect);
    window.removeEventListener("dsh-pet-disposed", connect);
    window.removeEventListener("pagehide", dispose);
    if (page.__disposePetAdapter === dispose) delete page.__disposePetAdapter;
  };
  page.__disposePetAdapter = dispose;
  window.addEventListener("pagehide", dispose);
  connect();
}
