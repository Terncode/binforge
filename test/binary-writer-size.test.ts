import { describe, expect, it } from "vitest";
import { BinaryOffset } from "../src/offset";
import { BinaryWriter } from "../src/writer";
import { BinarySizeWriter } from "../src/writer-size";
import { nestArrays } from "./helpers";

type FixedMethod =
    | "bool"
    | "int8"
    | "uint8"
    | "int16"
    | "int16LE"
    | "int16BE"
    | "uint16"
    | "uint16LE"
    | "uint16BE"
    | "int32"
    | "int32LE"
    | "int32BE"
    | "uint32"
    | "uint32LE"
    | "uint32BE"
    | "float32"
    | "float32LE"
    | "float32BE"
    | "float64"
    | "float64LE"
    | "float64BE"
    | "bools8";

const FIXED_SIZES: [FixedMethod, number][] = [
    ["bool", 1],
    ["int8", 1],
    ["uint8", 1],
    ["int16", 2],
    ["int16LE", 2],
    ["int16BE", 2],
    ["uint16", 2],
    ["uint16LE", 2],
    ["uint16BE", 2],
    ["int32", 4],
    ["int32LE", 4],
    ["int32BE", 4],
    ["uint32", 4],
    ["uint32LE", 4],
    ["uint32BE", 4],
    ["float32", 4],
    ["float32LE", 4],
    ["float32BE", 4],
    ["float64", 8],
    ["float64LE", 8],
    ["float64BE", 8],
    ["bools8", 1],
];

describe("BinarySizeWriter", () => {
    it("starts at zero", () => {
        expect(new BinarySizeWriter().byteLength).toBe(0);
    });

    for (const [method, size] of FIXED_SIZES) {
        it(`${method} adds ${size} byte(s) and chains`, () => {
            const counter = new BinarySizeWriter();

            expect(counter[method]()).toBe(counter);
            expect(counter.byteLength).toBe(size);
            counter[method]();
            expect(counter.byteLength).toBe(size * 2);
        });
    }

    it("sizes strings with their length prefix", () => {
        expect(new BinarySizeWriter().str("").byteLength).toBe(1);
        expect(new BinarySizeWriter().str("abc").byteLength).toBe(4);
        expect(new BinarySizeWriter().str("😀").byteLength).toBe(5);
        expect(new BinarySizeWriter().str("x".repeat(127)).byteLength).toBe(129);
    });

    it("sizes lengths as varints", () => {
        expect(new BinarySizeWriter().len(0).byteLength).toBe(1);
        expect(new BinarySizeWriter().len(127).byteLength).toBe(2);
        expect(new BinarySizeWriter().len(0x7ffffffe).byteLength).toBe(5);
        expect(() => {
            new BinarySizeWriter().len(-1);
        }).toThrow("Invalid length value");
    });

    it("sizes byte arrays by the view, not the backing store", () => {
        const view = new Uint8Array(100).subarray(10, 13);

        expect(new BinarySizeWriter().uint8Array(view).byteLength).toBe(4);
        expect(new BinarySizeWriter().uint8Array(new Uint8Array(0)).byteLength).toBe(1);
    });

    it("uses a fixed estimate for dates when no value is given", () => {
        expect(new BinarySizeWriter().date().byteLength).toBe(25);
    });

    it("measures real dates exactly", () => {
        const normal = new Date(Date.UTC(2020, 0, 2, 3, 4, 5, 6));
        const extended = new Date(Date.UTC(10000, 0, 1));

        expect(new BinarySizeWriter().date(normal).byteLength).toBe(25);
        expect(new BinarySizeWriter().date(extended).byteLength).toBe(28);
        expect(() => {
            new BinarySizeWriter().date(new Date(Number.NaN));
        }).toThrow(RangeError);
    });

    it("sizes nullable values", () => {
        expect(new BinarySizeWriter().writeNullable(null, () => 10).byteLength).toBe(1);
        expect(new BinarySizeWriter().writeNullable(5, () => 3).byteLength).toBe(4);
    });

    it.each([
        [0, 0],
        [1, 1],
        [8, 1],
        [9, 2],
        [16, 2],
        [17, 3],
    ])("sizes %s packed bits as %s byte(s)", (bitCount, expected) => {
        const counter = new BinarySizeWriter();

        counter.packBits((bits) => {
            for (let i = 0; i < bitCount!; i++) {
                bits.bit(true);
            }
        });
        expect(counter.byteLength).toBe(expected);
    });

    it("counts every bit width", () => {
        const counter = new BinarySizeWriter();

        expect(
            counter.packBits((bits) => {
                bits.bit(true).uint2(0).int2(0).uint4(0).int4(0);
            }),
        ).toBe(counter);
        expect(counter.byteLength).toBe(2);
    });

    it("sizes any values the way the writer lays them down", () => {
        const values: unknown[] = [
            1,
            "a",
            ["a", "a"],
            { a: [1, 2, { b: "a" }] },
            new Uint8Array(3),
            null,
            0.1,
            -0,
        ];

        for (const value of values) {
            const counter = new BinarySizeWriter().any(value);
            const writer = new BinaryWriter(counter.byteLength);

            writer.any(value);
            expect(writer.buffer()).toHaveLength(counter.byteLength);
        }
    });

    it("shares interned strings through a supplied map", () => {
        const strings = new Map<string, number>();
        const counter = new BinarySizeWriter();

        counter.any("hello", strings).any("hello", strings);
        expect(counter.byteLength).toBe(7 + 2);
    });

    it("starts a fresh table for each any() call by default", () => {
        const counter = new BinarySizeWriter();

        counter.any("hello").any("hello");
        expect(counter.byteLength).toBe(14);
    });

    it("propagates unsupported values and depth errors", () => {
        expect(() => {
            new BinarySizeWriter().any(new Date());
        }).toThrow("Unsupported object type");
        expect(() => {
            new BinarySizeWriter().any(nestArrays(258));
        }).toThrow("Maximum nesting depth exceeded");
    });

    it("make() returns a writer of exactly the measured size and resets the counter", () => {
        const counter = new BinarySizeWriter().uint32().str("ab");

        expect(counter.byteLength).toBe(7);

        const writer = counter.make();

        expect(writer).toBeInstanceOf(BinaryWriter);
        expect(counter.byteLength).toBe(0);
        writer.uint32(1).str("ab");
        expect(writer.buffer()).toHaveLength(7);
        expect(() => {
            writer.uint8(1);
        }).toThrow(RangeError);
    });

    it("make() on an empty counter yields a zero-sized writer", () => {
        const writer = new BinarySizeWriter().make();

        expect(writer.buffer()).toHaveLength(0);
        expect(() => {
            writer.uint8(1);
        }).toThrow(RangeError);
    });

    it("inherits the offset constants", () => {
        const counter = new BinarySizeWriter();

        expect(counter.UINT32).toBe(BinaryOffset.UINT32);
        expect(BinarySizeWriter.FLOAT64).toBe(8);
    });
});
