import { describe, expect, it } from "vitest";
import { ByteSink, VarintReader } from "../src/byte-sync";
import { toArray } from "./helpers";

const VARINT_VECTORS: [number, number[]][] = [
    [0, [0x00]],
    [1, [0x01]],
    [127, [0x7f]],
    [128, [0x80, 0x01]],
    [255, [0xff, 0x01]],
    [256, [0x80, 0x02]],
    [16383, [0xff, 0x7f]],
    [16384, [0x80, 0x80, 0x01]],
    [2097151, [0xff, 0xff, 0x7f]],
    [2097152, [0x80, 0x80, 0x80, 0x01]],
    [268435455, [0xff, 0xff, 0xff, 0x7f]],
    [268435456, [0x80, 0x80, 0x80, 0x80, 0x01]],
    [0xffffffff, [0xff, 0xff, 0xff, 0xff, 0x0f]],
];

const ZIGZAG_VECTORS: [number, number[]][] = [
    [0, [0x00]],
    [-1, [0x01]],
    [1, [0x02]],
    [-2, [0x03]],
    [2, [0x04]],
    [63, [0x7e]],
    [-64, [0x7f]],
    [64, [0x80, 0x01]],
    [-65, [0x81, 0x01]],
    [2147483647, [0xfe, 0xff, 0xff, 0xff, 0x0f]],
    [-2147483648, [0xff, 0xff, 0xff, 0xff, 0x0f]],
];

describe("ByteSink", () => {
    it("starts empty", () => {
        const sink = new ByteSink();

        expect(sink.length).toBe(0);
        expect(sink.view()).toHaveLength(0);
    });

    it("reports the number of written bytes", () => {
        const sink = new ByteSink();

        sink.writeVarint(1);
        expect(sink.length).toBe(1);

        sink.writeVarint(300);
        expect(sink.length).toBe(3);
    });

    it("exposes only the written portion of the buffer", () => {
        const sink = new ByteSink(64);

        sink.writeVarint(0x41);

        expect(sink.view()).toHaveLength(1);
        expect(toArray(sink.view())).toEqual([0x41]);
    });

    it.each(VARINT_VECTORS)("writes %s as a varint", (value, expected) => {
        const sink = new ByteSink();

        sink.writeVarint(value);

        expect(toArray(sink.view())).toEqual(expected);
    });

    it("appends consecutive varints", () => {
        const sink = new ByteSink();

        sink.writeVarint(0);
        sink.writeVarint(300);
        sink.writeVarint(0xffffffff);

        expect(toArray(sink.view())).toEqual([0x00, 0xac, 0x02, 0xff, 0xff, 0xff, 0xff, 0x0f]);
    });

    it("grows the backing buffer while preserving earlier bytes", () => {
        const sink = new ByteSink(1);

        sink.writeVarint(300);
        sink.writeVarint(70000);
        sink.writeZigzag(-5);

        expect(toArray(sink.view())).toEqual([0xac, 0x02, 0xf0, 0xa2, 0x04, 0x09]);
    });

    it("grows to fit a maximum-width varint", () => {
        const sink = new ByteSink(1);

        sink.writeVarint(0xffffffff);

        expect(sink.length).toBe(5);
        expect(toArray(sink.view())).toEqual([0xff, 0xff, 0xff, 0xff, 0x0f]);
    });

    it("resets to empty and can be reused", () => {
        const sink = new ByteSink(2);

        sink.writeVarint(0xffffffff);
        sink.reset();

        expect(sink.length).toBe(0);
        expect(sink.view()).toHaveLength(0);

        sink.writeVarint(7);
        expect(toArray(sink.view())).toEqual([0x07]);
    });

    it.each(ZIGZAG_VECTORS)("writes %s as a zigzag varint", (value, expected) => {
        const sink = new ByteSink();

        sink.writeZigzag(value);

        expect(toArray(sink.view())).toEqual(expected);
    });
});

describe("VarintReader", () => {
    it("starts at offset zero by default", () => {
        const reader = new VarintReader(new Uint8Array([1, 2]));

        expect(reader.offset).toBe(0);
    });

    it("honours the start offset", () => {
        const reader = new VarintReader(new Uint8Array([0xff, 0x2a]), 1);

        expect(reader.offset).toBe(1);
        expect(reader.readVarint()).toBe(0x2a);
    });

    it.each(VARINT_VECTORS)("reads %s from its varint encoding", (expected, encoded) => {
        const reader = new VarintReader(new Uint8Array(encoded));

        expect(reader.readVarint()).toBe(expected);
        expect(reader.offset).toBe(encoded.length);
    });

    it("advances through consecutive varints", () => {
        const reader = new VarintReader(new Uint8Array([0x00, 0xac, 0x02, 0xff, 0xff, 0xff, 0xff, 0x0f]));

        expect(reader.readVarint()).toBe(0);
        expect(reader.offset).toBe(1);
        expect(reader.readVarint()).toBe(300);
        expect(reader.offset).toBe(3);
        expect(reader.readVarint()).toBe(0xffffffff);
        expect(reader.offset).toBe(8);
    });

    it.each(ZIGZAG_VECTORS)("reads %s from its zigzag encoding", (expected, encoded) => {
        const reader = new VarintReader(new Uint8Array(encoded));

        expect(reader.readZigzag()).toBe(expected);
        expect(reader.offset).toBe(encoded.length);
    });

    it("round-trips values written by a ByteSink", () => {
        const sink = new ByteSink(1);
        const values = [0, 1, -1, 63, -64, 128, -129, 16384, 2147483647, -2147483648];

        for (const value of values) {
            sink.writeZigzag(value);
        }

        const reader = new VarintReader(sink.view());

        for (const value of values) {
            expect(reader.readZigzag()).toBe(value);
        }
        expect(reader.offset).toBe(sink.length);
    });
});
