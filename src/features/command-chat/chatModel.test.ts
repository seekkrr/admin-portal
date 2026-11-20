import { describe, test } from "node:test";
import assert from "node:assert/strict";
import type {
    AnswerResult,
    NeedResult,
    PreviewResult,
    UnderstandRequest,
    UnderstandResult,
} from "@/services/commands.types";
import {
    answerRequest,
    buildRequest,
    CHAT_GREETING,
    chatHistory,
    chatReducer,
    composerPlaceholder,
    describeEntry,
    entryForResult,
    HISTORY_TURNS,
    isAdminPath,
    MESSAGE_PLACEHOLDER,
    openQuestion,
    replyWords,
    type ChatEntry,
    type ChatState,
} from "./chatModel";

const at = "2026-11-05T10:00:00.000Z";
const REQUEST: UnderstandRequest = { text: "show reports", surface: "admin" };
const user = (id: string, text: string): ChatEntry => ({ id, at, type: "user", text, attachments: [] });

const ANSWER: AnswerResult = {
    kind: "answer",
    title: "Open reports",
    text: "There's one open report, marked as spam 2 hours ago.",
    items: [{ label: "Collab report #1042", sublabel: "Spam", url_path: "/collabs/reports", image_url: null }],
    link: { url_path: "/collabs/reports", label: "Open reports" },
};
const PREVIEW: PreviewResult = {
    kind: "preview",
    command: "place.hide",
    title: "Hide Tibet Kitchen",
    summary: "It disappears from the app until shown again.",
    changes: [{ label: "Visible in the app", before: "Yes", after: "No" }],
    confirm_label: "Hide place",
    danger: true,
    token: "tok",
    lead: "Here it is, look right?",
};
const NEED: NeedResult = { kind: "need", slot: "category", prompt: "Sure, what category should Ara Cafe be in?", input: "text", placeholder: "Cafe, viewpoint, hostel…" };

describe("each reply as the chat's words", () => {
    test("answer: its text, or the title when there's no text", () => {
        assert.equal(replyWords(ANSWER), "There's one open report, marked as spam 2 hours ago.");
        assert.equal(replyWords({ ...ANSWER, text: null }), "Open reports");
        assert.equal(replyWords({ ...ANSWER, text: "   " }), "Open reports");
    });

    test("preview: lead and title joined with a space; just the title with no lead", () => {
        assert.equal(replyWords(PREVIEW), "Here it is, look right? Hide Tibet Kitchen");
        assert.equal(replyWords({ ...PREVIEW, lead: null }), "Hide Tibet Kitchen");
    });

    test("need / choose: the question; denied / unknown / done: the message", () => {
        assert.equal(replyWords(NEED), NEED.prompt);
        assert.equal(replyWords({ kind: "choose", slot: "place", prompt: "Which place did you mean?", options: [] }), "Which place did you mean?");
        assert.equal(replyWords({ kind: "denied", message: "I can't delete things." }), "I can't delete things.");
        assert.equal(replyWords({ kind: "unknown", message: "Sorry, not yet.", examples: ["hide x"] }), "Sorry, not yet.");
        assert.equal(replyWords({ kind: "done", message: "Ara Cafe is hidden.", url_path: null }), "Ara Cafe is hidden.");
    });

    test("nothing said: null", () => {
        assert.equal(replyWords({ ...ANSWER, text: null, title: "" }), null);
        assert.equal(replyWords({ kind: "denied", message: "  " }), null);
    });
});

describe("the chat so far (history)", () => {
    test("user messages and replies in order; errors, notes and empty text are left out", () => {
        const entries: ChatEntry[] = [
            user("u1", "show reports"),
            entryForResult(REQUEST, ANSWER, "r1"),
            user("u2", "  "),
            user("u3", "hide tibet kitchen"),
            { ...entryForResult(REQUEST, PREVIEW, "r2"), status: "confirmed" },
            { id: "d1", at, type: "done", result: { kind: "done", message: "Tibet Kitchen is hidden.", url_path: null } },
            { id: "n1", at, type: "note", text: "No problem, I've left it as it was." },
            { id: "e1", at, type: "error", request: REQUEST, error: { kind: "network", message: "Couldn't reach the server.", action: "retry" } },
            entryForResult(REQUEST, { kind: "answer", title: "", text: null, items: [], link: null }, "r3"),
        ];
        assert.deepEqual(chatHistory(entries), [
            { role: "user", text: "show reports" },
            { role: "assistant", text: "There's one open report, marked as spam 2 hours ago." },
            { role: "user", text: "hide tibet kitchen" },
            { role: "assistant", text: "Here it is, look right? Hide Tibet Kitchen" },
            { role: "assistant", text: "Tibet Kitchen is hidden." },
        ]);
    });

    test("only the last 8 turns, oldest first", () => {
        assert.equal(HISTORY_TURNS, 8);
        const many = Array.from({ length: 11 }, (_, i) => user(`u${i}`, `message ${i}`));
        const turns = chatHistory(many);
        assert.equal(turns.length, 8);
        assert.deepEqual(turns[0], { role: "user", text: "message 3" });
        assert.deepEqual(turns[7], { role: "user", text: "message 10" });
    });

    test("a typed message's request carries history only when there is some", () => {
        assert.deepEqual(buildRequest("  hi  ", "admin"), { text: "hi", surface: "admin" });
        const history = [{ role: "user" as const, text: "show reports" }];
        assert.deepEqual(buildRequest("thanks", "admin", [], history), { text: "thanks", surface: "admin", history });
        const photo = { url: "https://img.seekkrr.com/a.webp", kind: "image" as const };
        assert.deepEqual(buildRequest("add these to Ara", "admin", [photo]), { text: "add these to Ara", surface: "admin", attachments: [photo] });
    });
});

describe("a question the message box answers", () => {
    const open: ChatEntry[] = [user("u1", "set category of ara"), entryForResult({ text: "set category of ara", surface: "admin" }, NEED, "q1")];

    test("the chat's last message, when it's an open text / number / date / time question", () => {
        assert.equal(openQuestion(open)?.id, "q1");
        for (const input of ["number", "date", "time"] as const) {
            assert.equal(openQuestion([entryForResult(REQUEST, { ...NEED, input }, "q")])?.id, "q");
        }
        // Photos are picked in the bubble; answered, skipped or older questions aren't open.
        assert.equal(openQuestion([entryForResult(REQUEST, { ...NEED, input: "images" }, "q")]), null);
        assert.equal(openQuestion([{ ...entryForResult(REQUEST, NEED, "q"), answered: true }]), null);
        assert.equal(openQuestion([{ ...entryForResult(REQUEST, NEED, "q"), superseded: true }]), null);
        assert.equal(openQuestion([...open, user("u2", "cafe")]), null);
        assert.equal(openQuestion([]), null);
    });

    test("the typed value is appended to the question's request (the rest of it stays)", () => {
        const request: UnderstandRequest = { text: "set category of ", surface: "admin", picks: { place: "pl_ara" }, history: [{ role: "user", text: "hi" }] };
        assert.deepEqual(answerRequest(request, " cafe "), { ...request, text: "set category of cafe" });
    });

    test("the message box hint: the question's placeholder while it's open", () => {
        assert.equal(MESSAGE_PLACEHOLDER, "Message SeekKrr");
        assert.equal(composerPlaceholder(null), "Message SeekKrr");
        assert.equal(composerPlaceholder(openQuestion(open)), "Cafe, viewpoint, hostel…");
        assert.equal(composerPlaceholder(openQuestion([entryForResult(REQUEST, { ...NEED, placeholder: null }, "q")])), "Type your answer");
    });

    test("a new message supersedes only open choose / need prompts", () => {
        const state: ChatState = {
            startedAt: at,
            entries: [
                entryForResult(REQUEST, NEED, "q1"),
                { ...entryForResult(REQUEST, NEED, "q2"), answered: true },
                entryForResult(REQUEST, { kind: "choose", slot: "place", prompt: "Which?", options: [] }, "c1"),
                entryForResult(REQUEST, PREVIEW, "p1"),
            ],
        };
        const next = chatReducer(state, { type: "supersede" });
        const flags = next.entries.map((e) => (e.type === "result" ? Boolean(e.superseded) : null));
        assert.deepEqual(flags, [true, false, true, false]);
    });
});

describe("what the chat says", () => {
    test("the greeting says what it helps the team with and that it checks first", () => {
        assert.equal(
            CHAT_GREETING,
            "Hi! I can help with places, quests, people, bookings and payouts. Just tell me what you need, and I'll check with you before changing anything."
        );
    });

    test("screen readers hear the words shown: the answer's text, the preview's lead", () => {
        assert.equal(describeEntry(entryForResult(REQUEST, ANSWER)), "There's one open report, marked as spam 2 hours ago. 1 item.");
        assert.equal(
            describeEntry(entryForResult(REQUEST, PREVIEW)),
            "Here it is, look right? Hide Tibet Kitchen. It disappears from the app until shown again. Confirm, or Not now."
        );
    });

    test("a preview starts open; other results carry no lifecycle", () => {
        assert.equal(entryForResult(REQUEST, PREVIEW).status, "open");
        const other: UnderstandResult = ANSWER;
        assert.equal(entryForResult(REQUEST, other).status, undefined);
    });
});

describe("links the chat may open", () => {
    test("admin portal paths only", () => {
        for (const ok of ["/collabs/reports", "/markers/pl_ara?tab=photos", "/creators/abc", "/creator-applications", "/business-offers", " /users "]) {
            assert.equal(isAdminPath(ok), true, ok);
        }
        for (const no of [
            "https://seekkrr.com/help",
            "//evil.example.com",
            "/\\evil.example.com",
            "collabs/reports",
            "/business/bookings",
            "/creator",
            "/creator/quests",
            "javascript:alert(1)",
            "",
            null,
            undefined,
        ]) {
            assert.equal(isAdminPath(no), false, String(no));
        }
    });
});
