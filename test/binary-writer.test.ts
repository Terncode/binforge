import { describe, expect, it } from "vitest";
import { BinaryTag } from "../src/types";
import { BinaryWriter } from "../src/writer";
import { ANY_VECTORS, nestArrays, nestObjects, toArray } from "./helpers";

type NumericMethod =
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

const NUMERIC_VECTORS: [NumericMethod, number, number[]][] = [
  ["int8", -128, [0x80]],
  ["int8", 127, [0x7f]],
  ["int8", -1, [0xff]],
  ["int8", 0, [0x00]],
  ["uint8", 0, [0x00]],
  ["uint8", 255, [0xff]],
  ["int16", 0x1234, [0x34, 0x12]],
  ["int16LE", -2, [0xfe, 0xff]],
  ["int16LE", -32768, [0x00, 0x80]],
  ["int16LE", 32767, [0xff, 0x7f]],
  ["int16BE", 0x1234, [0x12, 0x34]],
  ["int16BE", -2, [0xff, 0xfe]],
  ["int16BE", -32768, [0x80, 0x00]],
  ["uint16", 0x1234, [0x34, 0x12]],
  ["uint16LE", 65535, [0xff, 0xff]],
  ["uint16LE", 0x1234, [0x34, 0x12]],
  ["uint16BE", 0x1234, [0x12, 0x34]],
  ["uint16BE", 1, [0x00, 0x01]],
  ["int32", 0x12345678, [0x78, 0x56, 0x34, 0x12]],
  ["int32LE", -2, [0xfe, 0xff, 0xff, 0xff]],
  ["int32LE", -2147483648, [0x00, 0x00, 0x00, 0x80]],
  ["int32LE", 2147483647, [0xff, 0xff, 0xff, 0x7f]],
  ["int32BE", 0x12345678, [0x12, 0x34, 0x56, 0x78]],
  ["int32BE", -2, [0xff, 0xff, 0xff, 0xfe]],
  ["int32BE", -2147483648, [0x80, 0x00, 0x00, 0x00]],
  ["uint32", 0x12345678, [0x78, 0x56, 0x34, 0x12]],
  ["uint32LE", 0xdeadbeef, [0xef, 0xbe, 0xad, 0xde]],
  ["uint32LE", 0xffffffff, [0xff, 0xff, 0xff, 0xff]],
  ["uint32BE", 0xdeadbeef, [0xde, 0xad, 0xbe, 0xef]],
  ["uint32BE", 1, [0x00, 0x00, 0x00, 0x01]],
  ["float32", 1.5, [0x00, 0x00, 0xc0, 0x3f]],
  ["float32LE", -2, [0x00, 0x00, 0x00, 0xc0]],
  ["float32BE", 1.5, [0x3f, 0xc0, 0x00, 0x00]],
  ["float32BE", -2, [0xc0, 0x00, 0x00, 0x00]],
  ["float64", 1, [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xf0, 0x3f]],
  ["float64LE", -2, [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xc0]],
  ["float64BE", 1, [0x3f, 0xf0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]],
  ["float64BE", -2, [0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]],
];

const INVALID_VECTORS: [NumericMethod, number][] = [
  ["int8", 128],
  ["int8", -129],
  ["int8", 1.5],
  ["uint8", 256],
  ["uint8", -1],
  ["uint8", Number.NaN],
  ["int16", 32768],
  ["int16LE", -32769],
  ["int16BE", 32768],
  ["uint16", 65536],
  ["uint16LE", -1],
  ["uint16BE", 65536],
  ["int32", 2147483648],
  ["int32LE", -2147483649],
  ["int32BE", 2147483648],
  ["uint32", 4294967296],
  ["uint32LE", -1],
  ["uint32BE", 1.5],
  ["uint32", Number.NaN],
  ["uint32", Number.POSITIVE_INFINITY],
];

function rawBytes(writer: BinaryWriter): number[] {
  return Array.from(new Uint8Array(writer.buffer().buffer));
}

function write(writer: BinaryWriter, method: NumericMethod, value: number) {
  return writer[method](value);
}

describe("BinaryWriter numerics", () => {
  for (const [method, value, expected] of NUMERIC_VECTORS) {
    it(`${method}(${value}) writes ${expected.map((b) => b.toString(16)).join(" ")}`, () => {
      const writer = new BinaryWriter(8);

      write(writer, method, value);
      expect(toArray(writer.buffer())).toEqual(expected);
    });
  }

  for (const [method, value] of INVALID_VECTORS) {
    it(`${method}(${value}) throws and leaves the writer untouched`, () => {
      const writer = new BinaryWriter(8);

      expect(() => {
        write(writer, method, value);
      }).toThrow(RangeError);
      expect(writer.buffer()).toHaveLength(0);
    });
  }

  it("writes NaN and infinities as floats", () => {
    const writer = new BinaryWriter(32);

    writer
      .float32(Number.NaN)
      .float64(Number.NaN)
      .float32(Number.POSITIVE_INFINITY);

    const view = new DataView(writer.buffer().buffer);

    expect(Number.isNaN(view.getFloat32(0, true))).toBe(true);
    expect(Number.isNaN(view.getFloat64(4, true))).toBe(true);
    expect(view.getFloat32(12, true)).toBe(Number.POSITIVE_INFINITY);
  });

  it("throws a RangeError when the buffer is full", () => {
    expect(() => {
      new BinaryWriter(0).uint8(1);
    }).toThrow(RangeError);
    expect(() => {
      new BinaryWriter(1).uint16(1);
    }).toThrow(RangeError);
    expect(() => {
      new BinaryWriter(3).uint32(1);
    }).toThrow(RangeError);
    expect(() => {
      new BinaryWriter(7).float64(1);
    }).toThrow(RangeError);
  });

  it("accepts exactly as many bytes as it was sized for", () => {
    const writer = new BinaryWriter(4);

    writer.uint32(1);
    expect(writer.buffer()).toHaveLength(4);
    expect(() => {
      writer.uint8(1);
    }).toThrow(RangeError);
  });
});

describe("BinaryWriter basics", () => {
  it("starts empty", () => {
    expect(new BinaryWriter(0).buffer()).toHaveLength(0);
    expect(new BinaryWriter(16).buffer()).toHaveLength(0);
  });

  it("writes booleans as single bytes", () => {
    const writer = new BinaryWriter(2);

    writer.bool(true).bool(false);
    expect(toArray(writer.buffer())).toEqual([1, 0]);
  });

  it("writes a null length marker", () => {
    expect(toArray(new BinaryWriter(1).nullLen().buffer())).toEqual([0]);
  });

  it("returns the writer from every chainable method", () => {
    const writer = new BinaryWriter(512);
    const results = [
      writer.bool(true),
      writer.nullLen(),
      writer.int8(1),
      writer.uint8(1),
      writer.int16(1),
      writer.int16LE(1),
      writer.int16BE(1),
      writer.uint16(1),
      writer.uint16LE(1),
      writer.uint16BE(1),
      writer.int32(1),
      writer.int32LE(1),
      writer.int32BE(1),
      writer.uint32(1),
      writer.uint32LE(1),
      writer.uint32BE(1),
      writer.float32(1),
      writer.float32LE(1),
      writer.float32BE(1),
      writer.float64(1),
      writer.float64LE(1),
      writer.float64BE(1),
      writer.str("a"),
      writer.len(5),
      writer.strValue("b"),
      writer.uint8Array(new Uint8Array([1])),
      writer.bytes(new Uint8Array([1])),
      writer.write8Bools(true),
      writer.packBits((bits) => {
        bits.bit(true);
      }),
      writer.writeNullable(1, (w, value) => {
        w.uint8(value);
      }),
      writer.writeInternedString("c", new Map()),
      writer.any(1),
      writer.writeObject({}),
      writer.date(new Date(0)),
      writer.reset(),
    ];

    for (const result of results) {
      expect(result).toBe(writer);
    }
  });

  it("resets the write position and overwrites earlier bytes", () => {
    const writer = new BinaryWriter(4);

    writer.uint8(1).uint8(2).uint8(3);
    writer.reset();
    expect(writer.buffer()).toHaveLength(0);
    writer.uint8(9);
    expect(toArray(writer.buffer())).toEqual([9]);
    expect(rawBytes(writer)).toEqual([9, 2, 3, 0]);
  });

  it("lets buffer() alias live memory while copy() detaches", () => {
    const writer = new BinaryWriter(4);

    writer.uint8(1);

    const view = writer.buffer();
    const copy = writer.copy();

    writer.reset().uint8(9);
    expect(view[0]).toBe(9);
    expect(copy[0]).toBe(1);
    expect(copy.buffer).not.toBe(view.buffer);
  });
});

describe("BinaryWriter strings", () => {
  it.each([
    ["", [1]],
    ["abc", [4, 0x61, 0x62, 0x63]],
    ["é", [3, 0xc3, 0xa9]],
    ["€", [4, 0xe2, 0x82, 0xac]],
    ["😀", [5, 0xf0, 0x9f, 0x98, 0x80]],
    ["\ud800", [4, 0xef, 0xbf, 0xbd]],
    ["\udc00", [4, 0xef, 0xbf, 0xbd]],
    ["\ud800a", [5, 0xef, 0xbf, 0xbd, 0x61]],
    ["a\ud800", [5, 0x61, 0xef, 0xbf, 0xbd]],
  ])("str(%j) writes a length prefix and UTF-8", (value, expected) => {
    const writer = new BinaryWriter(16);

    writer.str(value!);
    expect(toArray(writer.buffer())).toEqual(expected);
  });

  it("produces the same bytes as TextEncoder, replacing lone surrogates", () => {
    const samples = [
      "",
      "plain",
      "héllo wörld",
      "日本語",
      "😀😀",
      "\ud800",
      "x\udc00y",
      "\ud83d\ud83d\ude00",
    ];

    for (const sample of samples) {
      const expected = Array.from(new TextEncoder().encode(sample));
      const writer = new BinaryWriter(expected.length + 8);

      writer.strValue(sample);
      expect(toArray(writer.buffer())).toEqual(expected);
    }
  });

  it("writes raw string bytes with strValue", () => {
    const writer = new BinaryWriter(8);

    writer.strValue("hi", 2);
    expect(toArray(writer.buffer())).toEqual([0x68, 0x69]);
  });

  it("throws when a string does not fit", () => {
    expect(() => {
      new BinaryWriter(2).strValue("abc");
    }).toThrow(RangeError);
    expect(() => {
      new BinaryWriter(3).str("abc");
    }).toThrow(RangeError);
  });

  it("writes long strings with multi-byte length prefixes", () => {
    const writer = new BinaryWriter(300);

    writer.str("x".repeat(200));
    expect(toArray(writer.buffer()).slice(0, 2)).toEqual([0xc9, 0x01]);
    expect(writer.buffer()).toHaveLength(202);
  });

  it("encodeStringTo writes at an explicit offset without moving the cursor", () => {
    const writer = new BinaryWriter(8);

    expect(writer.encodeStringTo(2, "ab")).toBe(4);
    expect(writer.buffer()).toHaveLength(0);
    expect(rawBytes(writer)).toEqual([0, 0, 0x61, 0x62, 0, 0, 0, 0]);
  });

  it.each([
    [0x41, [0x41]],
    [0x7ff, [0xdf, 0xbf]],
    [0x800, [0xe0, 0xa0, 0x80]],
    [0xffff, [0xef, 0xbf, 0xbf]],
    [0x10000, [0xf0, 0x90, 0x80, 0x80]],
    [0x10ffff, [0xf4, 0x8f, 0xbf, 0xbf]],
  ])("chr(%s) emits the matching UTF-8 sequence", (code, expected) => {
    const writer = new BinaryWriter(8);

    expect(writer.chr(0, code!)).toBe(expected!.length);
    expect(rawBytes(writer).slice(0, expected!.length)).toEqual(expected);
  });
});

describe("BinaryWriter len", () => {
  it.each([
    [0, [0x01]],
    [1, [0x02]],
    [126, [0x7f]],
    [127, [0x80, 0x01]],
    [16382, [0xff, 0x7f]],
    [16383, [0x80, 0x80, 0x01]],
    [2097150, [0xff, 0xff, 0x7f]],
    [2097151, [0x80, 0x80, 0x80, 0x01]],
    [268435454, [0xff, 0xff, 0xff, 0x7f]],
    [268435455, [0x80, 0x80, 0x80, 0x80, 0x01]],
    [0x7ffffffe, [0xff, 0xff, 0xff, 0xff, 0x07]],
  ])("encodes %s as a varint", (value, expected) => {
    const writer = new BinaryWriter(8);

    writer.len(value!);
    expect(toArray(writer.buffer())).toEqual(expected);
  });

  it.each([-1, 1.5, Number.NaN, 0x7fffffff, Number.POSITIVE_INFINITY])(
    "rejects %s",
    (value) => {
      expect(() => {
        new BinaryWriter(8).len(value);
      }).toThrow("Invalid length value");
    },
  );
});

describe("BinaryWriter bytes", () => {
  it("writes raw bytes without a prefix", () => {
    const writer = new BinaryWriter(4);

    writer.bytes(new Uint8Array([1, 2, 3]));
    expect(toArray(writer.buffer())).toEqual([1, 2, 3]);
  });

  it("writes a length-prefixed byte array", () => {
    const writer = new BinaryWriter(8);

    writer.uint8Array(new Uint8Array([7, 8, 9]));
    expect(toArray(writer.buffer())).toEqual([4, 7, 8, 9]);
  });

  it("writes an empty byte array as a bare length", () => {
    const writer = new BinaryWriter(2);

    writer.uint8Array(new Uint8Array(0));
    expect(toArray(writer.buffer())).toEqual([1]);
  });

  it("writes only the visible part of a subarray", () => {
    const source = new Uint8Array([9, 1, 2, 3, 9]).subarray(1, 4);
    const writer = new BinaryWriter(8);

    writer.uint8Array(source);
    expect(toArray(writer.buffer())).toEqual([4, 1, 2, 3]);
  });

  it("throws when the bytes do not fit", () => {
    expect(() => {
      new BinaryWriter(2).bytes(new Uint8Array(3));
    }).toThrow(RangeError);
  });
});

describe("BinaryWriter dates", () => {
  it("writes the ISO string with a length prefix", () => {
    const writer = new BinaryWriter(32);
    const iso = "2020-01-02T03:04:05.006Z";

    writer.date(new Date(Date.UTC(2020, 0, 2, 3, 4, 5, 6)));
    expect(toArray(writer.buffer())).toEqual([
      25,
      ...new TextEncoder().encode(iso),
    ]);
    expect(writer.buffer()).toHaveLength(BinaryWriter.DATE_ISO_STRING);
  });

  it("rejects invalid dates", () => {
    expect(() => {
      new BinaryWriter(32).date(new Date(Number.NaN));
    }).toThrow(RangeError);
  });
});

describe("BinaryWriter flags", () => {
  it.each([
    [[false], 0x00],
    [[true], 0x01],
    [[true, false, true], 0x05],
    [[false, false, false, false, false, false, false, true], 0x80],
    [[true, true, true, true, true, true, true, true], 0xff],
  ])("write8Bools(%j) writes %s", (flags, expected) => {
    const writer = new BinaryWriter(1);

    writer.write8Bools(...(flags as [boolean, ...boolean[]]));
    expect(toArray(writer.buffer())).toEqual([expected]);
  });

  it("packs mixed bit widths least significant bit first", () => {
    const writer = new BinaryWriter(2);

    writer.packBits((bits) => {
      bits.bit(true).bit(false).uint2(3).uint4(5);
    });
    expect(toArray(writer.buffer())).toEqual([0x5d]);
  });

  it("flushes a partial trailing byte", () => {
    const writer = new BinaryWriter(2);

    writer.packBits((bits) => {
      bits.bit(true);
    });
    expect(toArray(writer.buffer())).toEqual([0x01]);
  });

  it("writes nothing when no bits were packed", () => {
    const writer = new BinaryWriter(2);

    writer.packBits(() => {});
    expect(writer.buffer()).toHaveLength(0);
  });

  it("spills into a second byte after eight bits", () => {
    const writer = new BinaryWriter(2);

    writer.packBits((bits) => {
      bits.uint4(15).uint4(0).bit(true);
    });
    expect(toArray(writer.buffer())).toEqual([0x0f, 0x01]);
  });

  it("stores signed values in two's complement", () => {
    const writer = new BinaryWriter(2);

    writer.packBits((bits) => {
      bits.int2(-1).int2(-2).int4(-8);
    });
    expect(toArray(writer.buffer())).toEqual([0x8b]);
  });

  it("rejects values that do not fit their width", () => {
    const writer = new BinaryWriter(2);

    expect(() => {
      writer.packBits((bits) => {
        bits.uint2(4);
      });
    }).toThrow(RangeError);
  });
});

describe("BinaryWriter nullable", () => {
  it("writes a zero marker for null and undefined", () => {
    const writer = new BinaryWriter(2);

    writer.writeNullable(null, (w) => {
      w.uint8(9);
    });
    writer.writeNullable(undefined, (w) => {
      w.uint8(9);
    });
    expect(toArray(writer.buffer())).toEqual([0, 0]);
  });

  it("writes a one marker followed by the payload", () => {
    const writer = new BinaryWriter(4);

    writer.writeNullable(7, (w, value) => {
      w.uint8(value);
    });
    expect(toArray(writer.buffer())).toEqual([1, 7]);
  });

  it("treats falsy values as present", () => {
    const writer = new BinaryWriter(8);

    writer.writeNullable(0, (w, value) => {
      w.uint8(value);
    });
    writer.writeNullable("", (w, value) => {
      w.str(value);
    });
    expect(toArray(writer.buffer())).toEqual([1, 0, 1, 1]);
  });
});

describe("BinaryWriter interning", () => {
  it("writes a new string once and references it afterwards", () => {
    const writer = new BinaryWriter(16);
    const strings = new Map<string, number>();

    writer.writeInternedString("a", strings);
    writer.writeInternedString("a", strings);
    writer.writeInternedString("b", strings);
    writer.writeInternedString("a", strings);
    expect(toArray(writer.buffer())).toEqual([
      12, 2, 0x61, 13, 1, 12, 2, 0x62, 13, 1,
    ]);
    expect(strings.get("a")).toBe(0);
    expect(strings.get("b")).toBe(1);
  });
});

describe("BinaryWriter any", () => {
  for (const [label, value, expected] of ANY_VECTORS) {
    it(`encodes ${label}`, () => {
      const writer = new BinaryWriter(64);

      writer.any(value);
      expect(toArray(writer.buffer())).toEqual(expected);
    });
  }

  it("encodes NaN as a float64", () => {
    const writer = new BinaryWriter(16);

    writer.any(Number.NaN);
    expect(writer.buffer()[0]).toBe(BinaryTag.Float64);
    expect(writer.buffer()).toHaveLength(9);
  });

  it("picks the narrowest tag at every integer boundary", () => {
    const cases: [number, BinaryTag][] = [
      [0, BinaryTag.Uint8],
      [255, BinaryTag.Uint8],
      [256, BinaryTag.Uint16],
      [65535, BinaryTag.Uint16],
      [65536, BinaryTag.Uint32],
      [4294967295, BinaryTag.Uint32],
      [-1, BinaryTag.Int8],
      [-128, BinaryTag.Int8],
      [-129, BinaryTag.Int16],
      [-32768, BinaryTag.Int16],
      [-32769, BinaryTag.Int32],
      [-2147483648, BinaryTag.Int32],
      [-2147483649, BinaryTag.Float64],
      [4294967296, BinaryTag.Float32],
      [Number.MAX_SAFE_INTEGER, BinaryTag.Float64],
    ];

    for (const [value, tag] of cases) {
      const writer = new BinaryWriter(16);

      writer.any(value);
      expect(writer.buffer()[0]).toBe(tag);
    }
  });

  it("shares one string table across calls when given the same map", () => {
    const strings = new Map<string, number>();
    const writer = new BinaryWriter(32);

    writer.any("hello", strings).any("hello", strings);
    expect(toArray(writer.buffer())).toEqual([
      12, 6, 0x68, 0x65, 0x6c, 0x6c, 0x6f, 13, 1,
    ]);
  });

  it("starts a fresh string table for every call by default", () => {
    const writer = new BinaryWriter(32);

    writer.any("a").any("a");
    expect(toArray(writer.buffer())).toEqual([12, 2, 0x61, 12, 2, 0x61]);
  });

  it("interns empty strings and empty keys", () => {
    const writer = new BinaryWriter(32);

    writer.any({ "": "" });
    expect(toArray(writer.buffer())).toEqual([16, 2, 12, 1, 13, 1]);
  });

  it("omits keys for nothing and keeps undefined values", () => {
    const writer = new BinaryWriter(16);

    writer.any({ a: undefined });
    expect(toArray(writer.buffer())).toEqual([16, 2, 12, 2, 0x61, 0]);
  });

  it.each([
    ["a date", new Date(), "Unsupported object type"],
    ["a map", new Map(), "Unsupported object type"],
    ["a set", new Set(), "Unsupported object type"],
    ["an array buffer", new ArrayBuffer(2), "Unsupported object type"],
    ["an int16 array", new Int16Array(2), "Unsupported object type"],
    ["a function", function () {}, "Invalid type: function"],
    ["a symbol", Symbol("x"), "Invalid type: symbol"],
    ["a bigint", BigInt(10), "Invalid type: bigint"],
  ])("rejects %s", (_label, value, message) => {
    expect(() => {
      new BinaryWriter(64).any(value);
    }).toThrow(message as string);
  });

  it("enforces the nesting limit", () => {
    expect(() => {
      new BinaryWriter(2048).any(nestArrays(257));
    }).not.toThrow();
    expect(() => {
      new BinaryWriter(2048).any(nestArrays(258));
    }).toThrow("Maximum nesting depth exceeded");
    expect(() => {
      new BinaryWriter(8192).any(nestObjects(258));
    }).toThrow("Maximum nesting depth exceeded");
  });

  it("rejects circular references", () => {
    const loop: unknown[] = [];
    loop.push(loop);

    expect(() => {
      new BinaryWriter(4096).any(loop);
    }).toThrow("Maximum nesting depth exceeded");
  });
});

describe("BinaryWriter writeObject", () => {
  it("writes an object body", () => {
    const writer = new BinaryWriter(16);

    writer.writeObject({ a: 1 });
    expect(toArray(writer.buffer())).toEqual([16, 2, 12, 2, 0x61, 4, 1]);
  });

  it("shares a caller supplied string table", () => {
    const strings = new Map<string, number>([["a", 0]]);
    const writer = new BinaryWriter(16);

    writer.writeObject({ a: 1 }, strings);
    expect(toArray(writer.buffer())).toEqual([16, 2, 13, 1, 4, 1]);
  });

  it("rejects unsupported objects", () => {
    expect(() => {
      new BinaryWriter(16).writeObject(
        new Date() as unknown as Record<string, unknown>,
      );
    }).toThrow("Unsupported object type");
  });
});
