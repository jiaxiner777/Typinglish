import type { ChunkRow, ContentNodeRow, SourceRow, UserProgressRow } from "./types.js";

const now = new Date().toISOString();

export const demoUserId = "00000000-0000-4000-8000-000000000001";

export const sources: SourceRow[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    slug: "manhattan-starter-pack",
    title: "Manhattan Starter Pack",
    type: "SERIES",
    cover_url: "https://images.unsplash.com/photo-1518391846015-55a9cc003b25?auto=format&fit=crop&w=1200&q=80",
    is_active: true,
    metadata: { season: 1, tone: "sitcom", cefr: "A2-B1" },
    created_at: now
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    slug: "geek-typing-core",
    title: "Geek Typing Core",
    type: "VOCAB",
    cover_url: "https://images.unsplash.com/photo-1515879218367-8466d910aaa4?auto=format&fit=crop&w=1200&q=80",
    is_active: true,
    metadata: { audience: "developers", symbols: true },
    created_at: now
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    slug: "the-lantern-room",
    title: "The Lantern Room",
    type: "BOOK",
    cover_url: null,
    is_active: true,
    metadata: { genre: "short story", level: "B1", minutes: 8 },
    created_at: now
  },
  {
    id: "44444444-4444-4444-8444-444444444444",
    slug: "letters-from-tomorrow",
    title: "Letters from Tomorrow",
    type: "BOOK",
    cover_url: null,
    is_active: true,
    metadata: { genre: "soft sci-fi", level: "B1-B2", minutes: 10 },
    created_at: now
  },
  {
    id: "55555555-5555-4555-8555-555555555555",
    slug: "a-study-in-clear-weather",
    title: "A Study in Clear Weather",
    type: "BOOK",
    cover_url: null,
    is_active: true,
    metadata: { genre: "workplace essay", level: "B2", minutes: 7 },
    created_at: now
  }
];

export const chunks: ChunkRow[] = [
  {
    id: "aaaaaaaa-0001-4000-8000-000000000001",
    source_id: sources[0].id,
    chapter_num: 1,
    section_num: 1,
    title: "Coffee Shop Hello",
    dependencies: [],
    map_zone: "central-perk",
    map_pos_x: 0,
    map_pos_y: 0,
    word_count: 24,
    created_at: now
  },
  {
    id: "aaaaaaaa-0002-4000-8000-000000000002",
    source_id: sources[0].id,
    chapter_num: 1,
    section_num: 2,
    title: "Small Talk Sprint",
    dependencies: ["aaaaaaaa-0001-4000-8000-000000000001"],
    map_zone: "central-perk",
    map_pos_x: 1,
    map_pos_y: 1,
    word_count: 31,
    created_at: now
  },
  {
    id: "aaaaaaaa-0003-4000-8000-000000000003",
    source_id: sources[0].id,
    chapter_num: 1,
    section_num: 3,
    title: "Office Update",
    dependencies: ["aaaaaaaa-0002-4000-8000-000000000002"],
    map_zone: "midtown",
    map_pos_x: -1,
    map_pos_y: 2,
    word_count: 34,
    created_at: now
  },
  {
    id: "aaaaaaaa-0004-4000-8000-000000000004",
    source_id: sources[0].id,
    chapter_num: 1,
    section_num: 4,
    title: "Deadline Drama",
    dependencies: ["aaaaaaaa-0003-4000-8000-000000000003"],
    map_zone: "midtown",
    map_pos_x: 1,
    map_pos_y: 3,
    word_count: 30,
    created_at: now
  },
  {
    id: "bbbbbbbb-0001-4000-8000-000000000001",
    source_id: sources[1].id,
    chapter_num: 1,
    section_num: 1,
    title: "Async Vocabulary",
    dependencies: [],
    map_zone: "terminal",
    map_pos_x: 0,
    map_pos_y: 0,
    word_count: 28,
    created_at: now
  },
  {
    id: "cccccccc-0001-4000-8000-000000000001",
    source_id: sources[2].id,
    chapter_num: 1,
    section_num: 1,
    title: "A Light Behind the Wall",
    dependencies: [],
    map_zone: "zen-library",
    map_pos_x: 0,
    map_pos_y: 0,
    word_count: 148,
    created_at: now
  },
  {
    id: "cccccccc-0002-4000-8000-000000000002",
    source_id: sources[2].id,
    chapter_num: 1,
    section_num: 2,
    title: "The Last Train Home",
    dependencies: ["cccccccc-0001-4000-8000-000000000001"],
    map_zone: "zen-library",
    map_pos_x: 0,
    map_pos_y: 1,
    word_count: 142,
    created_at: now
  },
  {
    id: "dddddddd-0001-4000-8000-000000000001",
    source_id: sources[3].id,
    chapter_num: 1,
    section_num: 1,
    title: "The First Letter",
    dependencies: [],
    map_zone: "zen-library",
    map_pos_x: 0,
    map_pos_y: 0,
    word_count: 153,
    created_at: now
  },
  {
    id: "dddddddd-0002-4000-8000-000000000002",
    source_id: sources[3].id,
    chapter_num: 1,
    section_num: 2,
    title: "A Reply in Blue Ink",
    dependencies: ["dddddddd-0001-4000-8000-000000000001"],
    map_zone: "zen-library",
    map_pos_x: 0,
    map_pos_y: 1,
    word_count: 139,
    created_at: now
  },
  {
    id: "eeeeeeee-0001-4000-8000-000000000001",
    source_id: sources[4].id,
    chapter_num: 1,
    section_num: 1,
    title: "The Quiet List",
    dependencies: [],
    map_zone: "zen-library",
    map_pos_x: 0,
    map_pos_y: 0,
    word_count: 132,
    created_at: now
  },
  {
    id: "aaaaaaaa-0005-4000-8000-000000000005",
    source_id: sources[0].id,
    chapter_num: 1,
    section_num: 5,
    title: "Subway Directions",
    dependencies: ["aaaaaaaa-0004-4000-8000-000000000004"],
    map_zone: "subway",
    map_pos_x: -1,
    map_pos_y: 4,
    word_count: 36,
    created_at: now
  },
  {
    id: "aaaaaaaa-0006-4000-8000-000000000006",
    source_id: sources[0].id,
    chapter_num: 1,
    section_num: 6,
    title: "Dinner Plans",
    dependencies: ["aaaaaaaa-0005-4000-8000-000000000005"],
    map_zone: "downtown",
    map_pos_x: 1,
    map_pos_y: 5,
    word_count: 38,
    created_at: now
  },
  {
    id: "aaaaaaaa-0007-4000-8000-000000000007",
    source_id: sources[0].id,
    chapter_num: 1,
    section_num: 7,
    title: "Tiny Apology",
    dependencies: ["aaaaaaaa-0006-4000-8000-000000000006"],
    map_zone: "downtown",
    map_pos_x: 0,
    map_pos_y: 6,
    word_count: 34,
    created_at: now
  },
  {
    id: "aaaaaaaa-0008-4000-8000-000000000008",
    source_id: sources[0].id,
    chapter_num: 1,
    section_num: 8,
    title: "Rooftop Toast",
    dependencies: ["aaaaaaaa-0007-4000-8000-000000000007"],
    map_zone: "rooftop",
    map_pos_x: 1,
    map_pos_y: 7,
    word_count: 35,
    created_at: now
  },
  {
    id: "bbbbbbbb-0002-4000-8000-000000000002",
    source_id: sources[1].id,
    chapter_num: 1,
    section_num: 2,
    title: "Terminal Sprint",
    dependencies: ["bbbbbbbb-0001-4000-8000-000000000001"],
    map_zone: "terminal",
    map_pos_x: 1,
    map_pos_y: 1,
    word_count: 32,
    created_at: now
  },
  {
    id: "bbbbbbbb-0003-4000-8000-000000000003",
    source_id: sources[1].id,
    chapter_num: 1,
    section_num: 3,
    title: "API Review",
    dependencies: ["bbbbbbbb-0002-4000-8000-000000000002"],
    map_zone: "backend",
    map_pos_x: -1,
    map_pos_y: 2,
    word_count: 36,
    created_at: now
  },
  {
    id: "bbbbbbbb-0004-4000-8000-000000000004",
    source_id: sources[1].id,
    chapter_num: 1,
    section_num: 4,
    title: "Release Notes",
    dependencies: ["bbbbbbbb-0003-4000-8000-000000000003"],
    map_zone: "release",
    map_pos_x: 1,
    map_pos_y: 3,
    word_count: 34,
    created_at: now
  }
];

export const contentNodes: ContentNodeRow[] = [
  {
    id: "c0000000-0001-4000-8000-000000000001",
    chunk_id: chunks[0].id,
    sequence: 1,
    raw_text: "Hey, how are you doing today?",
    clean_text: "Hey, how are you doing today?",
    translation: "嘿，今天过得怎么样？",
    audio_url: null
  },
  {
    id: "c0000000-0002-4000-8000-000000000002",
    chunk_id: chunks[0].id,
    sequence: 2,
    raw_text: "I saved you a seat by the window.",
    clean_text: "I saved you a seat by the window.",
    translation: "我给你留了靠窗的位置。",
    audio_url: null
  },
  {
    id: "c0000000-0003-4000-8000-000000000003",
    chunk_id: chunks[1].id,
    sequence: 1,
    raw_text: "That meeting could have been an email.",
    clean_text: "That meeting could have been an email.",
    translation: "那个会议完全可以用邮件解决。",
    audio_url: null
  },
  {
    id: "c0000000-0004-4000-8000-000000000004",
    chunk_id: chunks[1].id,
    sequence: 2,
    raw_text: "Anyway, let's grab coffee before the next call.",
    clean_text: "Anyway, let's grab coffee before the next call.",
    translation: "总之，下个电话会议前我们去买咖啡吧。",
    audio_url: null
  },
  {
    id: "c0000000-0005-4000-8000-000000000005",
    chunk_id: chunks[2].id,
    sequence: 1,
    raw_text: "The draft is ready, but the numbers need another pass.",
    clean_text: "The draft is ready, but the numbers need another pass.",
    translation: "草稿准备好了，但数字还需要再检查一遍。",
    audio_url: null
  },
  {
    id: "c0000000-0006-4000-8000-000000000006",
    chunk_id: chunks[2].id,
    sequence: 2,
    raw_text: "Please send me the final version before noon.",
    clean_text: "Please send me the final version before noon.",
    translation: "请在中午前把最终版本发给我。",
    audio_url: null
  },
  {
    id: "c0000000-0007-4000-8000-000000000007",
    chunk_id: chunks[3].id,
    sequence: 1,
    raw_text: "We are close, but the deadline is closer.",
    clean_text: "We are close, but the deadline is closer.",
    translation: "我们快完成了，但截止时间更近。",
    audio_url: null
  },
  {
    id: "c0000000-0008-4000-8000-000000000008",
    chunk_id: chunks[3].id,
    sequence: 2,
    raw_text: "Focus on the paragraph that changes the decision.",
    clean_text: "Focus on the paragraph that changes the decision.",
    translation: "专注于那段会改变决定的文字。",
    audio_url: null
  },
  {
    id: "c0000000-0009-4000-8000-000000000009",
    chunk_id: chunks[4].id,
    sequence: 1,
    raw_text: "Asynchronous code rewards clear naming and patient debugging.",
    clean_text: "Asynchronous code rewards clear naming and patient debugging.",
    translation: "异步代码会奖励清晰命名和耐心调试。",
    audio_url: null
  },
  {
    id: "c0000000-0010-4000-8000-000000000010",
    chunk_id: chunks[4].id,
    sequence: 2,
    raw_text: "Ship the smallest useful commit, then improve the interface.",
    clean_text: "Ship the smallest useful commit, then improve the interface.",
    translation: "先提交最小可用改动，再改善接口。",
    audio_url: null
  },
  {
    id: "f0000000-0001-4000-8000-000000000001",
    chunk_id: chunks[5].id,
    sequence: 1,
    raw_text: "Mara found the lantern room behind a shelf of broken clocks.",
    clean_text: "Mara found the lantern room behind a shelf of broken clocks.",
    translation: null,
    audio_url: null
  },
  {
    id: "f0000000-0002-4000-8000-000000000002",
    chunk_id: chunks[5].id,
    sequence: 2,
    raw_text: "The room was narrow, warm, and perfectly silent, as if the house had been holding its breath.",
    clean_text: "The room was narrow, warm, and perfectly silent, as if the house had been holding its breath.",
    translation: null,
    audio_url: null
  },
  {
    id: "f0000000-0003-4000-8000-000000000003",
    chunk_id: chunks[5].id,
    sequence: 3,
    raw_text: "On the table stood a brass lantern with a glass heart full of green fire.",
    clean_text: "On the table stood a brass lantern with a glass heart full of green fire.",
    translation: null,
    audio_url: null
  },
  {
    id: "f0000000-0004-4000-8000-000000000004",
    chunk_id: chunks[5].id,
    sequence: 4,
    raw_text: "When she lifted it, every clock in the hall began to tick in the same slow rhythm.",
    clean_text: "When she lifted it, every clock in the hall began to tick in the same slow rhythm.",
    translation: null,
    audio_url: null
  },
  {
    id: "f0000000-0005-4000-8000-000000000005",
    chunk_id: chunks[5].id,
    sequence: 5,
    raw_text: "Mara did not run, because the sound was not frightening.",
    clean_text: "Mara did not run, because the sound was not frightening.",
    translation: null,
    audio_url: null
  },
  {
    id: "f0000000-0006-4000-8000-000000000006",
    chunk_id: chunks[5].id,
    sequence: 6,
    raw_text: "It sounded like a hundred tiny doors opening somewhere inside the walls.",
    clean_text: "It sounded like a hundred tiny doors opening somewhere inside the walls.",
    translation: null,
    audio_url: null
  },
  {
    id: "f0000000-0007-4000-8000-000000000007",
    chunk_id: chunks[5].id,
    sequence: 7,
    raw_text: "At the far end of the room, a map unfolded itself across the floor.",
    clean_text: "At the far end of the room, a map unfolded itself across the floor.",
    translation: null,
    audio_url: null
  },
  {
    id: "f0000000-0008-4000-8000-000000000008",
    chunk_id: chunks[5].id,
    sequence: 8,
    raw_text: "The map showed streets she knew, but each street was drawn under a different moon.",
    clean_text: "The map showed streets she knew, but each street was drawn under a different moon.",
    translation: null,
    audio_url: null
  },
  {
    id: "f0000000-0009-4000-8000-000000000009",
    chunk_id: chunks[5].id,
    sequence: 9,
    raw_text: "She touched the nearest corner, and the lantern answered with a quiet pulse of light.",
    clean_text: "She touched the nearest corner, and the lantern answered with a quiet pulse of light.",
    translation: null,
    audio_url: null
  },
  {
    id: "f0000000-0010-4000-8000-000000000010",
    chunk_id: chunks[5].id,
    sequence: 10,
    raw_text: "For the first time all winter, Mara felt that getting lost might be a kind of invitation.",
    clean_text: "For the first time all winter, Mara felt that getting lost might be a kind of invitation.",
    translation: null,
    audio_url: null
  },
  {
    id: "f0000000-0011-4000-8000-000000000011",
    chunk_id: chunks[6].id,
    sequence: 1,
    raw_text: "The last train home arrived without a sound.",
    clean_text: "The last train home arrived without a sound.",
    translation: null,
    audio_url: null
  },
  {
    id: "f0000000-0012-4000-8000-000000000012",
    chunk_id: chunks[6].id,
    sequence: 2,
    raw_text: "Its windows reflected the platform lights, but no faces waited behind the glass.",
    clean_text: "Its windows reflected the platform lights, but no faces waited behind the glass.",
    translation: null,
    audio_url: null
  },
  {
    id: "f0000000-0013-4000-8000-000000000013",
    chunk_id: chunks[6].id,
    sequence: 3,
    raw_text: "Jon stepped inside with his umbrella dripping on the metal floor.",
    clean_text: "Jon stepped inside with his umbrella dripping on the metal floor.",
    translation: null,
    audio_url: null
  },
  {
    id: "f0000000-0014-4000-8000-000000000014",
    chunk_id: chunks[6].id,
    sequence: 4,
    raw_text: "A paper ticket lay on the nearest seat, already punched with tomorrow's date.",
    clean_text: "A paper ticket lay on the nearest seat, already punched with tomorrow's date.",
    translation: null,
    audio_url: null
  },
  {
    id: "f0000000-0015-4000-8000-000000000015",
    chunk_id: chunks[6].id,
    sequence: 5,
    raw_text: "He looked back at the station, but the platform had become a thin line of rain.",
    clean_text: "He looked back at the station, but the platform had become a thin line of rain.",
    translation: null,
    audio_url: null
  },
  {
    id: "f0000000-0016-4000-8000-000000000016",
    chunk_id: chunks[6].id,
    sequence: 6,
    raw_text: "The train moved before he could decide whether to leave.",
    clean_text: "The train moved before he could decide whether to leave.",
    translation: null,
    audio_url: null
  },
  {
    id: "f0000000-0017-4000-8000-000000000017",
    chunk_id: chunks[6].id,
    sequence: 7,
    raw_text: "Beyond the tunnel, the city opened like a book he had once forgotten how to read.",
    clean_text: "Beyond the tunnel, the city opened like a book he had once forgotten how to read.",
    translation: null,
    audio_url: null
  },
  {
    id: "f0000000-0018-4000-8000-000000000018",
    chunk_id: chunks[6].id,
    sequence: 8,
    raw_text: "Every window was bright, and every street seemed to be waiting for his answer.",
    clean_text: "Every window was bright, and every street seemed to be waiting for his answer.",
    translation: null,
    audio_url: null
  },
  {
    id: "f0000000-0019-4000-8000-000000000019",
    chunk_id: chunks[7].id,
    sequence: 1,
    raw_text: "Dear Ada, if this letter reaches you, the machine works.",
    clean_text: "Dear Ada, if this letter reaches you, the machine works.",
    translation: null,
    audio_url: null
  },
  {
    id: "f0000000-0020-4000-8000-000000000020",
    chunk_id: chunks[7].id,
    sequence: 2,
    raw_text: "I am writing from the same apartment, but the city outside is thirty years older.",
    clean_text: "I am writing from the same apartment, but the city outside is thirty years older.",
    translation: null,
    audio_url: null
  },
  {
    id: "f0000000-0021-4000-8000-000000000021",
    chunk_id: chunks[7].id,
    sequence: 3,
    raw_text: "The river is cleaner, the bridges are covered with gardens, and nobody pays for the bus.",
    clean_text: "The river is cleaner, the bridges are covered with gardens, and nobody pays for the bus.",
    translation: null,
    audio_url: null
  },
  {
    id: "f0000000-0022-4000-8000-000000000022",
    chunk_id: chunks[7].id,
    sequence: 4,
    raw_text: "Do not be impressed too quickly; the coffee is still terrible.",
    clean_text: "Do not be impressed too quickly; the coffee is still terrible.",
    translation: null,
    audio_url: null
  },
  {
    id: "f0000000-0023-4000-8000-000000000023",
    chunk_id: chunks[7].id,
    sequence: 5,
    raw_text: "I have learned that the future is not a place where problems disappear.",
    clean_text: "I have learned that the future is not a place where problems disappear.",
    translation: null,
    audio_url: null
  },
  {
    id: "f0000000-0024-4000-8000-000000000024",
    chunk_id: chunks[7].id,
    sequence: 6,
    raw_text: "It is a place where old problems wear cleaner clothes and speak in calmer voices.",
    clean_text: "It is a place where old problems wear cleaner clothes and speak in calmer voices.",
    translation: null,
    audio_url: null
  },
  {
    id: "f0000000-0025-4000-8000-000000000025",
    chunk_id: chunks[7].id,
    sequence: 7,
    raw_text: "Still, there is one good thing I can promise you.",
    clean_text: "Still, there is one good thing I can promise you.",
    translation: null,
    audio_url: null
  },
  {
    id: "f0000000-0026-4000-8000-000000000026",
    chunk_id: chunks[7].id,
    sequence: 8,
    raw_text: "The work you are afraid to start will matter more than you think.",
    clean_text: "The work you are afraid to start will matter more than you think.",
    translation: null,
    audio_url: null
  },
  {
    id: "f0000000-0027-4000-8000-000000000027",
    chunk_id: chunks[7].id,
    sequence: 9,
    raw_text: "Begin before you feel ready, and keep the blue notebook.",
    clean_text: "Begin before you feel ready, and keep the blue notebook.",
    translation: null,
    audio_url: null
  },
  {
    id: "f0000000-0028-4000-8000-000000000028",
    chunk_id: chunks[8].id,
    sequence: 1,
    raw_text: "Ada read the letter twice, then placed it under a cup so it would not vanish.",
    clean_text: "Ada read the letter twice, then placed it under a cup so it would not vanish.",
    translation: null,
    audio_url: null
  },
  {
    id: "f0000000-0029-4000-8000-000000000029",
    chunk_id: chunks[8].id,
    sequence: 2,
    raw_text: "The paper smelled faintly of rain and electrical dust.",
    clean_text: "The paper smelled faintly of rain and electrical dust.",
    translation: null,
    audio_url: null
  },
  {
    id: "f0000000-0030-4000-8000-000000000030",
    chunk_id: chunks[8].id,
    sequence: 3,
    raw_text: "She wanted to laugh, but the blue notebook was already on her desk.",
    clean_text: "She wanted to laugh, but the blue notebook was already on her desk.",
    translation: null,
    audio_url: null
  },
  {
    id: "f0000000-0031-4000-8000-000000000031",
    chunk_id: chunks[8].id,
    sequence: 4,
    raw_text: "For months she had filled it with sketches, questions, and careful excuses.",
    clean_text: "For months she had filled it with sketches, questions, and careful excuses.",
    translation: null,
    audio_url: null
  },
  {
    id: "f0000000-0032-4000-8000-000000000032",
    chunk_id: chunks[8].id,
    sequence: 5,
    raw_text: "Now the excuses looked smaller than the questions.",
    clean_text: "Now the excuses looked smaller than the questions.",
    translation: null,
    audio_url: null
  },
  {
    id: "f0000000-0033-4000-8000-000000000033",
    chunk_id: chunks[8].id,
    sequence: 6,
    raw_text: "She opened a new page and wrote the date at the top.",
    clean_text: "She opened a new page and wrote the date at the top.",
    translation: null,
    audio_url: null
  },
  {
    id: "f0000000-0034-4000-8000-000000000034",
    chunk_id: chunks[8].id,
    sequence: 7,
    raw_text: "Then she wrote one sentence, crossed it out, and wrote a better one.",
    clean_text: "Then she wrote one sentence, crossed it out, and wrote a better one.",
    translation: null,
    audio_url: null
  },
  {
    id: "f0000000-0035-4000-8000-000000000035",
    chunk_id: chunks[9].id,
    sequence: 1,
    raw_text: "Clear work rarely begins with a clear mind.",
    clean_text: "Clear work rarely begins with a clear mind.",
    translation: null,
    audio_url: null
  },
  {
    id: "f0000000-0036-4000-8000-000000000036",
    chunk_id: chunks[9].id,
    sequence: 2,
    raw_text: "It begins with a small list that refuses to become dramatic.",
    clean_text: "It begins with a small list that refuses to become dramatic.",
    translation: null,
    audio_url: null
  },
  {
    id: "f0000000-0037-4000-8000-000000000037",
    chunk_id: chunks[9].id,
    sequence: 3,
    raw_text: "Write the next visible action, not the entire ambition.",
    clean_text: "Write the next visible action, not the entire ambition.",
    translation: null,
    audio_url: null
  },
  {
    id: "f0000000-0038-4000-8000-000000000038",
    chunk_id: chunks[9].id,
    sequence: 4,
    raw_text: "A useful list does not flatter you with a fantasy of perfect focus.",
    clean_text: "A useful list does not flatter you with a fantasy of perfect focus.",
    translation: null,
    audio_url: null
  },
  {
    id: "f0000000-0039-4000-8000-000000000039",
    chunk_id: chunks[9].id,
    sequence: 5,
    raw_text: "It gives your attention a place to land when the day becomes noisy.",
    clean_text: "It gives your attention a place to land when the day becomes noisy.",
    translation: null,
    audio_url: null
  },
  {
    id: "f0000000-0040-4000-8000-000000000040",
    chunk_id: chunks[9].id,
    sequence: 6,
    raw_text: "If a task takes less than two minutes, do it before naming it.",
    clean_text: "If a task takes less than two minutes, do it before naming it.",
    translation: null,
    audio_url: null
  },
  {
    id: "f0000000-0041-4000-8000-000000000041",
    chunk_id: chunks[9].id,
    sequence: 7,
    raw_text: "If it takes longer, give it a verb, a boundary, and a time to return.",
    clean_text: "If it takes longer, give it a verb, a boundary, and a time to return.",
    translation: null,
    audio_url: null
  },
  {
    id: "f0000000-0042-4000-8000-000000000042",
    chunk_id: chunks[9].id,
    sequence: 8,
    raw_text: "The list is not your life; it is only a railing beside the stairs.",
    clean_text: "The list is not your life; it is only a railing beside the stairs.",
    translation: null,
    audio_url: null
  },
  {
    id: "c0000000-0011-4000-8000-000000000011",
    chunk_id: "aaaaaaaa-0005-4000-8000-000000000005",
    sequence: 1,
    raw_text: "Take the downtown train, then change at West Fourth Street.",
    clean_text: "Take the downtown train, then change at West Fourth Street.",
    translation: "坐市中心方向的车，然后在西四街换乘。",
    audio_url: null
  },
  {
    id: "c0000000-0012-4000-8000-000000000012",
    chunk_id: "aaaaaaaa-0005-4000-8000-000000000005",
    sequence: 2,
    raw_text: "If you miss the stop, text me and I will walk back to meet you.",
    clean_text: "If you miss the stop, text me and I will walk back to meet you.",
    translation: "如果你坐过站了，发消息给我，我会走回来接你。",
    audio_url: null
  },
  {
    id: "c0000000-0013-4000-8000-000000000013",
    chunk_id: "aaaaaaaa-0006-4000-8000-000000000006",
    sequence: 1,
    raw_text: "I booked a table, but they only had a spot near the kitchen.",
    clean_text: "I booked a table, but they only had a spot near the kitchen.",
    translation: "我订了桌，但他们只剩靠近厨房的位置。",
    audio_url: null
  },
  {
    id: "c0000000-0014-4000-8000-000000000014",
    chunk_id: "aaaaaaaa-0006-4000-8000-000000000006",
    sequence: 2,
    raw_text: "That's fine, as long as the bread arrives before the stories do.",
    clean_text: "That's fine, as long as the bread arrives before the stories do.",
    translation: "没关系，只要面包比故事先上桌就行。",
    audio_url: null
  },
  {
    id: "c0000000-0015-4000-8000-000000000015",
    chunk_id: "aaaaaaaa-0007-4000-8000-000000000007",
    sequence: 1,
    raw_text: "I was trying to be helpful, but I made everything louder.",
    clean_text: "I was trying to be helpful, but I made everything louder.",
    translation: "我本来想帮忙，但我把事情弄得更吵了。",
    audio_url: null
  },
  {
    id: "c0000000-0016-4000-8000-000000000016",
    chunk_id: "aaaaaaaa-0007-4000-8000-000000000007",
    sequence: 2,
    raw_text: "Let me start again, this time with listening instead of advice.",
    clean_text: "Let me start again, this time with listening instead of advice.",
    translation: "让我重新来一次，这次先倾听，而不是先建议。",
    audio_url: null
  },
  {
    id: "c0000000-0017-4000-8000-000000000017",
    chunk_id: "aaaaaaaa-0008-4000-8000-000000000008",
    sequence: 1,
    raw_text: "To small victories, late trains, and friends who still show up.",
    clean_text: "To small victories, late trains, and friends who still show up.",
    translation: "敬小小的胜利、晚点的列车，以及仍然出现的朋友。",
    audio_url: null
  },
  {
    id: "c0000000-0018-4000-8000-000000000018",
    chunk_id: "aaaaaaaa-0008-4000-8000-000000000008",
    sequence: 2,
    raw_text: "The city looked less impossible from above, almost like a promise.",
    clean_text: "The city looked less impossible from above, almost like a promise.",
    translation: "从高处看，这座城市没那么不可能，几乎像一个承诺。",
    audio_url: null
  },
  {
    id: "c0000000-0019-4000-8000-000000000019",
    chunk_id: "bbbbbbbb-0002-4000-8000-000000000002",
    sequence: 1,
    raw_text: "Run the test locally, read the failure, and change one thing.",
    clean_text: "Run the test locally, read the failure, and change one thing.",
    translation: "本地运行测试，读懂失败原因，然后只改一件事。",
    audio_url: null
  },
  {
    id: "c0000000-0020-4000-8000-000000000020",
    chunk_id: "bbbbbbbb-0002-4000-8000-000000000002",
    sequence: 2,
    raw_text: "A calm terminal is usually the result of many noisy attempts.",
    clean_text: "A calm terminal is usually the result of many noisy attempts.",
    translation: "平静的终端通常来自很多吵闹的尝试。",
    audio_url: null
  },
  {
    id: "c0000000-0021-4000-8000-000000000021",
    chunk_id: "bbbbbbbb-0003-4000-8000-000000000003",
    sequence: 1,
    raw_text: "The endpoint is simple, but the contract must be boring and clear.",
    clean_text: "The endpoint is simple, but the contract must be boring and clear.",
    translation: "接口可以简单，但契约必须朴素清楚。",
    audio_url: null
  },
  {
    id: "c0000000-0022-4000-8000-000000000022",
    chunk_id: "bbbbbbbb-0003-4000-8000-000000000003",
    sequence: 2,
    raw_text: "Good names make future debugging feel less like archaeology.",
    clean_text: "Good names make future debugging feel less like archaeology.",
    translation: "好的命名会让未来调试不像考古。",
    audio_url: null
  },
  {
    id: "c0000000-0023-4000-8000-000000000023",
    chunk_id: "bbbbbbbb-0004-4000-8000-000000000004",
    sequence: 1,
    raw_text: "Write the release note for the person who opens it on Friday.",
    clean_text: "Write the release note for the person who opens it on Friday.",
    translation: "给周五打开它的人写发布说明。",
    audio_url: null
  },
  {
    id: "c0000000-0024-4000-8000-000000000024",
    chunk_id: "bbbbbbbb-0004-4000-8000-000000000004",
    sequence: 2,
    raw_text: "Tell them what changed, why it matters, and what to watch next.",
    clean_text: "Tell them what changed, why it matters, and what to watch next.",
    translation: "告诉他们改了什么、为什么重要、接下来要注意什么。",
    audio_url: null
  }
];

export const progressRows: UserProgressRow[] = [
  {
    id: "dddddddd-0001-4000-8000-000000000001",
    user_id: demoUserId,
    chunk_id: chunks[0].id,
    highest_wpm: 62,
    highest_accuracy: 98.4,
    stars_earned: 3,
    last_node_sequence: 2,
    is_completed: true,
    updated_at: now
  }
];
