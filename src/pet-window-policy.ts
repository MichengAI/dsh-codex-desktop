/** 宠物窗口只接受已知图片路由和有限配置，不向网页开放任意原生窗口 API。 */
export interface PetNotifications {
  items: Array<{
    id: string;
    token: string;
    pose: string;
    title: string;
    text: string;
    sessionId?: string;
    updatedAt: number;
    request?: {
      key: string;
      kind: string;
      toolName?: string;
      reason?: string;
      questions?: Array<{
        id: string;
        question: string;
        detail?: string;
        multiSelect?: boolean;
        options?: Array<{ label: string; description?: string }>;
      }>;
    };
  }>;
  hidden: number;
  activity: PetWindowState["activity"];
}
export interface PetWindowState {
  sprite?: string;
  language?: string;
  notifications?: PetNotifications;
  pet: {
    id: string;
    name: string;
    description: string;
    url: string;
    version: 1 | 2;
    source: "builtin" | "custom";
  };
  config: {
    selected: string;
    visible: boolean;
    size: number;
    position: { x: number; y: number } | null;
  };
  activity: { pose: string; title: string; text: string; sessionId?: string };
}
export function parsePetWindowState(value: unknown): PetWindowState | null {
  if (!value || typeof value !== "object") return null;
  const { pet, config, activity, notifications, language, sprite } =
    value as Partial<PetWindowState>;
  if (
    sprite !== undefined &&
    (typeof sprite !== "string" ||
      sprite.length > 23 * 1024 * 1024 ||
      !/^data:image\/(png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(sprite))
  )
    return null;
  if (!pet || !config || !activity) return null;
  if (
    language !== undefined &&
    (typeof language !== "string" ||
      !/^[a-zA-Z]{2,8}(?:-[a-zA-Z0-9]{1,8})*$/.test(language))
  )
    return null;
  if (typeof pet.id !== "string" || !/^(custom:)?[\w-]+$/.test(pet.id))
    return null;
  if (
    pet.url !== `/dsh-codex-pet/asset/${encodeURIComponent(pet.id)}` ||
    ![1, 2].includes(pet.version)
  )
    return null;
  if (
    typeof pet.name !== "string" ||
    pet.name.length > 100 ||
    typeof pet.description !== "string" ||
    pet.description.length > 300
  )
    return null;
  if (pet.source !== "builtin" && pet.source !== "custom") return null;
  if (
    !Number.isFinite(config.size) ||
    config.size < 64 ||
    config.size > 224 ||
    typeof config.visible !== "boolean"
  )
    return null;
  if (
    ![
      "idle",
      "running",
      "waiting",
      "review",
      "failed",
      "waving",
      "jumping",
      "running-left",
      "running-right",
    ].includes(activity.pose)
  )
    return null;
  if (typeof activity.title !== "string" || typeof activity.text !== "string")
    return null;
  if (
    activity.sessionId !== undefined &&
    (typeof activity.sessionId !== "string" || activity.sessionId.length > 512)
  )
    return null;
  if (notifications !== undefined && !validNotifications(notifications))
    return null;
  return {
    sprite,
    language: language ?? "zh",
    notifications,
    pet: { ...pet },
    config: {
      selected: pet.id,
      visible: config.visible,
      size: config.size,
      position: null,
    },
    activity: {
      pose: activity.pose,
      title: activity.title.slice(0, 200),
      text: activity.text.slice(0, 300),
      sessionId: activity.sessionId,
    },
  };
}
export function constrainPetBounds(
  bounds: { x: number; y: number },
  area: { x: number; y: number; width: number; height: number },
  width = 320,
  height = 560,
): { x: number; y: number } {
  return {
    x: Math.round(
      Math.max(
        area.x,
        Math.min(area.x + Math.max(0, area.width - width), bounds.x),
      ),
    ),
    y: Math.round(
      Math.max(
        area.y,
        Math.min(area.y + Math.max(0, area.height - height), bounds.y),
      ),
    ),
  };
}

/** 限制通知 IPC 的大小及可渲染结构，动作仍须在来源端校验实时请求身份。 */
function validNotifications(value: PetNotifications): boolean {
  const text = (v: unknown, max = 10000): v is string =>
    typeof v === "string" && v.length <= max;
  if (
    !value ||
    !Array.isArray(value.items) ||
    value.items.length > 500 ||
    !Number.isInteger(value.hidden) ||
    value.hidden < 0
  )
    return false;
  if (JSON.stringify(value).length > 1000000) return false;
  return value.items.every(
    (item) =>
      item &&
      text(item.id, 512) &&
      text(item.token, 1024) &&
      text(item.title) &&
      text(item.text) &&
      ["waiting", "failed", "review", "running"].includes(item.pose) &&
      Number.isFinite(item.updatedAt) &&
      (!item.request ||
        (text(item.request.key, 1024) &&
          text(item.request.kind, 100) &&
          (item.request.toolName === undefined ||
            text(item.request.toolName)) &&
          (item.request.reason === undefined ||
            text(item.request.reason, 100000)) &&
          (item.request.questions === undefined ||
            (Array.isArray(item.request.questions) &&
              item.request.questions.length <= 100 &&
              item.request.questions.every(
                (q) =>
                  q &&
                  text(q.id, 512) &&
                  text(q.question) &&
                  (q.detail === undefined || text(q.detail, 100000)) &&
                  (q.multiSelect === undefined ||
                    typeof q.multiSelect === "boolean") &&
                  (q.options === undefined ||
                    (Array.isArray(q.options) &&
                      q.options.length <= 100 &&
                      q.options.every(
                        (o) =>
                          o &&
                          text(o.label) &&
                          (o.description === undefined || text(o.description)),
                      ))),
              ))))),
  );
}
export function validPetCommand(
  value: unknown,
  state: PetWindowState | null,
): boolean {
  if (!value || typeof value !== "object" || !state?.notifications)
    return false;
  if (JSON.stringify(value).length > 100000) return false;
  const v = value as Record<string, unknown>;
  if (v.type === "restore") return true;
  if (v.type === "sort") return typeof v.latest === "boolean";
  const item = state.notifications.items.find(
    (n) => n.id === v.id && n.token === v.token,
  );
  if (!item) return false;
  if (v.type === "stop") return item.pose === "running";
  if (v.type === "open" || v.type === "dismiss") return true;
  const request = item.request;
  if (!request || request.key !== v.requestKey) return false;
  if (v.type === "approve" || v.type === "reject")
    return request.kind === "approval";
  if (
    v.type !== "answer" ||
    !["question", "plan-review"].includes(request.kind)
  )
    return false;
  return validAnswers(request.questions ?? [], v.answers);
}

/** 与插件公开回答协议对齐；插件仍须以最新请求身份再次校验。 */
function validAnswers(
  questions: NonNullable<
    NonNullable<PetNotifications["items"][number]["request"]>["questions"]
  >,
  value: unknown,
): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const answers = (value as Record<string, unknown>).answers;
  if (!Array.isArray(answers) || answers.length !== questions.length)
    return false;
  const ids = new Set<string>();
  for (const answer of answers) {
    if (!answer || typeof answer !== "object" || Array.isArray(answer))
      return false;
    const question = questions.find((question) => question.id === answer.id);
    if (!question || ids.has(question.id) || !Array.isArray(answer.selected))
      return false;
    ids.add(question.id);
    const selected: unknown[] = answer.selected;
    if (new Set(selected).size !== selected.length) return false;
    if (
      selected.some(
        (label) =>
          typeof label !== "string" ||
          !question.options?.some((option) => option.label === label),
      )
    )
      return false;
    if (
      answer.custom !== undefined &&
      (typeof answer.custom !== "string" || answer.custom.length > 10000)
    )
      return false;
    const hasCustom =
      typeof answer.custom === "string" && answer.custom.trim().length > 0;
    if (selected.length === 0 && !hasCustom) return false;
    if (
      !question.multiSelect &&
      (selected.length > 1 || (selected.length > 0 && hasCustom))
    )
      return false;
  }
  return true;
}
