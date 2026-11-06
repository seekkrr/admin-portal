import { afterEach, beforeEach, describe, mock, test } from "node:test";
import assert from "node:assert/strict";
import type { AxiosRequestConfig } from "axios";
import { api } from "@/services/api";
import { API_ENDPOINTS } from "@/config/api";
import { cleanHistory, commandsService, MAX_HISTORY_TURNS, normalizeResult } from "./commands.service";
import type { CommandTurn } from "./commands.types";

/** Every call goes through the shared client's `request`; these tests answer it and read what was sent. */
let sentConfigs: AxiosRequestConfig[] = [];

function replyWith(...replies: { status: number; data: unknown }[]) {
    const queue = [...replies];
    mock.method(api, "request", async (config: AxiosRequestConfig) => {
        sentConfigs.push(config);
        const next = queue.shift() ?? { status: 200, data: { success: true, result: { kind: "answer", title: "", text: "Ok" } } };
        return { ...next, statusText: "", headers: {}, config };
    });
}

/** The JSON body of the n-th call. */
const body = (n = 0) => (sentConfigs[n]?.data ?? {}) as Record<string, unknown>;

// Hooks live inside this describe so they stay with this file (every test file shares one run).
describe("commands service", () => {
    beforeEach(() => {
        sentConfigs = [];
        // Demo data off (the mock layer only answers in dev with the flag set).
        Object.defineProperty(globalThis, "localStorage", {
            configurable: true,
            writable: true,
            value: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
        });
    });

    afterEach(() => {
        mock.restoreAll();
    });

    describe("history: the chat so far goes with a message", () => {
        const HISTORY: CommandTurn[] = [
            { role: "user", text: "show bookings for sunrise" },
            { role: "assistant", text: "Sure! Which day should I check?" },
        ];

        test("understand sends the turns as given, oldest first", async () => {
            replyWith({ status: 200, data: { success: true, result: { kind: "answer", title: "", text: "2 bookings tomorrow." } } });
            await commandsService.understand({ text: "tomorrow", surface: "admin", history: HISTORY });
            assert.equal(sentConfigs[0]?.method, "POST");
            assert.equal(sentConfigs[0]?.url, "/api/v2/commands/understand");
            assert.deepEqual(body(), { text: "tomorrow", surface: "admin", history: HISTORY });
        });

        test("no history: the field is left out (older servers never see it)", async () => {
            replyWith({ status: 200, data: { result: { kind: "answer", title: "Hi", text: null } } }, { status: 200, data: { result: { kind: "answer", title: "Hi", text: null } } });
            await commandsService.understand({ text: "hi", surface: "admin" });
            await commandsService.understand({ text: "hi", surface: "admin", history: [{ role: "user", text: "   " }] });
            assert.deepEqual(body(0), { text: "hi", surface: "admin" });
            assert.equal("history" in body(1), false);
        });

        test("what the server accepts: the latest 20 turns, words only, at most 1000 characters each", async () => {
            replyWith({ status: 200, data: { result: { kind: "answer", title: "", text: "Ok" } } });
            const many: CommandTurn[] = Array.from({ length: 25 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", text: `turn ${i}` }));
            many.push({ role: "assistant", text: "" }, { role: "user", text: "x".repeat(1500) });
            await commandsService.understand({ text: "ok", surface: "admin", history: many });
            const history = body().history as CommandTurn[];
            assert.equal(MAX_HISTORY_TURNS, 20);
            assert.equal(history.length, 20);
            assert.deepEqual(history[0], { role: "user", text: "turn 6" });
            assert.deepEqual(history[18], { role: "user", text: "turn 24" });
            assert.equal(history[19]?.text.length, 1000);
        });

        test("cleanHistory drops odd roles and trims the words", () => {
            const odd = [{ role: "system", text: "be nice" }, { role: "user", text: "  hide ara  " }] as unknown as CommandTurn[];
            assert.deepEqual(cleanHistory(odd), [{ role: "user", text: "hide ara" }]);
            assert.deepEqual(cleanHistory(undefined), []);
        });
    });

    describe("conversation replies", () => {
        test("an answer's link: one screen with its button text (Open when the label is missing)", () => {
            const answer = normalizeResult({
                kind: "answer",
                title: "Open reports",
                text: "There's one open report.",
                items: [],
                link: { url_path: " /collabs/reports ", label: "Open reports" },
            });
            assert.equal(answer.kind, "answer");
            if (answer.kind !== "answer") return;
            assert.deepEqual(answer.link, { url_path: "/collabs/reports", label: "Open reports" });

            const unlabelled = normalizeResult({ kind: "answer", title: "", text: "Hi", link: { url_path: "/payouts" } });
            assert.deepEqual(unlabelled.kind === "answer" ? unlabelled.link : null, { url_path: "/payouts", label: "Open" });

            for (const link of [undefined, null, "/payouts", { label: "Open" }, { url_path: "  " }]) {
                const r = normalizeResult({ kind: "answer", title: "x", text: null, items: [], link });
                assert.equal(r.kind === "answer" ? r.link : "wrong kind", null);
            }
        });

        test("an answer keeps its item rows", () => {
            const answer = normalizeResult({
                kind: "answer",
                title: "Waiting for you",
                text: null,
                items: [{ label: "3 place requests", sublabel: "Oldest from 2 days ago", url_path: "/markers?tab=requests" }],
            });
            assert.deepEqual(answer.kind === "answer" ? answer.items : [], [
                { label: "3 place requests", sublabel: "Oldest from 2 days ago", url_path: "/markers?tab=requests", image_url: null },
            ]);
        });

        test("a preview's lead: the chat's words above the card (null when missing)", () => {
            const base = { kind: "preview", command: "place.hide", title: "Hide Ara", summary: "", changes: [], confirm_label: "Hide", token: "t" };
            const withLead = normalizeResult({ ...base, lead: "  Here it is, look right? " });
            assert.equal(withLead.kind === "preview" ? withLead.lead : "wrong kind", "Here it is, look right?");
            const without = normalizeResult(base);
            assert.equal(without.kind === "preview" ? without.lead : "wrong kind", null);
        });
    });

    describe("no suggestions", () => {
        test("the chat has no suggest call or endpoint any more", () => {
            assert.equal("suggest" in commandsService, false);
            assert.equal("SUGGEST" in API_ENDPOINTS.COMMANDS, false);
        });
    });
});
