import { describe, expect, it } from "vitest";
import { BinaryReader } from "../src/reader";
import { BinaryWriter } from "../src/writer";
import { ANY_VECTORS, nestedArrayBytes } from "./helpers";

type ReadMethod =
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
    | "float64BE";

const READ_WIDTHS: [ReadMethod, number][] = [
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
];

const READ_VECTORS: [ReadMethod, number[], number][] = [
    ["int8", [0x80], -128],
    ["uint8", [0x80], 128],
    ["int16", [0xff, 0xfe], -257],
    ["int16LE", [0xff, 0xfe], -257],
    ["int16BE", [0xff, 0xfe], -2],
    ["uint16", [0xff, 0xfe], 0xfeff],
    ["uint16LE", [0xff, 0xfe], 0xfeff],
    ["uint16BE", [0xff, 0xfe], 0xfffe],
    ["int32", [0xff, 0xff, 0xff, 0xfe], -16777217],
    ["int32LE", [0xff, 0xff, 0xff, 0xfe], -16777217],
    ["int32BE", [0xff, 0xff, 0xff, 0xfe], -2],
    ["uint32", [0x12, 0x34, 0x56, 0x78], 0x78563412],
    ["uint32LE", [0x12, 0x34, 0x56, 0x78], 0x78563412],
    ["uint32BE", [0x12, 0x34, 0x56, 0x78], 0x12345678],
    ["float32", [0x00, 0x00, 0xc0, 0x3f], 1.5],
    ["float32LE", [0x00, 0x00, 0xc0, 0x3f], 1.5],
    ["float32BE", [0x3f, 0xc0, 0x00, 0x00], 1.5],
    ["float64", [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xf0, 0x3f], 1],
    ["float64LE", [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xf0, 0x3f], 1],
    ["float64BE", [0x3f, 0xf0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00], 1],
];

function reader(...bytes: number[]): BinaryReader {
    return new BinaryReader(new Uint8Array(bytes));
}

describe("BinaryReader construction", () => {
    it("reads from a Uint8Array", () => {
        expect(reader(7).uint8()).toBe(7);
    });

    it("reads from an ArrayBuffer", () => {
        const buffer = new Uint8Array([1, 2]).buffer;

        expect(new BinaryReader(buffer).uint16()).toBe(0x0201);
    });

    it("respects the offset and length of a view", () => {
        const backing = new Uint8Array([9, 9, 1, 2, 3, 9]);
        const view = new BinaryReader(backing.subarray(2, 5));

        expect(view.remaining).toBe(3);
        expect(view.uint8()).toBe(1);
        expect(view.uint8()).toBe(2);
        expect(view.uint8()).toBe(3);
        expect(() => {
            view.uint8();
        }).toThrow(/Buffer underflow/);
    });

    it("tracks the remaining byte count", () => {
        const source = reader(1, 2, 3, 4);

        expect(source.remaining).toBe(4);
        source.uint8();
        expect(source.remaining).toBe(3);
        source.uint16();
        expect(source.remaining).toBe(1);
    });

    it("handles an empty buffer", () => {
        const source = new BinaryReader(new Uint8Array(0));

        expect(source.remaining).toBe(0);
        expect(() => {
            source.uint8();
        }).toThrow("Buffer underflow at offset 0");
    });
});

describe("BinaryReader numerics", () => {
    for (const [method, bytes, expected] of READ_VECTORS) {
        it(`${method} decodes ${bytes.map((b) => b.toString(16)).join(" ")}`, () => {
            const source = reader(...bytes);

            expect(source[method]()).toBe(expected);
            expect(source.remaining).toBe(0);
        });
    }

    for (const [method, width] of READ_WIDTHS) {
        it(`${method} throws when fewer than ${width} byte(s) remain`, () => {
            const source = new BinaryReader(new Uint8Array(width - 1));

            expect(() => {
                source[method]();
            }).toThrow(/Buffer underflow/);
            expect(source.remaining).toBe(width - 1);
        });
    }

    it("reads sequential values from one buffer", () => {
        const source = reader(0x01, 0x34, 0x12, 0xfe, 0xff, 0xff, 0xff);

        expect(source.uint8()).toBe(1);
        expect(source.uint16()).toBe(0x1234);
        expect(source.int32()).toBe(-2);
        expect(source.remaining).toBe(0);
    });

    it("reads NaN and negative zero faithfully", () => {
        const writer = new BinaryWriter(16);

        writer.float64(Number.NaN).float32(-0);

        const source = new BinaryReader(writer.buffer());

        expect(Number.isNaN(source.float64())).toBe(true);
        expect(Object.is(source.float32(), -0)).toBe(true);
    });
});

describe("BinaryReader bool and nullable", () => {
    it("reads booleans", () => {
        const source = reader(1, 0, 2);

        expect(source.bool()).toBe(true);
        expect(source.bool()).toBe(false);
        expect(source.bool()).toBe(false);
    });

    it("returns null without invoking the callback", () => {
        let calls = 0;
        const source = reader(0);
        const value = source.readNullable(() => {
            calls++;
            return 1;
        });

        expect(value).toBeNull();
        expect(calls).toBe(0);
        expect(source.remaining).toBe(0);
    });

    it("returns the callback result for a present value", () => {
        const value = reader(1, 42).readNullable((r) => r.uint8());

        expect(value).toBe(42);
    });

    it("returns falsy payloads as they are", () => {
        expect(reader(1, 0).readNullable((r) => r.uint8())).toBe(0);
    });

    it("rejects markers other than zero and one", () => {
        expect(() => {
            reader(2, 5).readNullable((r) => r.uint8());
        }).toThrow(/Invalid nullable marker 2/);
    });

    it("throws on an empty buffer", () => {
        expect(() => {
            reader().readNullable((r) => r.uint8());
        }).toThrow(/Buffer underflow/);
    });
});

describe("BinaryReader len", () => {
    it.each([
        [[0x00], -1],
        [[0x01], 0],
        [[0x02], 1],
        [[0x7f], 126],
        [[0x80, 0x01], 127],
        [[0xff, 0x7f], 16382],
        [[0x80, 0x80, 0x01], 16383],
        [[0xff, 0xff, 0x7f], 2097150],
        [[0x80, 0x80, 0x80, 0x01], 2097151],
        [[0xff, 0xff, 0xff, 0x7f], 268435454],
        [[0x80, 0x80, 0x80, 0x80, 0x01], 268435455],
        [[0xff, 0xff, 0xff, 0xff, 0x07], 0x7ffffffe],
    ])("decodes %j as %s", (bytes, expected) => {
        const source = reader(...bytes!);

        expect(source.len()).toBe(expected);
        expect(source.remaining).toBe(0);
    });

    it("round-trips every width boundary through the writer", () => {
        const values = [0, 1, 126, 127, 128, 16382, 16383, 16384, 2097150, 2097151, 2097152];
        const more = [268435454, 268435455, 268435456, 0x7ffffffe];

        for (const value of [...values, ...more]) {
            const writer = new BinaryWriter(8);

            writer.len(value);
            expect(new BinaryReader(writer.buffer()).len()).toBe(value);
        }
    });

    it("rejects a length that never terminates", () => {
        expect(() => {
            reader(0x80, 0x80, 0x80, 0x80, 0x80, 0x01).len();
        }).toThrow(/Malformed length/);
    });

    it("rejects a length beyond the supported range", () => {
        expect(() => {
            reader(0xff, 0xff, 0xff, 0xff, 0x0f).len();
        }).toThrow(/Length out of range/);
    });

    it("throws when the varint is truncated", () => {
        expect(() => {
            reader(0x80).len();
        }).toThrow(/Buffer underflow/);
    });
});

describe("BinaryReader str", () => {
    it("reads strings of every script", () => {
        const samples = [
            "",
            "abc",
            "héllo",
            "€",
            "😀",
            "日本語",
            "mixed é€😀 text",
            "x".repeat(300),
        ];

        for (const sample of samples) {
            const writer = new BinaryWriter(1024);

            writer.str(sample);
            expect(new BinaryReader(writer.buffer()).str()).toBe(sample);
        }
    });

    it("rejects a null length", () => {
        expect(() => {
            reader(0).str();
        }).toThrow(/Unexpected null length/);
    });

    it("rejects a length longer than the remaining bytes", () => {
        expect(() => {
            reader(5, 0x61).str();
        }).toThrow(/Buffer underflow/);
    });

    it("does not advance when the string is truncated", () => {
        const source = reader(5, 0x61);

        expect(() => {
            source.str();
        }).toThrow();
        expect(source.remaining).toBe(1);
    });

    it("rejects invalid UTF-8 inside a string", () => {
        expect(() => {
            reader(3, 0xc0, 0x80).str();
        }).toThrow(/Overlong 2-byte/);
    });
});

describe("BinaryReader decodeString", () => {
    function decodeBytes(...bytes: number[]): string {
        return reader(...bytes).decodeString(0, bytes.length);
    }

    it("decodes valid sequences of each width", () => {
        expect(decodeBytes(0x41)).toBe("A");
        expect(decodeBytes(0xc3, 0xa9)).toBe("é");
        expect(decodeBytes(0xe2, 0x82, 0xac)).toBe("€");
        expect(decodeBytes(0xf0, 0x9f, 0x98, 0x80)).toBe("😀");
        expect(decodeBytes(0xf4, 0x8f, 0xbf, 0xbf)).toBe("\udbff\udfff");
        expect(decodeBytes(0xf0, 0x90, 0x80, 0x80)).toBe("\ud800\udc00");
    });

    it("decodes an empty range", () => {
        expect(reader(1, 2).decodeString(1, 0)).toBe("");
    });

    it("decodes from an offset without moving the cursor", () => {
        const source = reader(0x00, 0x68, 0x69);

        expect(source.decodeString(1, 2)).toBe("hi");
        expect(source.remaining).toBe(3);
    });

    it("agrees with TextDecoder", () => {
        const samples = ["", "plain", "héllo wörld", "日本語", "😀😀😀", "a\u0000b", "\u{10ffff}"];

        for (const sample of samples) {
            const encoded = new TextEncoder().encode(sample);

            expect(new BinaryReader(encoded).decodeString(0, encoded.length)).toBe(sample);
        }
    });

    it.each([
        ["an overlong two-byte sequence", [0xc0, 0x80], /Overlong 2-byte/],
        ["an overlong three-byte sequence", [0xe0, 0x80, 0x80], /Overlong 3-byte/],
        ["an encoded surrogate", [0xed, 0xa0, 0x80], /Lone surrogate U\+D800/],
        ["a four-byte overlong sequence", [0xf0, 0x80, 0x80, 0x80], /Invalid 4-byte/],
        ["a code point past U+10FFFF", [0xf4, 0x90, 0x80, 0x80], /Invalid 4-byte/],
        ["a five-byte lead", [0xf8, 0x88, 0x80, 0x80, 0x80], /Invalid UTF-8/],
        ["a stray continuation byte", [0x80], /Invalid UTF-8/],
        ["a truncated two-byte sequence", [0xc3], /Unexpected end of UTF-8/],
        ["a truncated three-byte sequence", [0xe2, 0x82], /Unexpected end of UTF-8/],
        ["a truncated four-byte sequence", [0xf0, 0x9f, 0x98], /Unexpected end of UTF-8/],
        ["a bad continuation byte", [0xc3, 0x28], /Invalid continuation byte/],
        ["a bad third byte", [0xe2, 0x82, 0x28], /Invalid continuation byte/],
    ])("rejects %s", (_label, bytes, pattern) => {
        expect(() => {
            decodeBytes(...(bytes as number[]));
        }).toThrow(pattern as RegExp);
    });

    it("rejects ranges outside the buffer", () => {
        const source = reader(1, 2, 3);

        expect(() => {
            source.decodeString(0, 100);
        }).toThrow("String range exceeds buffer");
        expect(() => {
            source.decodeString(-1, 1);
        }).toThrow("String range exceeds buffer");
        expect(() => {
            source.decodeString(0, -1);
        }).toThrow("String range exceeds buffer");
        expect(() => {
            source.decodeString(2, 2);
        }).toThrow("String range exceeds buffer");
    });
});

describe("BinaryReader dates", () => {
    it("reads a date back with millisecond precision", () => {
        const date = new Date(Date.UTC(2020, 0, 2, 3, 4, 5, 6));
        const writer = new BinaryWriter(32);

        writer.date(date);
        expect(new BinaryReader(writer.buffer()).date().getTime()).toBe(date.getTime());
    });

    it("reads extended-year dates", () => {
        const date = new Date(Date.UTC(10000, 0, 1));
        const writer = new BinaryWriter(32);

        writer.date(date);
        expect(new BinaryReader(writer.buffer()).date().getTime()).toBe(date.getTime());
    });

    it("rejects strings that are not dates", () => {
        const writer = new BinaryWriter(16);

        writer.str("not a date");
        expect(() => {
            new BinaryReader(writer.buffer()).date();
        }).toThrow("Invalid date string");
    });
});

describe("BinaryReader bytes", () => {
    it("returns the requested slice", () => {
        const source = reader(1, 2, 3, 4);

        expect(Array.from(source.bytes(2))).toEqual([1, 2]);
        expect(source.remaining).toBe(2);
    });

    it("returns an empty array for zero bytes", () => {
        expect(reader(1).bytes(0)).toHaveLength(0);
    });

    it("aliases the input rather than copying it", () => {
        const backing = new Uint8Array([1, 2, 3]);
        const out = new BinaryReader(backing).bytes(2);

        backing[0] = 42;
        expect(out[0]).toBe(42);
    });

    it("refuses to read past the end of a subarray view", () => {
        const backing = new Uint8Array([1, 2, 3, 4, 5]);
        const view = new BinaryReader(backing.subarray(1, 3));

        expect(() => {
            view.bytes(3);
        }).toThrow(/Buffer underflow/);
        expect(Array.from(view.bytes(2))).toEqual([2, 3]);
    });

    it("rejects negative lengths", () => {
        expect(() => {
            reader(1, 2).bytes(-1);
        }).toThrow(/Buffer underflow/);
    });

    it("reads a length-prefixed array", () => {
        const source = reader(3, 7, 8);

        expect(Array.from(source.uint8Array())).toEqual([7, 8]);
        expect(source.remaining).toBe(0);
    });

    it("rejects a null-length byte array", () => {
        expect(() => {
            reader(0).uint8Array();
        }).toThrow(/Buffer underflow/);
    });

    it("rejects a byte array longer than the buffer", () => {
        expect(() => {
            reader(9, 1, 2).uint8Array();
        }).toThrow(/Buffer underflow/);
    });
});

describe("BinaryReader flags", () => {
    it("expands a byte into eight booleans, least significant first", () => {
        expect(reader(0xa5).read8Bools()).toEqual([
            true,
            false,
            true,
            false,
            false,
            true,
            false,
            true,
        ]);
        expect(reader(0x00).read8Bools()).toEqual([
            false,
            false,
            false,
            false,
            false,
            false,
            false,
            false,
        ]);
        expect(reader(0xff).read8Bools()).toEqual([true, true, true, true, true, true, true, true]);
    });

    it("reads packed bits of mixed widths", () => {
        const result = reader(0x5d).readBits((bits) => [
            bits.bit(),
            bits.bit(),
            bits.uint2(),
            bits.uint4(),
        ]);

        expect(result).toEqual([true, false, 3, 5]);
    });

    it("sign-extends int2 and int4", () => {
        const writer = new BinaryWriter(8);

        writer.packBits((bits) => {
            bits.int2(-1).int2(-2).int2(1).int2(0).int4(-8).int4(7).int4(-1).int4(0);
        });

        const result = new BinaryReader(writer.buffer()).readBits((bits) => [
            bits.int2(),
            bits.int2(),
            bits.int2(),
            bits.int2(),
            bits.int4(),
            bits.int4(),
            bits.int4(),
            bits.int4(),
        ]);

        expect(result).toEqual([-1, -2, 1, 0, -8, 7, -1, 0]);
    });

    it("consumes only as many bytes as the bits it reads", () => {
        const source = reader(0xff, 0xff, 0xff);

        source.readBits((bits) => {
            bits.uint4();
            bits.uint4();
            bits.bit();
        });
        expect(source.remaining).toBe(1);
    });

    it("throws when the bits run past the buffer", () => {
        expect(() => {
            reader(0xff).readBits((bits) => {
                bits.uint4();
                bits.uint4();
                bits.bit();
            });
        }).toThrow(/Buffer underflow/);
    });

    it("returns whatever the callback returns", () => {
        expect(reader(0x01).readBits((bits) => (bits.bit() ? "set" : "clear"))).toBe("set");
    });
});

describe("BinaryReader any", () => {
    for (const [label, value, bytes] of ANY_VECTORS) {
        it(`decodes ${label}`, () => {
            const source = reader(...bytes);

            expect(source.any()).toStrictEqual(value);
            expect(source.remaining).toBe(0);
        });
    }

    it("exposes readAny as an alias", () => {
        expect(reader(4, 9).readAny()).toBe(9);
        expect(reader(16, 2, 12, 2, 0x61, 4, 1).readAny()).toEqual({ a: 1 });
    });

    it("decodes float64 NaN", () => {
        const writer = new BinaryWriter(16);

        writer.any(Number.NaN);
        expect(Number.isNaN(new BinaryReader(writer.buffer()).any())).toBe(true);
    });

    it("decodes the remaining fixed-width tags", () => {
        expect(reader(11, 0, 0, 0, 0, 0, 0, 0xf8, 0x3f).any()).toBe(1.5);
        expect(reader(8, 0x00, 0x80).any()).toBe(-32768);
        expect(reader(9, 0x00, 0x00, 0x00, 0x80).any()).toBe(-2147483648);
    });

    it("rejects unknown tags", () => {
        expect(() => {
            reader(99).any();
        }).toThrow("Unknown tag: 99");
        expect(() => {
            reader(17).any();
        }).toThrow("Unknown tag: 17");
        expect(() => {
            reader(255).any();
        }).toThrow("Unknown tag: 255");
    });

    it("rejects an empty buffer", () => {
        expect(() => {
            reader().any();
        }).toThrow(/Buffer underflow/);
    });

    it.each([
        ["a uint8 with no payload", [4]],
        ["a uint16 with one byte", [5, 1]],
        ["a float64 with seven bytes", [11, 0, 0, 0, 0, 0, 0, 0]],
        ["a string cut short", [12, 5, 0x61]],
        ["an array cut short", [14, 3, 4, 1]],
        ["an object cut short", [16, 2, 12, 2, 0x61]],
        ["a byte array cut short", [15, 5, 1]],
    ])("rejects %s", (_label, bytes) => {
        expect(() => {
            reader(...(bytes as number[])).any();
        }).toThrow();
    });

    it("rejects a string reference to an unknown index", () => {
        expect(() => {
            reader(13, 1).any();
        }).toThrow("Invalid string reference 0");
        expect(() => {
            reader(13, 5).any();
        }).toThrow("Invalid string reference 4");
    });

    it("rejects a null-length string reference", () => {
        expect(() => {
            reader(13, 0).any();
        }).toThrow();
    });

    it("resolves references through a shared string table", () => {
        const strings = new Map<string, number>();
        const writer = new BinaryWriter(32);

        writer.any("hello", strings).any("hello", strings);

        const source = new BinaryReader(writer.buffer());
        const table: string[] = [];

        expect(source.any(table)).toBe("hello");
        expect(source.any(table)).toBe("hello");
        expect(table).toEqual(["hello"]);
    });

    it("rejects an array that claims more elements than bytes remain", () => {
        const writer = new BinaryWriter(8);

        writer.uint8(14).len(1000);
        expect(() => {
            new BinaryReader(writer.buffer()).any();
        }).toThrow(/Invalid element count 1000/);
    });

    it("rejects an object that claims more entries than bytes remain", () => {
        const writer = new BinaryWriter(8);

        writer.uint8(16).len(10).uint8(1).uint8(2);
        expect(() => {
            new BinaryReader(writer.buffer()).any();
        }).toThrow(/Invalid element count 10/);
    });

    it("rejects an array claiming a gigantic length without allocating it", () => {
        const writer = new BinaryWriter(8);

        writer.uint8(14).len(0x7ffffffe);
        expect(() => {
            new BinaryReader(writer.buffer()).any();
        }).toThrow(/Invalid element count/);
    });

    it("rejects non-string object keys", () => {
        expect(() => {
            reader(16, 2, 4, 1, 4, 1).any();
        }).toThrow("Object key must be a string");
    });

    it("keeps __proto__ as an ordinary own property", () => {
        const writer = new BinaryWriter(64);

        writer.any(JSON.parse('{"__proto__":{"polluted":true}}'));

        const result = new BinaryReader(writer.buffer()).any() as Record<string, unknown>;

        expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
        expect(Object.prototype.hasOwnProperty.call(result, "__proto__")).toBe(true);
        expect(Object.keys(result)).toEqual(["__proto__"]);
        expect(({} as Record<string, unknown>)["polluted"]).toBeUndefined();
    });

    it("accepts nesting up to the limit and rejects beyond it", () => {
        expect(() => {
            new BinaryReader(nestedArrayBytes(257)).any();
        }).not.toThrow();
        expect(() => {
            new BinaryReader(nestedArrayBytes(258)).any();
        }).toThrow("Maximum nesting depth exceeded");
        expect(() => {
            new BinaryReader(nestedArrayBytes(5000)).any();
        }).toThrow("Maximum nesting depth exceeded");
    });

    it("returns byte arrays that alias the input", () => {
        const backing = new Uint8Array([15, 3, 1, 2]);
        const result = new BinaryReader(backing).any() as Uint8Array;

        backing[2] = 99;
        expect(result[0]).toBe(99);
    });

    it("leaves trailing bytes unread", () => {
        const source = reader(4, 1, 4, 2, 4, 3);

        expect(source.any()).toBe(1);
        expect(source.remaining).toBe(4);
    });
});

describe("BinaryReader readObject", () => {
    it("reads an object written by writeObject", () => {
        const writer = new BinaryWriter(64);

        writer.writeObject({ a: 1, b: "x", c: [true, null] });
        expect(new BinaryReader(writer.buffer()).readObject()).toEqual({
            a: 1,
            b: "x",
            c: [true, null],
        });
    });

    it("insists on an object tag", () => {
        expect(() => {
            reader(4, 1).readObject();
        }).toThrow("Expected object tag, got 4");
        expect(() => {
            reader(14, 1).readObject();
        }).toThrow("Expected object tag, got 14");
    });

    it("shares a string table across objects", () => {
        const strings = new Map<string, number>();
        const writer = new BinaryWriter(64);

        writer.writeObject({ name: "a" }, strings).writeObject({ name: "b" }, strings);

        const source = new BinaryReader(writer.buffer());
        const table: string[] = [];

        expect(source.readObject(table)).toEqual({ name: "a" });
        expect(source.readObject(table)).toEqual({ name: "b" });
    });
});
