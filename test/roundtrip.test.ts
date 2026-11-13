import { describe, expect, it } from "vitest";
import { BinaryReader } from "../src/reader";
import { BinaryWriter } from "../src/writer";
import { BinaryDynamicWriter } from "../src/writer-dynamic";
import { BinarySizeWriter } from "../src/writer-size";
import {
    createRandom,
    decode,
    encode,
    nestArrays,
    nestObjects,
    randomValue,
    roundTrip,
    toArray,
} from "./helpers";

function distinctStrings(count: number): string[] {
    const result: string[] = [];

    for (let i = 0; i < count; i++) {
        result.push(`string-${i}`);
    }
    return result;
}

function manyKeys(count: number): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (let i = 0; i < count; i++) {
        result[`key${i}`] = i;
    }
    return result;
}

const CORPUS: [string, unknown][] = [
    ["undefined", undefined],
    ["null", null],
    ["true", true],
    ["false", false],
    ["zero", 0],
    ["one", 1],
    ["minus one", -1],
    ["31", 31],
    ["32", 32],
    ["127", 127],
    ["128", 128],
    ["255", 255],
    ["256", 256],
    ["65535", 65535],
    ["65536", 65536],
    ["int32 max", 2147483647],
    ["int32 max plus one", 2147483648],
    ["uint32 max", 4294967295],
    ["uint32 max plus one", 4294967296],
    ["-128", -128],
    ["-129", -129],
    ["-32768", -32768],
    ["-32769", -32769],
    ["int32 min", -2147483648],
    ["below int32 min", -2147483649],
    ["half", 0.5],
    ["tenth", 0.1],
    ["one and a half", 1.5],
    ["negative one and a half", -1.5],
    ["pi", Math.PI],
    ["max safe integer", Number.MAX_SAFE_INTEGER],
    ["min safe integer", Number.MIN_SAFE_INTEGER],
    ["max value", Number.MAX_VALUE],
    ["min value", Number.MIN_VALUE],
    ["epsilon", Number.EPSILON],
    ["infinity", Number.POSITIVE_INFINITY],
    ["negative infinity", Number.NEGATIVE_INFINITY],
    ["2^24", 16777216],
    ["2^24 plus one", 16777217],
    ["empty string", ""],
    ["letter", "a"],
    ["accent", "é"],
    ["euro", "€"],
    ["emoji", "😀"],
    ["japanese", "日本語"],
    ["newline", "line\nbreak"],
    ["nul character", "\u0000"],
    ["two hundred characters", "x".repeat(200)],
    ["twenty thousand characters", "x".repeat(20000)],
    ["one hundred forty thousand characters", "ab".repeat(70000)],
    ["empty array", []],
    ["flat array", [1, 2, 3]],
    ["nested empty arrays", [[], [[]]]],
    ["thousand sevens", new Array(1000).fill(7)],
    ["mixed array", [1, "a", null, undefined, true, [2], { a: 3 }]],
    ["empty bytes", new Uint8Array(0)],
    ["two bytes", new Uint8Array([0, 255])],
    ["three hundred bytes", new Uint8Array(300).fill(9)],
    ["seventy thousand bytes", new Uint8Array(70000).fill(1)],
    ["empty object", {}],
    ["flat object", { a: 1 }],
    ["empty key", { "": 1 }],
    ["empty key and value", { "": "" }],
    ["unicode keys", { é: 1, "😀": 2, 日本語: 3 }],
    ["numeric keys", { "1": "a", "2": "b" }],
    ["undefined value", { a: undefined }],
    ["nested objects", { a: { b: { c: { d: [1, { e: "f" }] } } } }],
    ["repeated strings", ["a", "a", "a", { a: "a" }]],
    ["three hundred distinct strings twice", [...distinctStrings(300), ...distinctStrings(300)]],
    ["three hundred keys", manyKeys(300)],
    [
        "shared keys across objects",
        [
            { id: 1, name: "a" },
            { id: 2, name: "b" },
            { id: 3, name: "c" },
        ],
    ],
    ["typed payloads", { bytes: new Uint8Array([1, 2, 3]), list: [new Uint8Array(0)] }],
    ["deep arrays", nestArrays(257)],
    ["deep objects", nestObjects(257)],
];

describe("round trips", () => {
    it.each(CORPUS)("preserves %s", (_label, value) => {
        expect(roundTrip(value)).toStrictEqual(value);
    });

    it.each(CORPUS)("sizes %s exactly", (_label, value) => {
        const bytes = encode(value);

        expect(bytes).toHaveLength(new BinarySizeWriter().any(value).byteLength);
    });

    it("preserves negative zero", () => {
        const output = roundTrip([-0]) as number[];

        expect(Object.is(roundTrip(-0), -0)).toBe(true);
        expect(Object.is(output[0], -0)).toBe(true);
    });

    it("preserves NaN", () => {
        expect(Number.isNaN(roundTrip(Number.NaN))).toBe(true);
    });

    it("replaces lone surrogates with the replacement character", () => {
        expect(roundTrip("\ud800")).toBe("\ufffd");
        expect(roundTrip("a\udc00b")).toBe("a\ufffdb");
        expect(roundTrip("\ud83d\ud83d\ude00")).toBe("\ufffd😀");
    });

    it("keeps __proto__ keys harmless", () => {
        const input = JSON.parse('{"__proto__":{"polluted":true},"a":1}');
        const output = roundTrip(input) as Record<string, unknown>;

        expect(Object.getPrototypeOf(output)).toBe(Object.prototype);
        expect(Object.prototype.hasOwnProperty.call(output, "__proto__")).toBe(true);
        expect(output["a"]).toBe(1);
        expect(({} as Record<string, unknown>)["polluted"]).toBeUndefined();
    });

    it("flattens class instances into plain objects", () => {
        class Point {
            x = 1;
            y = 2;
        }

        const output = roundTrip(new Point()) as Record<string, unknown>;

        expect(output).toStrictEqual({ x: 1, y: 2 });
        expect(output).not.toBeInstanceOf(Point);
    });

    it("rejects values it cannot represent", () => {
        expect(() => {
            encode(new Date());
        }).toThrow("Unsupported object type");
        expect(() => {
            encode([new Map()]);
        }).toThrow("Unsupported object type");
        expect(() => {
            encode(Symbol("x"));
        }).toThrow("Invalid type: symbol");
    });

    it("rejects cycles and excessive depth", () => {
        const loop: Record<string, unknown> = {};
        loop["self"] = loop;

        expect(() => {
            encode(loop);
        }).toThrow("Maximum nesting depth exceeded");
        expect(() => {
            encode(nestArrays(258));
        }).toThrow("Maximum nesting depth exceeded");
    });
});

describe("streams of values", () => {
    it("decodes consecutive values sharing one string table", () => {
        const strings = new Map<string, number>();
        const writer = new BinaryWriter(256);

        writer
            .any("shared", strings)
            .any({ shared: "shared" }, strings)
            .any(["shared", 1], strings);

        const source = new BinaryReader(writer.buffer());
        const table: string[] = [];

        expect(source.any(table)).toBe("shared");
        expect(source.any(table)).toStrictEqual({ shared: "shared" });
        expect(source.any(table)).toStrictEqual(["shared", 1]);
        expect(source.remaining).toBe(0);
    });

    it("mixes tagged values with raw fields", () => {
        const writer = new BinaryWriter(128);

        writer.uint32BE(0xcafebabe).any({ ok: true }).float64LE(Math.PI).str("tail");

        const source = new BinaryReader(writer.buffer());

        expect(source.uint32BE()).toBe(0xcafebabe);
        expect(source.any()).toStrictEqual({ ok: true });
        expect(source.float64LE()).toBe(Math.PI);
        expect(source.str()).toBe("tail");
        expect(source.remaining).toBe(0);
    });

    it("leaves trailing bytes in remaining", () => {
        const bytes = new Uint8Array([...encode({ a: 1 }), 0xaa, 0xbb]);
        const source = new BinaryReader(bytes);

        expect(source.any()).toStrictEqual({ a: 1 });
        expect(source.remaining).toBe(2);
    });
});

describe("writer implementations agree", () => {
    it("BinarySizeWriter.make() output matches a dynamic writer", () => {
        const counter = new BinarySizeWriter()
            .uint16()
            .str("héllo")
            .uint8Array(new Uint8Array(3))
            .float32();
        const sized = counter
            .make()
            .uint16(500)
            .str("héllo")
            .uint8Array(new Uint8Array(3))
            .float32(1.5);
        const dynamic = new BinaryDynamicWriter()
            .uint16(500)
            .str("héllo")
            .uint8Array(new Uint8Array(3))
            .float32(1.5);

        expect(toArray(sized.buffer())).toEqual(toArray(dynamic.buffer()));
    });

    it("reads dynamic writer output back field by field", () => {
        const date = new Date(Date.UTC(1999, 11, 31, 23, 59, 59, 999));
        const dynamic = new BinaryDynamicWriter();

        dynamic.date(date).write8Bools(true, false, true).int16BE(-1234).strValue("raw").bool(true);

        const source = new BinaryReader(dynamic.buffer());

        expect(source.date().getTime()).toBe(date.getTime());
        expect(source.read8Bools().slice(0, 3)).toEqual([true, false, true]);
        expect(source.int16BE()).toBe(-1234);
        expect(new TextDecoder().decode(source.bytes(3))).toBe("raw");
        expect(source.bool()).toBe(true);
        expect(source.remaining).toBe(0);
    });
});

describe("randomised round trips", () => {
    it("preserves five hundred random values and sizes them exactly", () => {
        const random = createRandom(20261021);

        for (let i = 0; i < 500; i++) {
            const value = randomValue(random);
            const bytes = encode(value);

            expect(bytes).toHaveLength(new BinarySizeWriter().any(value).byteLength);
            expect(decode(bytes)).toStrictEqual(value);
        }
    });

    it("preserves random values written through one shared string table", () => {
        const random = createRandom(7);
        const values: unknown[] = [];

        for (let i = 0; i < 100; i++) {
            values.push(randomValue(random));
        }

        const strings = new Map<string, number>();
        const size = new BinarySizeWriter();

        for (const value of values) {
            size.any(value, strings);
        }

        const writer = size.make();
        const writeStrings = new Map<string, number>();

        for (const value of values) {
            writer.any(value, writeStrings);
        }

        const source = new BinaryReader(writer.buffer());
        const table: string[] = [];

        for (const value of values) {
            expect(source.any(table)).toStrictEqual(value);
        }
        expect(source.remaining).toBe(0);
    });
});

describe("hostile input", () => {
    it("rejects every strict prefix of a valid encoding", () => {
        for (const [label, value] of CORPUS) {
            const bytes = encode(value);

            if (bytes.length > 400) {
                continue;
            }

            for (let length = 0; length < bytes.length; length++) {
                expect(() => {
                    decode(bytes.subarray(0, length));
                }, `${label} truncated to ${length}`).toThrow();
            }
        }
    });

    it("fails with an Error, and never hangs, on random garbage", () => {
        const random = createRandom(424242);

        for (let i = 0; i < 2000; i++) {
            const bytes = new Uint8Array(Math.floor(random() * 40));

            for (let j = 0; j < bytes.length; j++) {
                bytes[j] = Math.floor(random() * 256);
            }

            try {
                decode(bytes);
            } catch (error) {
                expect(error).toBeInstanceOf(Error);
            }
        }
    });

    it("fails with an Error on mutated valid encodings", () => {
        const random = createRandom(99);
        const original = encode({
            list: [1, "two", { three: 3 }],
            bytes: new Uint8Array([1, 2, 3]),
            flag: true,
        });

        for (let i = 0; i < 1000; i++) {
            const mutated = new Uint8Array(original);

            mutated[Math.floor(random() * mutated.length)] = Math.floor(random() * 256);

            try {
                decode(mutated);
            } catch (error) {
                expect(error).toBeInstanceOf(Error);
            }
        }
    });
});
