const STORAGE_TASKS = "timekeeper_tasks_mp";
const STORAGE_SETTINGS = "timekeeper_settings_mp";

const priorityLabel = {
  high: "高优先级",
  medium: "中优先级",
  low: "低优先级"
};

const deadlineLabel = {
  any: "今天内",
  morning: "上午完成",
  afternoon: "下午完成",
  evening: "晚上完成"
};

const deadlineEnd = {
  morning: 12 * 60,
  afternoon: 18 * 60,
  evening: 22 * 60,
  any: 24 * 60
};

const priorityOptions = [
  { label: "高优先级", value: "high" },
  { label: "中优先级", value: "medium" },
  { label: "低优先级", value: "low" }
];

const deadlineOptions = [
  { label: "今天内", value: "any" },
  { label: "上午完成", value: "morning" },
  { label: "下午完成", value: "afternoon" },
  { label: "晚上完成", value: "evening" }
];

function createId() {
  return `${Date.now()}_${Math.floor(Math.random() * 100000)}`;
}

function parseTask(raw) {
  const original = String(raw || "").trim();
  const timeRange = original.match(/(\d{1,2})[:：](\d{2})\s*[-到至]\s*(\d{1,2})[:：](\d{2})/);
  const text = original.replace(/^\s*(\d+|[一二三四五六七八九十]+)[\.、]\s*/, "").replace(/\s+/g, "");
  let priority = "medium";
  if (/必须|重要|紧急|尽快|高优先/.test(text)) priority = "high";
  if (/随便|不急|低优先/.test(text)) priority = "low";

  let deadline = "any";
  if (/上午|中午前/.test(text)) deadline = "morning";
  if (/下午|下班前/.test(text)) deadline = "afternoon";
  if (/晚上|今晚|睡前/.test(text)) deadline = "evening";

  let duration = 30;
  const hourMatch = text.match(/(\d+(?:\.\d+)?)(小时|h)/i);
  const minuteMatch = text.match(/(\d+)(分钟|分|min|m)/i);
  if (timeRange) {
    const start = Number(timeRange[1]) * 60 + Number(timeRange[2]);
    const end = Number(timeRange[3]) * 60 + Number(timeRange[4]);
    duration = Math.max(5, end - start);
  }
  if (hourMatch) duration = Math.round(Number(hourMatch[1]) * 60);
  if (minuteMatch) duration = (hourMatch ? duration : 0) + Number(minuteMatch[1]);

  const title = text
    .replace(/\d{1,2}[:：]\d{2}\s*[-到至]\s*\d{1,2}[:：]\d{2}/g, "")
    .replace(/(\d+(?:\.\d+)?)(小时|h)/ig, "")
    .replace(/(\d+)(分钟|分|min|m)/ig, "")
    .replace(/(必须|重要|紧急|尽快|高优先级?|低优先级?|中优先级?|随便|不急|今天|完成|做完|搞定|上午|中午前|下午|下班前|晚上|今晚|睡前|计划|安排|：|:|，|,|。|！|!)/g, "")
    .trim();

  return {
    title: title || raw || "未命名任务",
    duration: Math.max(5, duration),
    priority,
    deadline
  };
}

function makeTask(raw, done = false) {
  const parsed = parseTask(raw);
  return {
    id: createId(),
    title: parsed.title,
    duration: parsed.duration,
    priority: parsed.priority,
    deadline: parsed.deadline,
    status: done ? "done" : "todo",
    createdAt: Date.now(),
    start: null,
    end: null
  };
}

function seedTasks() {
  return [
    makeTask("整理今日计划25分钟，上午完成", true),
    makeTask("写产品方案2小时，必须今天完成"),
    makeTask("学习ReactNative1小时，下午完成"),
    makeTask("运动30分钟，晚上完成")
  ];
}

function parseLines(text) {
  const normalized = String(text || "")
    .replace(/今天(的)?(计划|安排)(是|：|:)?/g, "")
    .replace(/我(今天|明天)?(需要|要|想要|打算)/g, "")
    .replace(/(然后|接着|之后|再来|再|还有|以及|并且)/g, "\n")
    .replace(/([。；;])/g, "\n")
    .replace(/(^|[\s\n])(\d+|[一二三四五六七八九十]+)[\.、]/g, "\n$2.");

  const modifierOnly = /^(上午|中午前|下午|下班前|晚上|今晚|睡前|今天|必须|重要|紧急|尽快|高优先级|中优先级|低优先级|完成|做完|搞定)+$/;
  const parts = normalized
    .split(/[\n；;]/)
    .flatMap((line) => line.split(/[，,、]/))
    .map((line) => line.trim())
    .filter(Boolean);

  const merged = [];
  parts.forEach((part) => {
    const cleaned = part.replace(/^\s*(\d+|[一二三四五六七八九十]+)[\.、]\s*/, "").trim();
    if (!cleaned) return;
    if (modifierOnly.test(cleaned) && merged.length) {
      merged[merged.length - 1] = `${merged[merged.length - 1]}，${cleaned}`;
      return;
    }
    merged.push(cleaned);
  });

  return merged;
}

function minutesToTime(minutes) {
  if (minutes === null || minutes === undefined) return "--:--";
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function todayBaseSeconds(minutes) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.floor(now.getTime() / 1000) + minutes * 60;
}

Page({
  data: {
    activeTab: "home",
    tabs: [
      { key: "home", label: "首页" },
      { key: "plan", label: "计划" },
      { key: "stats", label: "统计" },
      { key: "profile", label: "我的" }
    ],
    todayText: "",
    quickText: "",
    planText: "",
    previewItems: [],
    tasks: [],
    timeline: [],
    currentTask: {},
    stats: {},
    distribution: {},
    settings: {
      startHour: 8,
      endHour: 24
    },
    hourOptions: ["6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20", "21", "22", "23", "24"],
    startIndex: 2,
    endIndex: 18,
    editing: false,
    editId: "",
    editForm: {},
    priorityOptions,
    deadlineOptions,
    editPriorityIndex: 1,
    editDeadlineIndex: 0
  },

  onLoad() {
    const tasks = wx.getStorageSync(STORAGE_TASKS) || seedTasks();
    const settings = Object.assign({}, this.data.settings, wx.getStorageSync(STORAGE_SETTINGS) || {});
    this.setData({
      tasks,
      settings,
      todayText: this.formatToday()
    });
    this.scheduleAndRender();
  },

  formatToday() {
    const d = new Date();
    const week = ["日", "一", "二", "三", "四", "五", "六"][d.getDay()];
    return `${d.getMonth() + 1}月${d.getDate()}日 周${week}`;
  },

  switchTab(event) {
    this.setData({ activeTab: event.currentTarget.dataset.key });
  },

  onQuickInput(event) {
    this.setData({ quickText: event.detail.value });
  },

  onPlanInput(event) {
    this.setData({ planText: event.detail.value });
  },

  addQuickTask() {
    const text = this.data.quickText.trim();
    if (!text) return this.toast("先写下一条任务");
    const lines = parseLines(text);
    const tasks = this.data.tasks.concat(lines.map((line) => makeTask(line)));
    this.setData({ tasks, quickText: "" });
    this.scheduleAndRender();
    this.toast(`已加入 ${lines.length} 条计划`);
  },

  previewPlan() {
    const items = parseLines(this.data.planText).map((line) => {
      if (/推迟|提前/.test(line)) return `调整指令：${line}`;
      const parsed = parseTask(line);
      return `${parsed.title} · ${parsed.duration}分钟 · ${priorityLabel[parsed.priority]} · ${deadlineLabel[parsed.deadline]}`;
    });
    this.setData({ previewItems: items });
  },

  addPlanTasks() {
    const lines = parseLines(this.data.planText);
    if (!lines.length) return this.toast("先输入计划内容");
    let tasks = this.data.tasks.slice();
    lines.forEach((line) => {
      if (/推迟|提前/.test(line)) {
        tasks = this.applyAdjustment(tasks, line);
      } else {
        tasks.push(makeTask(line));
      }
    });
    this.setData({ tasks, planText: "", previewItems: [] });
    this.scheduleAndRender();
    this.toast(`已整理 ${lines.length} 条计划`);
  },

  applyAdjustment(tasks, line) {
    const direction = /推迟/.test(line) ? 1 : -1;
    const amount = Number((line.match(/(\d+)/) || [0, 30])[1]);
    const target = tasks.find((task) => line.includes(task.title.slice(0, 2)) || task.title.includes(line.slice(1, 3)));
    if (target && target.start !== null) {
      target.start += direction * amount;
      target.end += direction * amount;
    }
    return tasks;
  },

  scheduleAndRender() {
    const tasks = this.scheduleTasks(this.data.tasks);
    const visibleTasks = this.decorateTasks(tasks);
    const timeline = visibleTasks.filter((task) => task.status !== "done" && task.start !== null);
    const stats = this.calcStats(tasks);
    const distribution = this.calcDistribution(tasks);
    const currentTask = this.getCurrentTask(visibleTasks);
    const hourOptions = this.data.hourOptions;
    this.setData({
      tasks: visibleTasks,
      timeline,
      stats,
      distribution,
      currentTask,
      startIndex: hourOptions.indexOf(String(this.data.settings.startHour)),
      endIndex: hourOptions.indexOf(String(this.data.settings.endHour))
    });
    wx.setStorageSync(STORAGE_TASKS, tasks);
    wx.setStorageSync(STORAGE_SETTINGS, this.data.settings);
  },

  scheduleTasks(tasks) {
    const order = { high: 0, medium: 1, low: 2 };
    const start = this.data.settings.startHour * 60;
    const end = this.data.settings.endHour * 60;
    let cursor = start;
    const next = tasks.map((task) => Object.assign({}, task));
    next
      .filter((task) => task.status !== "done")
      .sort((a, b) => order[a.priority] - order[b.priority] || deadlineEnd[a.deadline] - deadlineEnd[b.deadline] || a.createdAt - b.createdAt)
      .forEach((task) => {
        const latestEnd = Math.min(deadlineEnd[task.deadline], end);
        if (cursor + task.duration > latestEnd && start + task.duration <= latestEnd) cursor = start;
        task.start = cursor;
        task.end = Math.min(cursor + task.duration, end);
        cursor = task.end + 10;
      });
    return next;
  },

  decorateTasks(tasks) {
    return tasks
      .slice()
      .sort((a, b) => (a.start || 9999) - (b.start || 9999) || a.createdAt - b.createdAt)
      .map((task) => Object.assign({}, task, {
        timeText: task.start === null ? "待排期" : `${minutesToTime(task.start)} - ${minutesToTime(task.end)}`,
        startText: minutesToTime(task.start),
        priorityText: priorityLabel[task.priority],
        deadlineText: deadlineLabel[task.deadline]
      }));
  },

  calcStats(tasks) {
    const total = tasks.length;
    const done = tasks.filter((task) => task.status === "done").length;
    const minutes = tasks.reduce((sum, task) => sum + task.duration, 0);
    const focus = tasks.filter((task) => task.status === "done").reduce((sum, task) => sum + task.duration, 0);
    return {
      total,
      done,
      minutes,
      focus,
      totalRate: Math.min(100, total * 16),
      doneRate: total ? Math.round(done / total * 100) : 0,
      minuteRate: Math.min(100, Math.round(minutes / 480 * 100)),
      focusRate: Math.min(100, Math.round(focus / 360 * 100))
    };
  },

  calcDistribution(tasks) {
    const sums = { high: 0, medium: 0, low: 0 };
    tasks.forEach((task) => {
      sums[task.priority] += task.duration;
    });
    const total = Math.max(1, sums.high + sums.medium + sums.low);
    return {
      high: Math.round(sums.high / total * 100),
      medium: Math.round(sums.medium / total * 100),
      low: Math.round(sums.low / total * 100),
      highMinutes: sums.high,
      mediumMinutes: sums.medium,
      lowMinutes: sums.low
    };
  },

  getCurrentTask(tasks) {
    const running = tasks.find((task) => task.status === "running");
    const next = running || tasks.find((task) => task.status !== "done");
    if (!next) {
      return {
        title: "今天已经清空",
        meta: "可以休息一下，或者为明天留一条轻任务。",
        time: "完成",
        statusText: "已完成"
      };
    }
    return {
      title: next.title,
      meta: `${next.priorityText} · ${next.deadlineText} · ${next.duration} 分钟`,
      time: next.startText || "--:--",
      statusText: next.status === "running" ? "进行中" : "下一项"
    };
  },

  toggleDone(event) {
    const id = event.currentTarget.dataset.id;
    const tasks = this.data.tasks.map((task) => {
      if (task.id !== id) return task;
      return Object.assign({}, task, { status: task.status === "done" ? "todo" : "done" });
    });
    this.setData({ tasks });
    this.scheduleAndRender();
  },

  startTask(event) {
    const id = event.currentTarget.dataset.id;
    const tasks = this.data.tasks.map((task) => {
      if (task.status === "running" && task.id !== id) return Object.assign({}, task, { status: "todo" });
      if (task.id === id) return Object.assign({}, task, { status: task.status === "running" ? "todo" : "running" });
      return task;
    });
    this.setData({ tasks });
    this.scheduleAndRender();
  },

  openEdit(event) {
    const id = event.currentTarget.dataset.id;
    const task = this.data.tasks.find((item) => item.id === id);
    if (!task) return;
    this.setData({
      editing: true,
      editId: id,
      editForm: Object.assign({}, task, {
        priorityText: priorityLabel[task.priority],
        deadlineText: deadlineLabel[task.deadline]
      }),
      editPriorityIndex: priorityOptions.findIndex((item) => item.value === task.priority),
      editDeadlineIndex: deadlineOptions.findIndex((item) => item.value === task.deadline)
    });
  },

  closeEdit() {
    this.setData({ editing: false, editId: "", editForm: {} });
  },

  editTitle(event) {
    this.setData({ "editForm.title": event.detail.value });
  },

  editDuration(event) {
    this.setData({ "editForm.duration": Number(event.detail.value) || 30 });
  },

  editPriority(event) {
    const option = priorityOptions[Number(event.detail.value)];
    this.setData({
      editPriorityIndex: Number(event.detail.value),
      "editForm.priority": option.value,
      "editForm.priorityText": option.label
    });
  },

  editDeadline(event) {
    const option = deadlineOptions[Number(event.detail.value)];
    this.setData({
      editDeadlineIndex: Number(event.detail.value),
      "editForm.deadline": option.value,
      "editForm.deadlineText": option.label
    });
  },

  saveEdit() {
    const form = this.data.editForm;
    const tasks = this.data.tasks.map((task) => {
      if (task.id !== this.data.editId) return task;
      return Object.assign({}, task, {
        title: form.title || "未命名任务",
        duration: Math.max(5, Number(form.duration) || 30),
        priority: form.priority,
        deadline: form.deadline
      });
    });
    this.setData({ tasks });
    this.closeEdit();
    this.scheduleAndRender();
    this.toast("任务已更新");
  },

  deleteTask() {
    const tasks = this.data.tasks.filter((task) => task.id !== this.data.editId);
    this.setData({ tasks });
    this.closeEdit();
    this.scheduleAndRender();
    this.toast("任务已删除");
  },

  addCalendar(event) {
    const task = this.data.tasks.find((item) => item.id === event.currentTarget.dataset.id);
    if (!task || task.start === null) return this.toast("任务还没有排期");
    if (typeof wx.addPhoneCalendar !== "function") {
      wx.setClipboardData({
        data: `${task.title} ${task.timeText}`,
        success: () => this.toast("当前微信版本不支持写入日历，已复制任务信息")
      });
      return;
    }
    wx.addPhoneCalendar({
      title: task.title,
      startTime: todayBaseSeconds(task.start),
      endTime: todayBaseSeconds(task.end),
      description: `时间守护者任务：${task.title}`,
      alarm: true,
      success: () => this.toast("已加入手机日历提醒"),
      fail: () => this.toast("未能写入日历，请检查系统权限")
    });
  },

  changeStartHour(event) {
    const startHour = Number(this.data.hourOptions[Number(event.detail.value)]);
    if (startHour >= this.data.settings.endHour) return this.toast("开始时间要早于结束时间");
    this.setData({ "settings.startHour": startHour });
    this.scheduleAndRender();
  },

  changeEndHour(event) {
    const endHour = Number(this.data.hourOptions[Number(event.detail.value)]);
    if (endHour <= this.data.settings.startHour) return this.toast("结束时间要晚于开始时间");
    this.setData({ "settings.endHour": endHour });
    this.scheduleAndRender();
  },

  clearDone() {
    const tasks = this.data.tasks.filter((task) => task.status !== "done");
    this.setData({ tasks });
    this.scheduleAndRender();
    this.toast("已清除完成任务");
  },

  resetData() {
    wx.showModal({
      title: "重置数据",
      content: "确认恢复为演示数据吗？",
      success: (res) => {
        if (!res.confirm) return;
        this.setData({ tasks: seedTasks() });
        this.scheduleAndRender();
        this.toast("数据已重置");
      }
    });
  },

  toast(title) {
    wx.showToast({ title, icon: "none" });
  }
});
