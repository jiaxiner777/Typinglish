package main

import (
	"context"
	"embed"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"log"
	"math"
	"net"
	"net/http"
	"os/exec"
	"runtime"
	"sort"
	"strings"
	"sync"
	"time"
)

//go:embed all:dist
var embeddedFiles embed.FS

const demoUserID = "00000000-0000-4000-8000-000000000001"

type source struct {
	ID        string         `json:"id"`
	Title     string         `json:"title"`
	Type      string         `json:"type"`
	CoverURL  *string        `json:"coverUrl"`
	IsActive  bool           `json:"isActive"`
	Metadata  map[string]any `json:"metadata"`
	CreatedAt string         `json:"createdAt"`
}

type chunk struct {
	ID           string   `json:"id"`
	SourceID     string   `json:"sourceId"`
	ChapterNum   int      `json:"chapterNum"`
	SectionNum   int      `json:"sectionNum"`
	Title        string   `json:"title"`
	Dependencies []string `json:"dependencies"`
	MapZone      string   `json:"mapZone"`
	MapPosX      int      `json:"mapPosX"`
	MapPosY      int      `json:"mapPosY"`
	WordCount    int      `json:"wordCount"`
	CreatedAt    string   `json:"createdAt"`
}

type contentNode struct {
	ID          string  `json:"id"`
	ChunkID     string  `json:"chunkId"`
	Sequence    int     `json:"sequence"`
	RawText     string  `json:"rawText"`
	CleanText   string  `json:"cleanText"`
	Translation *string `json:"translation"`
	AudioURL    *string `json:"audioUrl"`
}

type progress struct {
	ID               string  `json:"id"`
	UserID           string  `json:"userId"`
	ChunkID          string  `json:"chunkId"`
	HighestWPM       float64 `json:"highestWpm"`
	HighestAccuracy  float64 `json:"highestAccuracy"`
	StarsEarned      int     `json:"starsEarned"`
	LastNodeSequence int     `json:"lastNodeSequence"`
	IsCompleted      bool    `json:"isCompleted"`
	UpdatedAt        string  `json:"updatedAt"`
}

type progressReport struct {
	ChunkID    string  `json:"chunk_id"`
	WPM        float64 `json:"wpm"`
	Accuracy   float64 `json:"accuracy"`
	CurrentSeq int     `json:"current_seq"`
}

type mapChunk struct {
	chunk
	Progress mapProgress `json:"progress"`
	Locked   bool        `json:"locked"`
}

type mapProgress struct {
	StarsEarned      int     `json:"starsEarned"`
	IsCompleted      bool    `json:"isCompleted"`
	HighestWPM       float64 `json:"highestWpm"`
	HighestAccuracy  float64 `json:"highestAccuracy"`
	LastNodeSequence int     `json:"lastNodeSequence"`
}

type repository struct {
	mu       sync.Mutex
	sources  []source
	chunks   []chunk
	nodes    []contentNode
	progress []progress
}

func ptr(text string) *string {
	return &text
}

func newRepository() *repository {
	now := time.Now().Format(time.RFC3339)
	sources := []source{
		{
			ID:        "11111111-1111-4111-8111-111111111111",
			Title:     "Manhattan Starter Pack",
			Type:      "SERIES",
			CoverURL:  ptr("https://images.unsplash.com/photo-1518391846015-55a9cc003b25?auto=format&fit=crop&w=1200&q=80"),
			IsActive:  true,
			Metadata:  map[string]any{"season": 1, "tone": "sitcom", "cefr": "A2-B1"},
			CreatedAt: now,
		},
		{
			ID:        "22222222-2222-4222-8222-222222222222",
			Title:     "Geek Typing Core",
			Type:      "VOCAB",
			CoverURL:  ptr("https://images.unsplash.com/photo-1515879218367-8466d910aaa4?auto=format&fit=crop&w=1200&q=80"),
			IsActive:  true,
			Metadata:  map[string]any{"audience": "developers", "symbols": true},
			CreatedAt: now,
		},
		{ID: "33333333-3333-4333-8333-333333333333", Title: "The Lantern Room", Type: "BOOK", IsActive: true, Metadata: map[string]any{"genre": "short story", "level": "B1", "minutes": 8}, CreatedAt: now},
		{ID: "44444444-4444-4444-8444-444444444444", Title: "Letters from Tomorrow", Type: "BOOK", IsActive: true, Metadata: map[string]any{"genre": "soft sci-fi", "level": "B1-B2", "minutes": 10}, CreatedAt: now},
		{ID: "55555555-5555-4555-8555-555555555555", Title: "A Study in Clear Weather", Type: "BOOK", IsActive: true, Metadata: map[string]any{"genre": "workplace essay", "level": "B2", "minutes": 7}, CreatedAt: now},
	}

	chunks := []chunk{
		{ID: "aaaaaaaa-0001-4000-8000-000000000001", SourceID: sources[0].ID, ChapterNum: 1, SectionNum: 1, Title: "Coffee Shop Hello", Dependencies: []string{}, MapZone: "central-perk", MapPosX: 0, MapPosY: 0, WordCount: 24, CreatedAt: now},
		{ID: "aaaaaaaa-0002-4000-8000-000000000002", SourceID: sources[0].ID, ChapterNum: 1, SectionNum: 2, Title: "Small Talk Sprint", Dependencies: []string{"aaaaaaaa-0001-4000-8000-000000000001"}, MapZone: "central-perk", MapPosX: 1, MapPosY: 1, WordCount: 31, CreatedAt: now},
		{ID: "aaaaaaaa-0003-4000-8000-000000000003", SourceID: sources[0].ID, ChapterNum: 1, SectionNum: 3, Title: "Office Update", Dependencies: []string{"aaaaaaaa-0002-4000-8000-000000000002"}, MapZone: "midtown", MapPosX: -1, MapPosY: 2, WordCount: 34, CreatedAt: now},
		{ID: "aaaaaaaa-0004-4000-8000-000000000004", SourceID: sources[0].ID, ChapterNum: 1, SectionNum: 4, Title: "Deadline Drama", Dependencies: []string{"aaaaaaaa-0003-4000-8000-000000000003"}, MapZone: "midtown", MapPosX: 1, MapPosY: 3, WordCount: 30, CreatedAt: now},
		{ID: "bbbbbbbb-0001-4000-8000-000000000001", SourceID: sources[1].ID, ChapterNum: 1, SectionNum: 1, Title: "Async Vocabulary", Dependencies: []string{}, MapZone: "terminal", MapPosX: 0, MapPosY: 0, WordCount: 28, CreatedAt: now},
		{ID: "cccccccc-0001-4000-8000-000000000001", SourceID: sources[2].ID, ChapterNum: 1, SectionNum: 1, Title: "A Light Behind the Wall", Dependencies: []string{}, MapZone: "zen-library", MapPosX: 0, MapPosY: 0, WordCount: 148, CreatedAt: now},
		{ID: "cccccccc-0002-4000-8000-000000000002", SourceID: sources[2].ID, ChapterNum: 1, SectionNum: 2, Title: "The Last Train Home", Dependencies: []string{"cccccccc-0001-4000-8000-000000000001"}, MapZone: "zen-library", MapPosX: 0, MapPosY: 1, WordCount: 142, CreatedAt: now},
		{ID: "dddddddd-0001-4000-8000-000000000001", SourceID: sources[3].ID, ChapterNum: 1, SectionNum: 1, Title: "The First Letter", Dependencies: []string{}, MapZone: "zen-library", MapPosX: 0, MapPosY: 0, WordCount: 153, CreatedAt: now},
		{ID: "dddddddd-0002-4000-8000-000000000002", SourceID: sources[3].ID, ChapterNum: 1, SectionNum: 2, Title: "A Reply in Blue Ink", Dependencies: []string{"dddddddd-0001-4000-8000-000000000001"}, MapZone: "zen-library", MapPosX: 0, MapPosY: 1, WordCount: 139, CreatedAt: now},
		{ID: "eeeeeeee-0001-4000-8000-000000000001", SourceID: sources[4].ID, ChapterNum: 1, SectionNum: 1, Title: "The Quiet List", Dependencies: []string{}, MapZone: "zen-library", MapPosX: 0, MapPosY: 0, WordCount: 132, CreatedAt: now},
		{ID: "aaaaaaaa-0005-4000-8000-000000000005", SourceID: sources[0].ID, ChapterNum: 1, SectionNum: 5, Title: "Subway Directions", Dependencies: []string{"aaaaaaaa-0004-4000-8000-000000000004"}, MapZone: "subway", MapPosX: -1, MapPosY: 4, WordCount: 36, CreatedAt: now},
		{ID: "aaaaaaaa-0006-4000-8000-000000000006", SourceID: sources[0].ID, ChapterNum: 1, SectionNum: 6, Title: "Dinner Plans", Dependencies: []string{"aaaaaaaa-0005-4000-8000-000000000005"}, MapZone: "downtown", MapPosX: 1, MapPosY: 5, WordCount: 38, CreatedAt: now},
		{ID: "aaaaaaaa-0007-4000-8000-000000000007", SourceID: sources[0].ID, ChapterNum: 1, SectionNum: 7, Title: "Tiny Apology", Dependencies: []string{"aaaaaaaa-0006-4000-8000-000000000006"}, MapZone: "downtown", MapPosX: 0, MapPosY: 6, WordCount: 34, CreatedAt: now},
		{ID: "aaaaaaaa-0008-4000-8000-000000000008", SourceID: sources[0].ID, ChapterNum: 1, SectionNum: 8, Title: "Rooftop Toast", Dependencies: []string{"aaaaaaaa-0007-4000-8000-000000000007"}, MapZone: "rooftop", MapPosX: 1, MapPosY: 7, WordCount: 35, CreatedAt: now},
		{ID: "bbbbbbbb-0002-4000-8000-000000000002", SourceID: sources[1].ID, ChapterNum: 1, SectionNum: 2, Title: "Terminal Sprint", Dependencies: []string{"bbbbbbbb-0001-4000-8000-000000000001"}, MapZone: "terminal", MapPosX: 1, MapPosY: 1, WordCount: 32, CreatedAt: now},
		{ID: "bbbbbbbb-0003-4000-8000-000000000003", SourceID: sources[1].ID, ChapterNum: 1, SectionNum: 3, Title: "API Review", Dependencies: []string{"bbbbbbbb-0002-4000-8000-000000000002"}, MapZone: "backend", MapPosX: -1, MapPosY: 2, WordCount: 36, CreatedAt: now},
		{ID: "bbbbbbbb-0004-4000-8000-000000000004", SourceID: sources[1].ID, ChapterNum: 1, SectionNum: 4, Title: "Release Notes", Dependencies: []string{"bbbbbbbb-0003-4000-8000-000000000003"}, MapZone: "release", MapPosX: 1, MapPosY: 3, WordCount: 34, CreatedAt: now},
	}

	nodes := []contentNode{
		{ID: "c0000000-0001-4000-8000-000000000001", ChunkID: chunks[0].ID, Sequence: 1, RawText: "Hey, how are you doing today?", CleanText: "Hey, how are you doing today?", Translation: ptr("嘿，今天过得怎么样？")},
		{ID: "c0000000-0002-4000-8000-000000000002", ChunkID: chunks[0].ID, Sequence: 2, RawText: "I saved you a seat by the window.", CleanText: "I saved you a seat by the window.", Translation: ptr("我给你留了靠窗的位置。")},
		{ID: "c0000000-0003-4000-8000-000000000003", ChunkID: chunks[1].ID, Sequence: 1, RawText: "That meeting could have been an email.", CleanText: "That meeting could have been an email.", Translation: ptr("那个会议完全可以用邮件解决。")},
		{ID: "c0000000-0004-4000-8000-000000000004", ChunkID: chunks[1].ID, Sequence: 2, RawText: "Anyway, let's grab coffee before the next call.", CleanText: "Anyway, let's grab coffee before the next call.", Translation: ptr("总之，下个电话会议前我们去买咖啡吧。")},
		{ID: "c0000000-0005-4000-8000-000000000005", ChunkID: chunks[2].ID, Sequence: 1, RawText: "The draft is ready, but the numbers need another pass.", CleanText: "The draft is ready, but the numbers need another pass.", Translation: ptr("草稿准备好了，但数字还需要再检查一遍。")},
		{ID: "c0000000-0006-4000-8000-000000000006", ChunkID: chunks[2].ID, Sequence: 2, RawText: "Please send me the final version before noon.", CleanText: "Please send me the final version before noon.", Translation: ptr("请在中午前把最终版本发给我。")},
		{ID: "c0000000-0007-4000-8000-000000000007", ChunkID: chunks[3].ID, Sequence: 1, RawText: "We are close, but the deadline is closer.", CleanText: "We are close, but the deadline is closer.", Translation: ptr("我们快完成了，但截止时间更近。")},
		{ID: "c0000000-0008-4000-8000-000000000008", ChunkID: chunks[3].ID, Sequence: 2, RawText: "Focus on the paragraph that changes the decision.", CleanText: "Focus on the paragraph that changes the decision.", Translation: ptr("专注于那段会改变决定的文字。")},
		{ID: "c0000000-0009-4000-8000-000000000009", ChunkID: chunks[4].ID, Sequence: 1, RawText: "Asynchronous code rewards clear naming and patient debugging.", CleanText: "Asynchronous code rewards clear naming and patient debugging.", Translation: ptr("异步代码会奖励清晰命名和耐心调试。")},
		{ID: "c0000000-0010-4000-8000-000000000010", ChunkID: chunks[4].ID, Sequence: 2, RawText: "Ship the smallest useful commit, then improve the interface.", CleanText: "Ship the smallest useful commit, then improve the interface.", Translation: ptr("先提交最小可用改动，再改善接口。")},
		{ID: "z0000000-0001-4000-8000-000000000001", ChunkID: chunks[5].ID, Sequence: 1, RawText: "Mara found the lantern room behind a shelf of broken clocks.", CleanText: "Mara found the lantern room behind a shelf of broken clocks."},
		{ID: "z0000000-0002-4000-8000-000000000002", ChunkID: chunks[5].ID, Sequence: 2, RawText: "The room was narrow, warm, and perfectly silent, as if the house had been holding its breath.", CleanText: "The room was narrow, warm, and perfectly silent, as if the house had been holding its breath."},
		{ID: "z0000000-0003-4000-8000-000000000003", ChunkID: chunks[5].ID, Sequence: 3, RawText: "On the table stood a brass lantern with a glass heart full of green fire.", CleanText: "On the table stood a brass lantern with a glass heart full of green fire."},
		{ID: "z0000000-0004-4000-8000-000000000004", ChunkID: chunks[5].ID, Sequence: 4, RawText: "When she lifted it, every clock in the hall began to tick in the same slow rhythm.", CleanText: "When she lifted it, every clock in the hall began to tick in the same slow rhythm."},
		{ID: "z0000000-0005-4000-8000-000000000005", ChunkID: chunks[5].ID, Sequence: 5, RawText: "Mara did not run, because the sound was not frightening.", CleanText: "Mara did not run, because the sound was not frightening."},
		{ID: "z0000000-0006-4000-8000-000000000006", ChunkID: chunks[5].ID, Sequence: 6, RawText: "It sounded like a hundred tiny doors opening somewhere inside the walls.", CleanText: "It sounded like a hundred tiny doors opening somewhere inside the walls."},
		{ID: "z0000000-0007-4000-8000-000000000007", ChunkID: chunks[5].ID, Sequence: 7, RawText: "At the far end of the room, a map unfolded itself across the floor.", CleanText: "At the far end of the room, a map unfolded itself across the floor."},
		{ID: "z0000000-0008-4000-8000-000000000008", ChunkID: chunks[5].ID, Sequence: 8, RawText: "The map showed streets she knew, but each street was drawn under a different moon.", CleanText: "The map showed streets she knew, but each street was drawn under a different moon."},
		{ID: "z0000000-0009-4000-8000-000000000009", ChunkID: chunks[5].ID, Sequence: 9, RawText: "She touched the nearest corner, and the lantern answered with a quiet pulse of light.", CleanText: "She touched the nearest corner, and the lantern answered with a quiet pulse of light."},
		{ID: "z0000000-0010-4000-8000-000000000010", ChunkID: chunks[5].ID, Sequence: 10, RawText: "For the first time all winter, Mara felt that getting lost might be a kind of invitation.", CleanText: "For the first time all winter, Mara felt that getting lost might be a kind of invitation."},
		{ID: "z0000000-0011-4000-8000-000000000011", ChunkID: chunks[6].ID, Sequence: 1, RawText: "The last train home arrived without a sound.", CleanText: "The last train home arrived without a sound."},
		{ID: "z0000000-0012-4000-8000-000000000012", ChunkID: chunks[6].ID, Sequence: 2, RawText: "Its windows reflected the platform lights, but no faces waited behind the glass.", CleanText: "Its windows reflected the platform lights, but no faces waited behind the glass."},
		{ID: "z0000000-0013-4000-8000-000000000013", ChunkID: chunks[6].ID, Sequence: 3, RawText: "Jon stepped inside with his umbrella dripping on the metal floor.", CleanText: "Jon stepped inside with his umbrella dripping on the metal floor."},
		{ID: "z0000000-0014-4000-8000-000000000014", ChunkID: chunks[6].ID, Sequence: 4, RawText: "A paper ticket lay on the nearest seat, already punched with tomorrow's date.", CleanText: "A paper ticket lay on the nearest seat, already punched with tomorrow's date."},
		{ID: "z0000000-0015-4000-8000-000000000015", ChunkID: chunks[6].ID, Sequence: 5, RawText: "He looked back at the station, but the platform had become a thin line of rain.", CleanText: "He looked back at the station, but the platform had become a thin line of rain."},
		{ID: "z0000000-0016-4000-8000-000000000016", ChunkID: chunks[6].ID, Sequence: 6, RawText: "The train moved before he could decide whether to leave.", CleanText: "The train moved before he could decide whether to leave."},
		{ID: "z0000000-0017-4000-8000-000000000017", ChunkID: chunks[6].ID, Sequence: 7, RawText: "Beyond the tunnel, the city opened like a book he had once forgotten how to read.", CleanText: "Beyond the tunnel, the city opened like a book he had once forgotten how to read."},
		{ID: "z0000000-0018-4000-8000-000000000018", ChunkID: chunks[6].ID, Sequence: 8, RawText: "Every window was bright, and every street seemed to be waiting for his answer.", CleanText: "Every window was bright, and every street seemed to be waiting for his answer."},
		{ID: "z0000000-0019-4000-8000-000000000019", ChunkID: chunks[7].ID, Sequence: 1, RawText: "Dear Ada, if this letter reaches you, the machine works.", CleanText: "Dear Ada, if this letter reaches you, the machine works."},
		{ID: "z0000000-0020-4000-8000-000000000020", ChunkID: chunks[7].ID, Sequence: 2, RawText: "I am writing from the same apartment, but the city outside is thirty years older.", CleanText: "I am writing from the same apartment, but the city outside is thirty years older."},
		{ID: "z0000000-0021-4000-8000-000000000021", ChunkID: chunks[7].ID, Sequence: 3, RawText: "The river is cleaner, the bridges are covered with gardens, and nobody pays for the bus.", CleanText: "The river is cleaner, the bridges are covered with gardens, and nobody pays for the bus."},
		{ID: "z0000000-0022-4000-8000-000000000022", ChunkID: chunks[7].ID, Sequence: 4, RawText: "Do not be impressed too quickly; the coffee is still terrible.", CleanText: "Do not be impressed too quickly; the coffee is still terrible."},
		{ID: "z0000000-0023-4000-8000-000000000023", ChunkID: chunks[7].ID, Sequence: 5, RawText: "I have learned that the future is not a place where problems disappear.", CleanText: "I have learned that the future is not a place where problems disappear."},
		{ID: "z0000000-0024-4000-8000-000000000024", ChunkID: chunks[7].ID, Sequence: 6, RawText: "It is a place where old problems wear cleaner clothes and speak in calmer voices.", CleanText: "It is a place where old problems wear cleaner clothes and speak in calmer voices."},
		{ID: "z0000000-0025-4000-8000-000000000025", ChunkID: chunks[7].ID, Sequence: 7, RawText: "Still, there is one good thing I can promise you.", CleanText: "Still, there is one good thing I can promise you."},
		{ID: "z0000000-0026-4000-8000-000000000026", ChunkID: chunks[7].ID, Sequence: 8, RawText: "The work you are afraid to start will matter more than you think.", CleanText: "The work you are afraid to start will matter more than you think."},
		{ID: "z0000000-0027-4000-8000-000000000027", ChunkID: chunks[7].ID, Sequence: 9, RawText: "Begin before you feel ready, and keep the blue notebook.", CleanText: "Begin before you feel ready, and keep the blue notebook."},
		{ID: "z0000000-0028-4000-8000-000000000028", ChunkID: chunks[8].ID, Sequence: 1, RawText: "Ada read the letter twice, then placed it under a cup so it would not vanish.", CleanText: "Ada read the letter twice, then placed it under a cup so it would not vanish."},
		{ID: "z0000000-0029-4000-8000-000000000029", ChunkID: chunks[8].ID, Sequence: 2, RawText: "The paper smelled faintly of rain and electrical dust.", CleanText: "The paper smelled faintly of rain and electrical dust."},
		{ID: "z0000000-0030-4000-8000-000000000030", ChunkID: chunks[8].ID, Sequence: 3, RawText: "She wanted to laugh, but the blue notebook was already on her desk.", CleanText: "She wanted to laugh, but the blue notebook was already on her desk."},
		{ID: "z0000000-0031-4000-8000-000000000031", ChunkID: chunks[8].ID, Sequence: 4, RawText: "For months she had filled it with sketches, questions, and careful excuses.", CleanText: "For months she had filled it with sketches, questions, and careful excuses."},
		{ID: "z0000000-0032-4000-8000-000000000032", ChunkID: chunks[8].ID, Sequence: 5, RawText: "Now the excuses looked smaller than the questions.", CleanText: "Now the excuses looked smaller than the questions."},
		{ID: "z0000000-0033-4000-8000-000000000033", ChunkID: chunks[8].ID, Sequence: 6, RawText: "She opened a new page and wrote the date at the top.", CleanText: "She opened a new page and wrote the date at the top."},
		{ID: "z0000000-0034-4000-8000-000000000034", ChunkID: chunks[8].ID, Sequence: 7, RawText: "Then she wrote one sentence, crossed it out, and wrote a better one.", CleanText: "Then she wrote one sentence, crossed it out, and wrote a better one."},
		{ID: "z0000000-0035-4000-8000-000000000035", ChunkID: chunks[9].ID, Sequence: 1, RawText: "Clear work rarely begins with a clear mind.", CleanText: "Clear work rarely begins with a clear mind."},
		{ID: "z0000000-0036-4000-8000-000000000036", ChunkID: chunks[9].ID, Sequence: 2, RawText: "It begins with a small list that refuses to become dramatic.", CleanText: "It begins with a small list that refuses to become dramatic."},
		{ID: "z0000000-0037-4000-8000-000000000037", ChunkID: chunks[9].ID, Sequence: 3, RawText: "Write the next visible action, not the entire ambition.", CleanText: "Write the next visible action, not the entire ambition."},
		{ID: "z0000000-0038-4000-8000-000000000038", ChunkID: chunks[9].ID, Sequence: 4, RawText: "A useful list does not flatter you with a fantasy of perfect focus.", CleanText: "A useful list does not flatter you with a fantasy of perfect focus."},
		{ID: "z0000000-0039-4000-8000-000000000039", ChunkID: chunks[9].ID, Sequence: 5, RawText: "It gives your attention a place to land when the day becomes noisy.", CleanText: "It gives your attention a place to land when the day becomes noisy."},
		{ID: "z0000000-0040-4000-8000-000000000040", ChunkID: chunks[9].ID, Sequence: 6, RawText: "If a task takes less than two minutes, do it before naming it.", CleanText: "If a task takes less than two minutes, do it before naming it."},
		{ID: "z0000000-0041-4000-8000-000000000041", ChunkID: chunks[9].ID, Sequence: 7, RawText: "If it takes longer, give it a verb, a boundary, and a time to return.", CleanText: "If it takes longer, give it a verb, a boundary, and a time to return."},
		{ID: "z0000000-0042-4000-8000-000000000042", ChunkID: chunks[9].ID, Sequence: 8, RawText: "The list is not your life; it is only a railing beside the stairs.", CleanText: "The list is not your life; it is only a railing beside the stairs."},
		{ID: "c0000000-0011-4000-8000-000000000011", ChunkID: "aaaaaaaa-0005-4000-8000-000000000005", Sequence: 1, RawText: "Take the downtown train, then change at West Fourth Street.", CleanText: "Take the downtown train, then change at West Fourth Street.", Translation: ptr("坐市中心方向的车，然后在西四街换乘。")},
		{ID: "c0000000-0012-4000-8000-000000000012", ChunkID: "aaaaaaaa-0005-4000-8000-000000000005", Sequence: 2, RawText: "If you miss the stop, text me and I will walk back to meet you.", CleanText: "If you miss the stop, text me and I will walk back to meet you.", Translation: ptr("如果你坐过站了，发消息给我，我会走回来接你。")},
		{ID: "c0000000-0013-4000-8000-000000000013", ChunkID: "aaaaaaaa-0006-4000-8000-000000000006", Sequence: 1, RawText: "I booked a table, but they only had a spot near the kitchen.", CleanText: "I booked a table, but they only had a spot near the kitchen.", Translation: ptr("我订了桌，但他们只剩靠近厨房的位置。")},
		{ID: "c0000000-0014-4000-8000-000000000014", ChunkID: "aaaaaaaa-0006-4000-8000-000000000006", Sequence: 2, RawText: "That's fine, as long as the bread arrives before the stories do.", CleanText: "That's fine, as long as the bread arrives before the stories do.", Translation: ptr("没关系，只要面包比故事先上桌就行。")},
		{ID: "c0000000-0015-4000-8000-000000000015", ChunkID: "aaaaaaaa-0007-4000-8000-000000000007", Sequence: 1, RawText: "I was trying to be helpful, but I made everything louder.", CleanText: "I was trying to be helpful, but I made everything louder.", Translation: ptr("我本来想帮忙，但我把事情弄得更吵了。")},
		{ID: "c0000000-0016-4000-8000-000000000016", ChunkID: "aaaaaaaa-0007-4000-8000-000000000007", Sequence: 2, RawText: "Let me start again, this time with listening instead of advice.", CleanText: "Let me start again, this time with listening instead of advice.", Translation: ptr("让我重新来一次，这次先倾听，而不是先建议。")},
		{ID: "c0000000-0017-4000-8000-000000000017", ChunkID: "aaaaaaaa-0008-4000-8000-000000000008", Sequence: 1, RawText: "To small victories, late trains, and friends who still show up.", CleanText: "To small victories, late trains, and friends who still show up.", Translation: ptr("敬小小的胜利、晚点的列车，以及仍然出现的朋友。")},
		{ID: "c0000000-0018-4000-8000-000000000018", ChunkID: "aaaaaaaa-0008-4000-8000-000000000008", Sequence: 2, RawText: "The city looked less impossible from above, almost like a promise.", CleanText: "The city looked less impossible from above, almost like a promise.", Translation: ptr("从高处看，这座城市没那么不可能，几乎像一个承诺。")},
		{ID: "c0000000-0019-4000-8000-000000000019", ChunkID: "bbbbbbbb-0002-4000-8000-000000000002", Sequence: 1, RawText: "Run the test locally, read the failure, and change one thing.", CleanText: "Run the test locally, read the failure, and change one thing.", Translation: ptr("本地运行测试，读懂失败原因，然后只改一件事。")},
		{ID: "c0000000-0020-4000-8000-000000000020", ChunkID: "bbbbbbbb-0002-4000-8000-000000000002", Sequence: 2, RawText: "A calm terminal is usually the result of many noisy attempts.", CleanText: "A calm terminal is usually the result of many noisy attempts.", Translation: ptr("平静的终端通常来自很多吵闹的尝试。")},
		{ID: "c0000000-0021-4000-8000-000000000021", ChunkID: "bbbbbbbb-0003-4000-8000-000000000003", Sequence: 1, RawText: "The endpoint is simple, but the contract must be boring and clear.", CleanText: "The endpoint is simple, but the contract must be boring and clear.", Translation: ptr("接口可以简单，但契约必须朴素清楚。")},
		{ID: "c0000000-0022-4000-8000-000000000022", ChunkID: "bbbbbbbb-0003-4000-8000-000000000003", Sequence: 2, RawText: "Good names make future debugging feel less like archaeology.", CleanText: "Good names make future debugging feel less like archaeology.", Translation: ptr("好的命名会让未来调试不像考古。")},
		{ID: "c0000000-0023-4000-8000-000000000023", ChunkID: "bbbbbbbb-0004-4000-8000-000000000004", Sequence: 1, RawText: "Write the release note for the person who opens it on Friday.", CleanText: "Write the release note for the person who opens it on Friday.", Translation: ptr("给周五打开它的人写发布说明。")},
		{ID: "c0000000-0024-4000-8000-000000000024", ChunkID: "bbbbbbbb-0004-4000-8000-000000000004", Sequence: 2, RawText: "Tell them what changed, why it matters, and what to watch next.", CleanText: "Tell them what changed, why it matters, and what to watch next.", Translation: ptr("告诉他们改了什么、为什么重要、接下来要注意什么。")},
	}

	return &repository{
		sources: sources,
		chunks:  chunks,
		nodes:   nodes,
		progress: []progress{
			{ID: "dddddddd-0001-4000-8000-000000000001", UserID: demoUserID, ChunkID: chunks[0].ID, HighestWPM: 62, HighestAccuracy: 98.4, StarsEarned: 3, LastNodeSequence: 2, IsCompleted: true, UpdatedAt: now},
		},
	}
}

func (repo *repository) getSources(sourceType string) []source {
	repo.mu.Lock()
	defer repo.mu.Unlock()

	var result []source
	for _, item := range repo.sources {
		if item.IsActive && (sourceType == "" || item.Type == sourceType) {
			result = append(result, item)
		}
	}
	return result
}

func (repo *repository) getMap(sourceID string) []mapChunk {
	repo.mu.Lock()
	defer repo.mu.Unlock()

	progressByChunk := map[string]progress{}
	completed := map[string]bool{}
	for _, item := range repo.progress {
		if item.UserID == demoUserID {
			progressByChunk[item.ChunkID] = item
			if item.IsCompleted {
				completed[item.ChunkID] = true
			}
		}
	}

	var result []mapChunk
	for _, item := range repo.chunks {
		if item.SourceID != sourceID {
			continue
		}
		itemProgress := mapProgress{LastNodeSequence: 1}
		if saved, ok := progressByChunk[item.ID]; ok {
			itemProgress = mapProgress{StarsEarned: saved.StarsEarned, IsCompleted: saved.IsCompleted, HighestWPM: saved.HighestWPM, HighestAccuracy: saved.HighestAccuracy, LastNodeSequence: saved.LastNodeSequence}
		}
		locked := false
		for _, dependency := range item.Dependencies {
			if !completed[dependency] {
				locked = true
				break
			}
		}
		result = append(result, mapChunk{chunk: item, Progress: itemProgress, Locked: locked})
	}

	sort.Slice(result, func(i, j int) bool {
		if result[i].ChapterNum == result[j].ChapterNum {
			return result[i].SectionNum < result[j].SectionNum
		}
		return result[i].ChapterNum < result[j].ChapterNum
	})
	return result
}

func (repo *repository) getStream(chunkID string, cursor, limit int) []contentNode {
	repo.mu.Lock()
	defer repo.mu.Unlock()

	var result []contentNode
	for _, node := range repo.nodes {
		if node.ChunkID == chunkID && node.Sequence >= cursor {
			result = append(result, node)
		}
	}
	sort.Slice(result, func(i, j int) bool { return result[i].Sequence < result[j].Sequence })
	if len(result) > limit {
		return result[:limit]
	}
	return result
}

func (repo *repository) report(input progressReport) progress {
	repo.mu.Lock()
	defer repo.mu.Unlock()

	stars := calculateStars(input.WPM, input.Accuracy)
	now := time.Now().Format(time.RFC3339)
	for index := range repo.progress {
		item := &repo.progress[index]
		if item.UserID == demoUserID && item.ChunkID == input.ChunkID {
			item.HighestWPM = math.Max(item.HighestWPM, input.WPM)
			item.HighestAccuracy = math.Max(item.HighestAccuracy, input.Accuracy)
			if stars > item.StarsEarned {
				item.StarsEarned = stars
			}
			item.LastNodeSequence = max(1, input.CurrentSeq)
			item.IsCompleted = item.IsCompleted || stars > 0
			item.UpdatedAt = now
			return *item
		}
	}

	created := progress{
		ID:               "eeeeeeee-" + strings.ReplaceAll(input.ChunkID[:13], "-", ""),
		UserID:           demoUserID,
		ChunkID:          input.ChunkID,
		HighestWPM:       input.WPM,
		HighestAccuracy:  input.Accuracy,
		StarsEarned:      stars,
		LastNodeSequence: max(1, input.CurrentSeq),
		IsCompleted:      stars > 0,
		UpdatedAt:        now,
	}
	repo.progress = append(repo.progress, created)
	return created
}

func calculateStars(wpm, accuracy float64) int {
	if accuracy >= 98 && wpm >= 60 {
		return 3
	}
	if accuracy >= 95 {
		return 2
	}
	if accuracy >= 90 {
		return 1
	}
	return 0
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func apiMux(repo *repository) *http.ServeMux {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /api/v1/health", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]any{"ok": true, "mode": "exe-memory"})
	})
	mux.HandleFunc("GET /api/v1/sources", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, repo.getSources(r.URL.Query().Get("type")))
	})
	mux.HandleFunc("GET /api/v1/sources/{id}/map", func(w http.ResponseWriter, r *http.Request) {
		sourceID := r.PathValue("id")
		writeJSON(w, http.StatusOK, map[string]any{"sourceId": sourceID, "chunks": repo.getMap(sourceID)})
	})
	mux.HandleFunc("GET /api/v1/chunks/{id}/stream", func(w http.ResponseWriter, r *http.Request) {
		cursor := 1
		limit := 8
		_, _ = fmt.Sscanf(r.URL.Query().Get("cursor_seq"), "%d", &cursor)
		_, _ = fmt.Sscanf(r.URL.Query().Get("limit"), "%d", &limit)
		cursor = max(1, cursor)
		limit = min(50, max(1, limit))
		nodes := repo.getStream(r.PathValue("id"), cursor, limit)
		nextCursor := any(nil)
		if len(nodes) > 0 {
			nextCursor = nodes[len(nodes)-1].Sequence + 1
		}
		writeJSON(w, http.StatusOK, map[string]any{"nodes": nodes, "nextCursor": nextCursor, "hasMore": len(nodes) == limit})
	})
	mux.HandleFunc("POST /api/v1/progress/report", func(w http.ResponseWriter, r *http.Request) {
		var payload progressReport
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil || payload.ChunkID == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "chunk_id, wpm and accuracy are required"})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"progress": repo.report(payload), "unlockedChunkIds": []string{payload.ChunkID}})
	})

	return mux
}

func staticHandler() (http.Handler, error) {
	distFS, err := fs.Sub(embeddedFiles, "dist")
	if err != nil {
		return nil, err
	}
	fileServer := http.FileServer(http.FS(distFS))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/" {
			fileServer.ServeHTTP(w, r)
			return
		}
		path := strings.TrimPrefix(r.URL.Path, "/")
		if _, err := fs.Stat(distFS, path); err == nil {
			fileServer.ServeHTTP(w, r)
			return
		}
		r.URL.Path = "/"
		fileServer.ServeHTTP(w, r)
	}), nil
}

func openBrowser(url string) {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		cmd = exec.Command("rundll32", "url.dll,FileProtocolHandler", url)
	case "darwin":
		cmd = exec.Command("open", url)
	default:
		cmd = exec.Command("xdg-open", url)
	}
	_ = cmd.Start()
}

func main() {
	repo := newRepository()
	static, err := staticHandler()
	if err != nil {
		log.Fatal(err)
	}

	mux := apiMux(repo)
	mux.Handle("/", static)

	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		log.Fatal(err)
	}
	server := &http.Server{Handler: mux, ReadHeaderTimeout: 5 * time.Second}
	url := "http://" + listener.Addr().String()

	go func() {
		<-time.After(450 * time.Millisecond)
		openBrowser(url)
	}()
	go func() {
		if err := server.Serve(listener); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatal(err)
		}
	}()

	log.Printf("Typinglish is running at %s", url)
	select {
	case <-context.Background().Done():
		_ = server.Shutdown(context.Background())
	}
}
