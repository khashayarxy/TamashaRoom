import { describe, it, expect } from "vitest";
import {
    parseVtt,
    parseSrt,
    parseSubtitle,
} from "@/Components/composite/subtitle-overlay";

describe("parseVtt", () => {
    it("parses a basic WEBVTT file", () => {
        const vtt = `WEBVTT

00:00:01.000 --> 00:00:04.000
Hello world

00:00:05.000 --> 00:00:08.500
Second cue`;
        const cues = parseVtt(vtt);
        expect(cues).toHaveLength(2);
        expect(cues[0]).toEqual({
            start: 1000,
            end: 4000,
            text: "Hello world",
        });
        expect(cues[1]).toEqual({ start: 5000, end: 8500, text: "Second cue" });
    });

    it("handles WEBVTT with BOM and extra metadata", () => {
        const vtt = `WEBVTT
Kind: captions
Language: en

1
00:00:02.000 --> 00:00:06.000
With index`;
        const cues = parseVtt(vtt);
        expect(cues).toHaveLength(1);
        expect(cues[0].text).toBe("With index");
    });

    it("strips HTML tags from cue text", () => {
        const vtt = `WEBVTT

00:00:00.000 --> 00:00:03.000
Hello <b>world</b> <i>test</i>`;
        const cues = parseVtt(vtt);
        expect(cues[0].text).toBe("Hello world test");
    });

    it("handles NOTE blocks", () => {
        const vtt = `WEBVTT

NOTE This is a comment

00:00:01.000 --> 00:00:03.000
Visible cue`;
        const cues = parseVtt(vtt);
        expect(cues).toHaveLength(1);
        expect(cues[0].text).toBe("Visible cue");
    });

    it("returns empty array for empty input", () => {
        expect(parseVtt("")).toEqual([]);
    });

    it("returns empty array for content without cues", () => {
        expect(parseVtt("WEBVTT\n\nNOTE just a comment")).toEqual([]);
    });

    it("handles multi-line cue text", () => {
        const vtt = `WEBVTT

00:00:01.000 --> 00:00:04.000
First line
Second line`;
        const cues = parseVtt(vtt);
        expect(cues).toHaveLength(1);
        expect(cues[0].text).toBe("First line\nSecond line");
    });

    it("handles Windows line endings", () => {
        const vtt = "WEBVTT\r\n\r\n00:00:01.000 --> 00:00:03.000\r\nHello";
        const cues = parseVtt(vtt);
        expect(cues).toHaveLength(1);
        expect(cues[0].text).toBe("Hello");
    });
});

describe("parseSrt", () => {
    it("parses a basic SRT file", () => {
        const srt = `1
00:00:01,000 --> 00:00:04,000
Hello world

2
00:00:05,000 --> 00:00:08,500
Second cue`;
        const cues = parseSrt(srt);
        expect(cues).toHaveLength(2);
        expect(cues[0]).toEqual({
            start: 1000,
            end: 4000,
            text: "Hello world",
        });
        expect(cues[1]).toEqual({ start: 5000, end: 8500, text: "Second cue" });
    });

    it("handles Windows line endings", () => {
        const srt = "1\r\n00:00:01,000 --> 00:00:03,000\r\nHello";
        const cues = parseSrt(srt);
        expect(cues).toHaveLength(1);
        expect(cues[0].text).toBe("Hello");
    });

    it("returns empty array for empty input", () => {
        expect(parseSrt("")).toEqual([]);
    });

    it("skips malformed blocks", () => {
        const srt = `1
00:00:01,000 --> 00:00:03,000
Hello

garbage

2
00:00:05,000 --> 00:00:08,000
World`;
        const cues = parseSrt(srt);
        expect(cues).toHaveLength(2);
    });

    it("handles multi-line text", () => {
        const srt = `1
00:00:01,000 --> 00:00:04,000
Line one
Line two`;
        const cues = parseSrt(srt);
        expect(cues).toHaveLength(1);
        expect(cues[0].text).toBe("Line one\nLine two");
    });
});

describe("parseSubtitle", () => {
    it("routes to parseVtt when content contains WEBVTT", () => {
        const result = parseSubtitle(
            "WEBVTT\n\n00:00:01.000 --> 00:00:03.000\nHello",
        );
        expect(result).toHaveLength(1);
        expect(result[0].text).toBe("Hello");
    });

    it("routes to parseSrt when content does not contain WEBVTT", () => {
        const result = parseSubtitle("1\n00:00:01,000 --> 00:00:03,000\nHello");
        expect(result).toHaveLength(1);
        expect(result[0].text).toBe("Hello");
    });

    it("handles empty input", () => {
        expect(parseSubtitle("")).toEqual([]);
    });
});
