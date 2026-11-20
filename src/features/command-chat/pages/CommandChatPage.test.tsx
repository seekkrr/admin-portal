import { afterEach, beforeEach, describe, mock, test } from "node:test";
import assert from "node:assert/strict";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Link } from "react-router-dom";
import { StaticRouter } from "react-router-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { commandsService } from "@/services/commands.service";
import type {
    AnswerItem,
    AnswerResult,
    CommandHistoryItem,
    NeedResult,
    PreviewResult,
    UnderstandRequest,
    UnderstandResult,
} from "@/services/commands.types";
import { CHAT_GREETING, entryForResult, saveChatState, type ChatEntry, type PreviewStatus } from "../chatModel";
import { useCommandChat, type CommandChat as ChatApi } from "../hooks/useCommandChat";
import { commandQueryKeys } from "../hooks/useCommandQueries";
import { AnswerCard } from "../components/AnswerCard";
import { MessageItem, type MessageHandlers } from "../components/MessageItem";
import { PathLink, TypingIndicator } from "../components/chatUi";
import CommandChatPage from "./CommandChatPage";

/**
 * No DOM here (node:test in Node): components render to HTML with
 * react-dom/server, and the chat hook runs inside a server render with the
 * service mocked, so its moves (send, pick, retry) show the requests they make.
 */

const at = "2026-11-05T10:00:00.000Z";
const noop = () => {};
const HANDLERS: MessageHandlers = { choose: noop, provideImages: noop, confirm: noop, cancel: noop, retry: noop, insert: noop };

const request = (text: string, extra: Partial<UnderstandRequest> = {}): UnderstandRequest => ({ text, surface: "admin", ...extra });
const user = (id: string, text: string): ChatEntry => ({ id, at, type: "user", text, attachments: [] });

const ANSWER: AnswerResult = {
    kind: "answer",
    title: "Reports · open",
    text: "There's one open report, marked as spam 2 hours ago.",
    items: [{ label: "Collab report #1042", sublabel: "Spam · 2 hours ago", url_path: "/collabs/reports/1042", image_url: null }],
    link: { url_path: "/collabs/reports", label: "Open reports" },
};
const PREVIEW: PreviewResult = {
    kind: "preview",
    command: "place.hide",
    title: "Hide Tibet Kitchen",
    summary: "It disappears from the app and from quests until shown again.",
    changes: [{ label: "Visible in the app", before: "Yes", after: "No" }],
    confirm_label: "Hide place",
    danger: true,
    token: "tok",
    lead: "Here it is, look right?",
};
const CATEGORY_NEED: NeedResult = {
    kind: "need",
    slot: "category",
    prompt: "Sure, what category should Ara Cafe be in?",
    input: "text",
    placeholder: "Cafe, viewpoint, hostel…",
};
const UNKNOWN: UnderstandResult = {
    kind: "unknown",
    message: "Sorry, I can't help with that one yet.",
    examples: ["add images to Emaho Cafe", "what needs me"],
};

/** Server HTML escapes apostrophes; the checks read the words as shown. */
function readable(html: string): string {
    return html.replace(/&#x27;/g, "'");
}

function inRouter(node: ReactNode): string {
    return readable(renderToStaticMarkup(<StaticRouter location="/chat">{node}</StaticRouter>));
}

function message(entry: ChatEntry): string {
    return inRouter(<MessageItem entry={entry} busy={false} autoFocus={false} handlers={HANDLERS} />);
}

/**
 * The message box grows with its text in a layout effect, which can't run in a
 * server render; React warns about it on every page render. Only that warning
 * is dropped.
 */
function withoutLayoutEffectWarning<T>(render: () => T): T {
    const original = console.error;
    console.error = (...args: unknown[]) => {
        if (typeof args[0] === "string" && args[0].includes("useLayoutEffect does nothing on the server")) return;
        original(...args);
    };
    try {
        return render();
    } finally {
        console.error = original;
    }
}

/** The whole chat page, as it opens with this conversation saved (and these earlier commands). */
function chatPage(entries: ChatEntry[] = [], earlier?: CommandHistoryItem[]): string {
    saveChatState({ entries, startedAt: at });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    if (earlier) client.setQueryData(commandQueryKeys.history(), earlier);
    return withoutLayoutEffectWarning(() =>
        inRouter(
            <QueryClientProvider client={client}>
                <CommandChatPage />
            </QueryClientProvider>
        )
    );
}

/** The chat hook over this saved conversation; its moves call the (mocked) service. */
function chatHook(entries: ChatEntry[]): ChatApi {
    saveChatState({ entries, startedAt: at });
    const out: { api?: ChatApi } = {};
    function Capture() {
        out.api = useCommandChat({ surface: "admin" });
        return null;
    }
    renderToStaticMarkup(<Capture />);
    if (!out.api) throw new Error("hook did not render");
    return out.api;
}

/** Walk a rendered element tree (function components that use no hooks are expanded by calling them). */
function findElements(node: ReactNode, match: (el: ReactElement) => boolean, out: ReactElement[] = []): ReactElement[] {
    if (Array.isArray(node)) {
        node.forEach((n) => findElements(n as ReactNode, match, out));
        return out;
    }
    if (!isValidElement(node)) return out;
    if (match(node)) out.push(node);
    findElements((node.props as { children?: ReactNode }).children, match, out);
    return out;
}

function stubStorage(name: "sessionStorage" | "localStorage") {
    const store = new Map<string, string>();
    Object.defineProperty(globalThis, name, {
        configurable: true,
        writable: true,
        value: {
            getItem: (k: string) => store.get(k) ?? null,
            setItem: (k: string, v: string) => void store.set(k, String(v)),
            removeItem: (k: string) => void store.delete(k),
        },
    });
}

type UnderstandMock = ReturnType<typeof mockUnderstand>;
function mockUnderstand() {
    return mock.method(commandsService, "understand", async () => ({ ...ANSWER }));
}
let understand: UnderstandMock;
/** The request of the n-th understand call. */
const sent = (n = 0) => understand.mock.calls[n]?.arguments[0];

// Hooks live inside this describe so they stay with this file (every test file shares one run).
describe("the admin chat page", () => {
    beforeEach(() => {
        stubStorage("sessionStorage");
        // Demo data off (its switch lives in localStorage).
        stubStorage("localStorage");
        understand = mockUnderstand();
    });

    afterEach(() => {
        mock.restoreAll();
    });

    describe("history goes with a newly typed message", () => {
        const CONVERSATION: ChatEntry[] = [
            user("u1", "show reports"),
            entryForResult(request("show reports"), ANSWER, "r1"),
            user("u2", "hide tibet kitchen"),
            { ...entryForResult(request("hide tibet kitchen"), PREVIEW, "r2"), status: "confirmed" },
            { id: "d1", at, type: "done", result: { kind: "done", message: "Tibet Kitchen is hidden.", url_path: "/markers/pl_tibet_kitchen" } },
            { id: "n1", at, type: "note", text: "No problem, I've left it as it was." },
            user("u3", "suspend rohan"),
            {
                id: "e1",
                at,
                type: "error",
                request: request("suspend rohan"),
                error: { kind: "network", message: "Couldn't reach the server.", action: "retry" },
                resolved: true,
            },
            user("u4", "delete emaho"),
            entryForResult(request("delete emaho"), { kind: "denied", message: "I can't delete things from the chat, sorry." }, "r4"),
        ];

        test("the chat so far, oldest first, as each message's words (errors and notes left out)", () => {
            const chat = chatHook(CONVERSATION);
            assert.equal(chat.send("thanks! now show what needs me"), true);
            assert.equal(understand.mock.callCount(), 1);
            assert.deepEqual(sent(), {
                text: "thanks! now show what needs me",
                surface: "admin",
                history: [
                    { role: "user", text: "show reports" },
                    { role: "assistant", text: "There's one open report, marked as spam 2 hours ago." },
                    { role: "user", text: "hide tibet kitchen" },
                    { role: "assistant", text: "Here it is, look right? Hide Tibet Kitchen" },
                    { role: "assistant", text: "Tibet Kitchen is hidden." },
                    { role: "user", text: "suspend rohan" },
                    { role: "user", text: "delete emaho" },
                    { role: "assistant", text: "I can't delete things from the chat, sorry." },
                ],
            });
        });

        test("only the last 8 turns", () => {
            const long = Array.from({ length: 12 }, (_, i) => user(`u${i}`, `message ${i}`));
            chatHook(long).send("one more");
            assert.equal(sent()?.history?.length, 8);
            assert.deepEqual(sent()?.history?.[0], { role: "user", text: "message 4" });
        });

        test("the first message of a chat has none", () => {
            chatHook([]).send("hi");
            assert.deepEqual(sent(), { text: "hi", surface: "admin" });
        });

        test("a tapped option re-sends its message as it was, with the pick (no new turns)", () => {
            const original = request("add images to emaho", { history: [{ role: "user", text: "hi" }] });
            const choose: UnderstandResult = {
                kind: "choose",
                slot: "place",
                prompt: "I found 2. Which place did you mean?",
                options: [
                    { id: "pl_emaho_bir", label: "Emaho Cafe", sublabel: "Cafe · Bir", image_url: null },
                    { id: "pl_emaho_dsl", label: "Emaho Bakery", sublabel: "Bakery · Dharamshala", image_url: null },
                ],
            };
            const chat = chatHook([user("u0", "hi"), user("u1", "add images to emaho"), entryForResult(original, choose, "c1")]);
            chat.choose("c1", { id: "pl_emaho_dsl", label: "Emaho Bakery", sublabel: null, image_url: null });
            assert.deepEqual(sent(), { ...original, picks: { place: "pl_emaho_dsl" } });
        });

        test("Retry repeats the same request", () => {
            const failed = request("show reports");
            const chat = chatHook([
                user("u1", "show reports"),
                { id: "e1", at, type: "error", request: failed, error: { kind: "network", message: "Couldn't reach the server.", action: "retry" } },
            ]);
            chat.retry("e1");
            assert.deepEqual(sent(), failed);
        });
    });

    describe("a question is answered from the message box", () => {
        const asked = request("set category of ara", { picks: { place: "pl_ara_manali" }, history: [{ role: "user", text: "hi" }] });
        const OPEN: ChatEntry[] = [user("u1", "set category of ara"), entryForResult(asked, CATEGORY_NEED, "need1")];

        test("typing the answer sends it through the question: appended to its request", () => {
            const chat = chatHook(OPEN);
            assert.equal(chat.send("viewpoint"), true);
            assert.equal(understand.mock.callCount(), 1);
            assert.deepEqual(sent(), { ...asked, text: "set category of ara viewpoint" });
        });

        test("number, date and time questions too", () => {
            for (const input of ["number", "date", "time"] as const) {
                understand.mock.resetCalls();
                chatHook([user("u1", "show bookings for sunrise"), entryForResult(asked, { ...CATEGORY_NEED, input }, `need-${input}`)]).send("2026-11-06");
                assert.deepEqual(sent(), { ...asked, text: "set category of ara 2026-11-06" }, input);
            }
        });

        test("with photos attached, or once answered, it's a new message instead", () => {
            const photo = { url: "https://img.seekkrr.com/x.webp", kind: "image" as const };
            chatHook(OPEN).send("add these to Ara Cafe", [photo]);
            assert.equal(sent()?.text, "add these to Ara Cafe");
            assert.deepEqual(sent()?.attachments, [photo]);

            understand.mock.resetCalls();
            const answered: ChatEntry[] = [user("u1", "set category of ara"), { ...entryForResult(asked, CATEGORY_NEED, "need1"), answered: true }];
            chatHook(answered).send("show reports");
            assert.deepEqual(sent(), {
                text: "show reports",
                surface: "admin",
                history: [
                    { role: "user", text: "set category of ara" },
                    { role: "assistant", text: "Sure, what category should Ara Cafe be in?" },
                ],
            });
        });

        test("the question is a plain message; the message box shows its placeholder, with no input in the bubble", () => {
            const html = chatPage(OPEN);
            assert.ok(html.includes("Sure, what category should Ara Cafe be in?"));
            assert.match(html, /<textarea[^>]*placeholder="Cafe, viewpoint, hostel…"/);
            // Only the message box takes text, and it has the only Send button.
            assert.doesNotMatch(html, /<input[^>]*type="(text|number)"/);
            assert.equal(html.match(/aria-label="Send"/g)?.length, 1);
        });

        test("a day or time question keeps a small Pick button; photos keep their picker", () => {
            const date = message(entryForResult(asked, { ...CATEGORY_NEED, input: "date", placeholder: null }, "n1"));
            assert.ok(date.includes("Pick a date"));
            assert.ok(!date.includes("Tomorrow"));
            assert.ok(message(entryForResult(asked, { ...CATEGORY_NEED, input: "time" }, "n2")).includes("Pick a time"));
            const photos = message(entryForResult(asked, { ...CATEGORY_NEED, input: "images", prompt: "Sure! Which photos should I add?" }, "n3"));
            assert.ok(photos.includes("Choose photos"));
            // Answered: just the question.
            const answered = message({ ...entryForResult(asked, { ...CATEGORY_NEED, input: "date" }, "n4"), answered: true });
            assert.ok(!answered.includes("Pick a date"));
            assert.ok(answered.includes("Sure, what category should Ara Cafe be in?"));
        });
    });

    describe("an answer: the chat's words, the records, one link", () => {
        test("the text is the message, with its item rows and one small router link to the admin screen", () => {
            const html = inRouter(<AnswerCard result={ANSWER} />);
            assert.ok(html.includes("There's one open report, marked as spam 2 hours ago."));
            // The title only shows when there's no text.
            assert.ok(!html.includes("Reports · open"));
            assert.match(html, /<a [^>]*href="\/collabs\/reports\/1042"[^>]*>.*Collab report #1042/);
            assert.match(html, /<a [^>]*href="\/collabs\/reports"[^>]*>Open reports/);
            assert.equal(html.match(/<a /g)?.length, 2);
        });

        test("clicking the link navigates inside the admin portal with react-router", () => {
            // AnswerCard → PathLink → react-router's <Link to="/collabs/reports"> (client-side, no reload).
            const links = findElements(AnswerCard({ result: { ...ANSWER, items: [] } }), (el) => el.type === PathLink);
            assert.equal(links.length, 1);
            const props = links[0]?.props as Parameters<typeof PathLink>[0];
            assert.equal(props.to, "/collabs/reports");
            const link = PathLink(props);
            assert.equal(link.type, Link);
            assert.equal((link.props as { to: string }).to, "/collabs/reports");
        });

        test("up to 8 item rows, each opening its own url_path as before", () => {
            const items: AnswerItem[] = Array.from({ length: 10 }, (_, i) => ({
                label: `Place request ${i + 1}`,
                sublabel: null,
                url_path: `/markers/applications/app_${i + 1}`,
                image_url: null,
            }));
            const html = inRouter(<AnswerCard result={{ ...ANSWER, items, link: null }} />);
            assert.ok(html.includes("Place request 8"));
            assert.ok(!html.includes("Place request 9"));
            assert.equal(html.match(/<a /g)?.length, 8);
            assert.match(html, /href="\/markers\/applications\/app_1"/);
            // A full URL still opens in a new tab; a row without a path is plain.
            const mixed = inRouter(
                <AnswerCard
                    result={{
                        ...ANSWER,
                        link: null,
                        items: [
                            { label: "Their website", sublabel: null, url_path: "https://emaho.example.com", image_url: null },
                            { label: "No screen", sublabel: null, url_path: null, image_url: null },
                        ],
                    }}
                />
            );
            assert.match(mixed, /<a [^>]*href="https:\/\/emaho\.example\.com"[^>]*target="_blank"/);
            assert.equal(mixed.match(/<a /g)?.length, 1);
        });

        test("no text: the title is the message; only admin portal paths get the link button", () => {
            for (const url_path of ["https://seekkrr.com/help", "//evil.example.com", "/business/bookings"]) {
                const html = inRouter(<AnswerCard result={{ ...ANSWER, text: null, items: [], link: { url_path, label: "Help" } }} />);
                assert.ok(html.includes("Reports · open"));
                assert.ok(!html.includes("Help"), url_path);
                assert.ok(!html.includes("<a "), url_path);
            }
        });
    });

    describe("a preview: the chat's lead, then the confirm card", () => {
        const preview = (status: PreviewStatus = "open") => message({ ...entryForResult(request("hide tibet kitchen"), PREVIEW, "p1"), status });

        test("the lead is a message right above the card; the card stays as it was", () => {
            const html = preview();
            assert.ok(html.includes("Here it is, look right?"));
            assert.ok(html.indexOf("Here it is, look right?") < html.indexOf("Hide Tibet Kitchen"));
            // Title, changes, Confirm (danger styling), and Not now instead of Cancel.
            assert.ok(html.includes("Check carefully before you confirm"));
            assert.ok(html.includes("Visible in the app"));
            assert.match(html, /<button[^>]*class="[^"]*bg-red-700[^"]*"[^>]*>.*Hide place<\/button>/);
            assert.ok(html.includes("Not now"));
            assert.ok(!html.includes("Cancel"));
            // No lead: just the card.
            assert.ok(!message(entryForResult(request("hide"), { ...PREVIEW, lead: null }, "p2")).includes("look right"));
        });

        test("Done when confirmed, Skipped when not; no spinner while it runs", () => {
            assert.ok(preview("confirmed").includes("Done"));
            assert.ok(!preview("confirmed").includes("Confirmed"));
            assert.ok(preview("cancelled").includes("Skipped"));
            assert.ok(!preview("cancelled").includes("Cancelled"));
            const running = preview("running");
            assert.ok(!running.includes("Working"));
            assert.ok(!running.includes("animate-spin"));
        });
    });

    describe("no suggestions; it reads like a conversation", () => {
        test("the empty chat opens with a hello, not a heading, starter chips or the catalog", () => {
            const html = chatPage();
            assert.ok(html.includes(CHAT_GREETING));
            assert.ok(!html.includes("What do you want to do?"));
            assert.ok(!html.includes("What can I do?"));
            assert.ok(!html.includes("What you can do"));
            assert.ok(!html.includes('aria-label="Examples"'));
            assert.doesNotMatch(html, /role="(combobox|listbox|option|dialog)"/);
            assert.match(html, /<textarea[^>]*placeholder="Message SeekKrr"/);
        });

        test("earlier commands still show above the conversation", () => {
            const earlier: CommandHistoryItem[] = [
                { at: "2026-11-04T09:00:00.000Z", text: "hide ara cafe", command: "place.hide", message: "Ara Cafe is hidden.", status: "done" },
            ];
            const html = chatPage([], earlier);
            assert.ok(html.includes('aria-label="Earlier commands"'));
            assert.ok(html.indexOf("Earlier commands") < html.indexOf(CHAT_GREETING));
        });

        test("unknown and denied show just the message, with no example chips", () => {
            const unknown = message(entryForResult(request("dance"), UNKNOWN, "u1"));
            assert.ok(unknown.includes("Sorry, I can't help with that one yet."));
            assert.ok(!unknown.includes("add images to Emaho Cafe"));
            assert.ok(!unknown.includes("<button"));
            const page = chatPage([user("u0", "dance"), entryForResult(request("dance"), UNKNOWN, "u1")]);
            assert.ok(!page.includes("what needs me"));
            const denied = message(entryForResult(request("delete emaho"), { kind: "denied", message: "I can't delete things." }, "d1"));
            assert.ok(!denied.includes("<button"));
        });

        test("messages have no status icons", () => {
            const bubbles = [
                message(entryForResult(request("dance"), UNKNOWN, "u1")),
                message(entryForResult(request("delete"), { kind: "denied", message: "I can't delete things." }, "d1")),
                message({ id: "d2", at, type: "done", result: { kind: "done", message: "Tibet Kitchen is hidden.", url_path: null } }),
                message({ id: "n1", at, type: "note", text: "No problem, I've left it as it was." }),
                message({
                    id: "e1",
                    at,
                    type: "error",
                    request: request("x"),
                    error: { kind: "network", message: "Couldn't reach the server.", action: "retry" },
                }),
            ];
            for (const html of bubbles) assert.ok(!html.includes("<svg"), html);
        });

        test("the chat typing is three dots, not a spinner with text", () => {
            const html = renderToStaticMarkup(<TypingIndicator />);
            assert.equal(html.match(/animate-bounce/g)?.length, 3);
            assert.ok(!html.includes("animate-spin"));
            assert.ok(!html.includes("Working"));
        });
    });
});
