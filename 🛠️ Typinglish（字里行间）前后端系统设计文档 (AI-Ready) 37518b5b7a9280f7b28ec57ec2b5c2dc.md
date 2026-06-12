# 🛠️ Typinglish（字里行间）前后端系统设计文档 (AI-Ready)

## 📌 一、 系统全局技术选型 (Tech Stack)

为了保证 AI 在搭建骨架时技术栈统一，规定采用以下主流、生态成熟的前后端组合：

### 1. 前端技术栈 (Frontend)

- **核心框架**：React 19 / Vue 3 (SFC) —— *注：由开发者实际脚手架决定，以下逻辑通用*。
- **样式驱动**：Tailwind CSS + Headless UI / Radix UI（确保无污染的极简/像素风样式控制）。
- **状态管理**：Zustand (React) 或 Pinia (Vue) —— *必须使用单向数据流管理打字核心状态，禁止混入全局 Context 导致渲染延迟*。
- **动画引擎**：Framer Motion (React) 或 Motion One (Vue) —— 用于实现《胡闹厨房》风格的地图弹跳解锁动效。

### 2. 后端技术栈 (Backend)

- **基础语言**：Go (Gin / Fiber) 或 Node.js (TypeScript + NestJS)
- **数据库**：PostgreSQL 15+（利用 `JSONB` 存储多变的内容元数据）。
- **缓存/并发控制**：Redis（用于存储用户实时打字的心跳、临时断点以及天梯榜 WPM 排序）。

## 🗄️ 二、 后端设计：高扩展数据模型与核心 API

AI 必须严格实现以下三级抽象数据模型，以支持长文本（书籍/美剧）的无限扩展。

### 1. 数据库持久化设计 (DDL for PostgreSQL)

SQL

```
-- 1. 内容源表 (书籍、美剧、词库的总外壳)
CREATE TABLE sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,              -- 'SERIES' | 'BOOK' | 'VOCAB'
    cover_url VARCHAR(512),                 -- 游戏模式下渲染的卡片封面
    is_active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}'::jsonb,     -- 存储如 {"author": "Orwell", "season": 1}
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. 文本分块表 (多邻国关卡节点 / 书籍章节)
CREATE TABLE chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
    chapter_num INT NOT NULL,               -- 第几季/第几章
    section_num INT NOT NULL,               -- 第几集/第几节
    title VARCHAR(255) NOT NULL,            -- 关卡/章节名
    dependencies UUID[] DEFAULT '{}',       -- 多邻国逻辑：解锁本关前必须通关的 chunk_id 数组
    map_zone VARCHAR(100) DEFAULT 'default',-- 胡闹厨房逻辑：所属地图区域标识
    map_pos_x INT NOT NULL DEFAULT 0,       -- 地图 X 坐标
    map_pos_y INT NOT NULL DEFAULT 0,       -- 地图 Y 坐标
    word_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_source_chapter_section UNIQUE(source_id, chapter_num, section_num)
);

-- 3. 原子文本节点表 (打字机消费的最小文本流)
CREATE TABLE content_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chunk_id UUID NOT NULL REFERENCES chunks(id) ON DELETE CASCADE,
    sequence INT NOT NULL,                  -- 关卡内绝对正序递增，不可跳跃 (1, 2, 3...)
    raw_text TEXT NOT NULL,                 -- 包含符号大小写的原始文本，如 "I'll be there for you."
    clean_text TEXT NOT NULL,               -- 经过清洗供算法比对的纯文本，如 "ill be there for you"
    translation TEXT,                       -- 中文翻译提示
    audio_url VARCHAR(512),                 -- 原声音频 URL
    CONSTRAINT unique_chunk_sequence UNIQUE(chunk_id, sequence)
);

-- 4. 用户进度及断点记录表 (同时支撑游戏模式星星和纯净模式书签)
CREATE TABLE user_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    chunk_id UUID NOT NULL REFERENCES chunks(id) ON DELETE CASCADE,
    highest_wpm FLOAT DEFAULT 0.0,
    highest_accuracy FLOAT DEFAULT 0.0,
    stars_earned INT DEFAULT 0,             -- 游戏模式获得的星星数 (0-3)
    last_node_sequence INT DEFAULT 1,       -- 纯净模式断点：上一次打到了第几句
    is_completed BOOLEAN DEFAULT false,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_user_chunk UNIQUE(user_id, chunk_id)
);
```

### 2. 核心 API 功能契约 (AI 必须完整实现)

### ⚙️ Content Delivery System (内容分发)

- **`GET /api/v1/sources`**：获取所有内容源（支持按 `type` 过滤）。
- **`GET /api/v1/sources/:id/map`**：**（游戏模式核心）** 返回该源下所有的 `chunks` 列表，包含坐标 `map_pos_x/y`、依赖关系 `dependencies` 以及当前用户的 `stars_earned`。AI 必须一次性返回完整的树状结构以便前端渲染大地图。
- **`GET /api/v1/chunks/:id/stream`**：**（打字引擎核心）** 分页或分段拉取 `content_nodes`。在 `Zen Mode` 下，支持传入 `cursor_seq` 参数，实现向下无缝滚动的流式拉取。

### 💾 Progress Sync (进度同步)

- **`POST /api/v1/progress/report`**：用户打完一个 Chunk（游戏模式一关）或在纯净模式下中途退出时上报。
    - *Payload*: `{ chunk_id: UUID, wpm: Float, accuracy: Float, current_seq: Int }`
    - *Backend Logic*: 计算判定星星数。如果 `accuracy >= 98%` 且 `wpm >= 60` 计 3 星；`accuracy >= 95%` 计 2 星；`accuracy >= 90%` 计 1 星。更新 `user_progress` 表。

## 💻 三、 前端设计：双重状态机与双端体验实现

AI 在编写前端代码时，必须保证**打字内核状态机**与**UI 表现层**解耦。

### 1. 核心打字内核状态机定义 (Zustand / Pinia 架构标准)

AI 必须完整初始化并维护以下状态，任何键盘事件只能通过 `commitCharacter` 变动状态：

TypeScript

```
interface TypingCoreState {
  // 原始状态
  sourceText: string;          // 当前正在打的整段文本，例如 "Hello, World!"
  charArray: string[];         // sourceText.split('') -> ['H','e','l','l','o',',',' ','W','o','r','l','d','!']

  // 指针与输入流
  userInput: string[];         // 用户实际输入的字符数组
  currentIndex: number;        // 当前期待输入的 charArray 索引

  // 统计指标
  startTime: number | null;    // 敲击第一个正确字符的时间戳
  errorCount: number;          // 累计按错次数
  wrongIndices: Set<number>;   // 容错模式下，哪些位置打错了

  // 配置项
  inputMode: 'STRICT' | 'TOLERANT'; // 退回模式(STRICT) | 容错模式(TOLERANT)
}
```

### 2. 状态机流转控制核心算法 (AI 必须严格照此逻辑编写 `onKeyDown`)

当用户按下键盘按键 `e.key` 时，AI 驱动的组件必须执行以下防御式断言逻辑：

TypeScript

```
function processKeyDown(e: KeyboardEvent, state: TypingCoreState){
  // 1. 忽略系统功能键
  if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta') return;

  // 2. 触发计时器
  if (state.startTime === null) {
    state.startTime = Date.now();
  }

  const targetChar = state.charArray[state.currentIndex];

  // 3. 处理退格键 (Backspace)
  if (e.key === 'Backspace') {
    if (state.currentIndex > 0) {
      state.currentIndex--;
      state.userInput.pop();
      if (state.inputMode === 'TOLERANT') {
        state.wrongIndices.delete(state.currentIndex);
      }
    }
    return;
  }

  // 4. 处理常规字符输入
  if (e.key.length === 1) {
    // 区分输入模式
    if (state.inputMode === 'STRICT') {
      // 【退回模式】：错字死锁，不前进
      if (e.key === targetChar) {
        state.userInput.push(e.key);
        state.currentIndex++;
        triggerAudio('success_click');
      } else {
        state.errorCount++;
        triggerVisualEffect('screen_shake'); // 屏幕微颤
        triggerAudio('error_buzz');
      }
    } else {
      // 【容错模式】：错字前行，标红
      if (e.key !== targetChar) {
        state.wrongIndices.add(state.currentIndex);
        state.errorCount++;
        triggerAudio('error_buzz');
      } else {
        triggerAudio('success_click');
      }
      state.userInput.push(e.key);
      state.currentIndex++;
    }
  }

  // 5. 检查结算条件
  if (state.currentIndex === state.charArray.length) {
    calculateFinalMetrics(state);
  }
}
```

### 3. UI 渲染规约：灰色垫底与动态覆盖

AI 渲染打字区域时，禁止使用原生的 `<input>` 或 `<textarea>` 直观展示。必须采用**绝对定位重叠法**：

- 底层渲染一个由 `span` 组成的数组，全部赋予低饱和度灰色（如 `text-slate-400`）。
- 当前光标所在的 `span` 必须添加带有闪烁动画的虚拟光标样式（如 `border-l-2 border-green-500 animate-pulse`）。
- 已输入正确的 `span` 赋予绿色（`text-emerald-500`）；打错的 `span` 赋予红色（`text-rose-500`）。

## 🗺️ 四、 体验端场景（前端功能完整性要求）

AI 在构建两个模式的 View 视图时，必须提供完全隔离的 UI 组件。

### 🏎️ 1. 关卡冒险模式 (Adventure View)

- **多邻国路径树实现**：
    
    前端接收到 `GET /api/v1/sources/:id/map` 的节点数组后，必须使用 Flex 或 Absolute 布局，将其绘制成一条从上至下交错排列的圆圈按钮链。
    
- **状态依赖锁**：
    
    AI 必须遍历 `chunks[i].dependencies`。如果其中包含的 UUID 在用户的已通关列表里未全部标记为 `is_completed = true`，该按钮必须渲染为带锁状态（`opacity-50 cursor-not-allowed`），无法点击。
    
- **胡闹厨房解锁特效**：
    
    当检测到后端返回新关卡解锁时，利用 `Framer Motion` 执行链条动画：上一关节点发光 $\rightarrow$ 一条由虚线变实线的线条向下一关延伸 $\rightarrow$ 下一关节点伴随 `scale: [0, 1.2, 1]` 弹性蹦出。
    
- **星级结算**：
    
    关卡结束时，阻断用户操作，依次触发动效弹出 “WPM”、“正确率”，然后通过动画连砸出 1-3 颗金星。如果 0 星，弹出“未达标，再试一次”按钮。
    

### 🍃 2. 长文本纯净模式 (Zen View)

- **降噪界面断言**：
    
    此视图下，AI 必须隐藏侧边栏、顶部导航、速度计、错误率统计。全屏仅保留核心打字画布。
    
- **无缝垂直滚动算法 (Viewport Scrolling)**：
    - 容器固定高度，最多显示 3 行文本（当前行、前一行、后一行）。
    - **核心控制逻辑**：当 `currentIndex` 越过当前行的最后一个字符，并且触发系统换行时，UI 必须触发一个平滑的 CSS Transition（`transform: translateY(-line-height)`），将已经打完的那一行整体向上推移隐藏，新的一行浮现到中央，保证用户视线水平高度永远保持静止。
- **离线自动书签**：
    
    每当用户在一个 Node（一句话）结束时，触发组件内部的 `debounce`（防抖）机制，将当前 `chunk_id` 和 `sequence` 写入 `localStorage` 并静默同步给后端，确保用户在任何时候刷新或关闭浏览器，下次进入都能百分之百原地复活。
    

## 🤖 五、 给 AI 编码助手的 Prompt 启动指令

当你把这个设计文档喂给 AI 时，请配合使用以下指令来启动开发：

> **Prompt 启动语：**
> 
> 
> “请阅读上述系统设计文档。我们需要严格按照文档中的持久化 DDL 建立 PostgreSQL 数据库，并实现打字核心状态机逻辑。请首先完成第一阶段：建立后端三级抽象表模型，并编写一个 Python 脚本或 Go 函数，能够将给定的 `.srt` 英文歌词/字幕文件自动拆解清洗，转化为 `chunks` 和 `content_nodes` 的正序序列写入数据库。请完整输出，不要省略任何字段。”
>