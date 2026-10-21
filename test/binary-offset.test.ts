import { describe, expect, it } from "vitest";
import { BinaryOffset } from "../src/offset";
import { nestArrays, nestObjects } from "./helpers";

const EXPECTED_SIZES = {
  BOOLEAN: 1,
  BOOLS8: 1,
  INT8: 1,
  UINT8: 1,
  INT16: 2,
  UINT16: 2,
  INT32: 4,
  UINT32: 4,
  FLOAT32: 4,
  FLOAT64: 8,
  DATE_ISO_STRING: 25,
} as const;

describe("BinaryOffset sizes", () => {
  for (const name of Object.keys(
    EXPECTED_SIZES,
  ) as (keyof typeof EXPECTED_SIZES)[]) {
    it(`reports ${name} on the class and on instances`, () => {
      expect(BinaryOffset[name]).toBe(EXPECTED_SIZES[name]);
      expect(new BinaryOffset()[name]).toBe(EXPECTED_SIZES[name]);
    });
  }
});

describe("BinaryOffset.assertInteger", () => {
  it("accepts values inside the range, boundaries included", () => {
    expect(() => {
      BinaryOffset.assertInteger(0, 0, 255);
    }).not.toThrow();
    expect(() => {
      BinaryOffset.assertInteger(255, 0, 255);
    }).not.toThrow();
    expect(() => {
      BinaryOffset.assertInteger(-8, -8, 7);
    }).not.toThrow();
  });

  it.each([
    [256, 0, 255],
    [-1, 0, 255],
    [1.5, 0, 255],
    [Number.NaN, 0, 255],
    [Number.POSITIVE_INFINITY, 0, 255],
    [Number.NEGATIVE_INFINITY, -10, 10],
  ])("rejects %s outside %s..%s", (value, min, max) => {
    expect(() => {
      BinaryOffset.assertInteger(value!, min!, max!);
    }).toThrow(RangeError);
  });
});

describe("BinaryOffset.isoString", () => {
  it("formats valid dates", () => {
    const date = new Date(Date.UTC(2020, 0, 2, 3, 4, 5, 6));

    expect(BinaryOffset.isoString(date)).toBe("2020-01-02T03:04:05.006Z");
  });

  it("rejects invalid dates", () => {
    expect(() => {
      BinaryOffset.isoString(new Date(Number.NaN));
    }).toThrow(/Invalid Date/);
  });
});

describe("BinaryOffset.isUnsupportedObject", () => {
  it("flags dates, maps, sets, buffers and views", () => {
    expect(BinaryOffset.isUnsupportedObject(new Date())).toBe(true);
    expect(BinaryOffset.isUnsupportedObject(new Map())).toBe(true);
    expect(BinaryOffset.isUnsupportedObject(new Set())).toBe(true);
    expect(BinaryOffset.isUnsupportedObject(new ArrayBuffer(1))).toBe(true);
    expect(BinaryOffset.isUnsupportedObject(new Uint8Array(1))).toBe(true);
    expect(BinaryOffset.isUnsupportedObject(new Int16Array(1))).toBe(true);
    expect(
      BinaryOffset.isUnsupportedObject(new DataView(new ArrayBuffer(1))),
    ).toBe(true);
  });

  it("lets plain objects and arrays through", () => {
    expect(BinaryOffset.isUnsupportedObject({})).toBe(false);
    expect(BinaryOffset.isUnsupportedObject([])).toBe(false);
    expect(BinaryOffset.isUnsupportedObject({ a: 1 })).toBe(false);
  });
});

describe("BinaryOffset.isFloat32Exact", () => {
  it.each([
    [0.5, true],
    [1.5, true],
    [16777216, true],
    [Number.POSITIVE_INFINITY, true],
    [-0, true],
    [0.1, false],
    [16777217, false],
    [Number.NaN, false],
    [Number.MAX_VALUE, false],
    [1e-50, false],
  ])("classifies %s as %s", (value, expected) => {
    expect(BinaryOffset.isFloat32Exact(value as number)).toBe(expected);
  });
});

describe("BinaryOffset.createBitWriter", () => {
  it("forwards value and width for every method and chains", () => {
    const calls: [number, number][] = [];
    const bits = BinaryOffset.createBitWriter((value, count) => {
      calls.push([value, count]);
    });

    const result = bits
      .bit(true)
      .bit(0)
      .bit(5)
      .uint2(3)
      .int2(-1)
      .int2(-2)
      .int2(1)
      .uint4(15)
      .int4(-8)
      .int4(7);

    expect(result).toBe(bits);
    expect(calls).toEqual([
      [1, 1],
      [0, 1],
      [1, 1],
      [3, 2],
      [3, 2],
      [2, 2],
      [1, 2],
      [15, 4],
      [8, 4],
      [7, 4],
    ]);
  });

  it("rejects values that do not fit", () => {
    const bits = BinaryOffset.createBitWriter(() => {});

    expect(() => {
      bits.uint2(4);
    }).toThrow(RangeError);
    expect(() => {
      bits.uint2(-1);
    }).toThrow(RangeError);
    expect(() => {
      bits.int2(2);
    }).toThrow(RangeError);
    expect(() => {
      bits.int2(-3);
    }).toThrow(RangeError);
    expect(() => {
      bits.uint4(16);
    }).toThrow(RangeError);
    expect(() => {
      bits.int4(8);
    }).toThrow(RangeError);
    expect(() => {
      bits.int4(-9);
    }).toThrow(RangeError);
    expect(() => {
      bits.uint4(1.5);
    }).toThrow(RangeError);
  });
});

describe("BinaryOffset.getLength", () => {
  it.each([
    [0, 1],
    [126, 1],
    [127, 2],
    [16382, 2],
    [16383, 3],
    [2097150, 3],
    [2097151, 4],
    [268435454, 4],
    [268435455, 5],
    [0x7ffffffe, 5],
  ])("sizes %s as %s bytes", (value, expected) => {
    expect(BinaryOffset.getLength(value!)).toBe(expected);
    expect(new BinaryOffset().getLength(value!)).toBe(expected);
  });

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 0x7fffffff])(
    "rejects %s",
    (value) => {
      expect(() => {
        BinaryOffset.getLength(value);
      }).toThrow("Invalid length value");
    },
  );
});

describe("BinaryOffset.nullableLen", () => {
  it("costs one byte for null and undefined", () => {
    expect(BinaryOffset.nullableLen(null, () => 10)).toBe(1);
    expect(BinaryOffset.nullableLen(undefined, () => 10)).toBe(1);
  });

  it("adds the payload size for present values, including falsy ones", () => {
    expect(BinaryOffset.nullableLen(5, () => 3)).toBe(4);
    expect(BinaryOffset.nullableLen(0, () => 3)).toBe(4);
    expect(BinaryOffset.nullableLen("", () => 1)).toBe(2);
    expect(new BinaryOffset().nullableLen(5, () => 3)).toBe(4);
  });
});

describe("BinaryOffset.getShortLength", () => {
  it.each([
    [0, 1],
    [30, 1],
    [31, 2],
    [126, 2],
    [127, 3],
  ])("sizes %s as %s bytes", (value, expected) => {
    expect(BinaryOffset.getShortLength(value!)).toBe(expected);
    expect(new BinaryOffset().getShortLength(value!)).toBe(expected);
  });
});

describe("BinaryOffset.charLengthInBytes", () => {
  it.each([
    [0x00, 1],
    [0x7f, 1],
    [0x80, 2],
    [0x7ff, 2],
    [0x800, 3],
    [0xffff, 3],
    [0x10000, 4],
    [0x10ffff, 4],
  ])("sizes code point %s as %s bytes", (code, expected) => {
    expect(BinaryOffset.charLengthInBytes(code!)).toBe(expected);
    expect(new BinaryOffset().charLengthInBytes(code!)).toBe(expected);
  });
});

describe("BinaryOffset.stringLengthInBytes", () => {
  it.each([
    ["", 0],
    ["abc", 3],
    ["\u0000", 1],
    ["\u007f", 1],
    ["\u0080", 2],
    ["\u07ff", 2],
    ["\u0800", 3],
    ["\uffff", 3],
    ["é", 2],
    ["€", 3],
    ["😀", 4],
    ["a😀b", 6],
    ["\ud800", 3],
    ["\udc00", 3],
    ["\ud800a", 4],
    ["a\ud800", 4],
    ["\ud83d\ud83d\ude00", 7],
  ])("measures %j as %s bytes", (value, expected) => {
    expect(BinaryOffset.stringLengthInBytes(value!)).toBe(expected);
    expect(new BinaryOffset().stringLengthInBytes(value!)).toBe(expected);
  });

  it("agrees with TextEncoder for well-formed text", () => {
    const samples = [
      "",
      "plain",
      "héllo wörld",
      "日本語",
      "😀😀",
      "mixed é€😀 text",
    ];

    for (const sample of samples) {
      expect(BinaryOffset.stringLengthInBytes(sample)).toBe(
        new TextEncoder().encode(sample).length,
      );
    }
  });
});

describe("BinaryOffset.string", () => {
  it.each([
    ["", 1],
    ["abc", 4],
    ["é", 3],
    ["€", 4],
    ["😀", 5],
    ["x".repeat(126), 127],
    ["x".repeat(127), 129],
  ])("sizes %j including its length prefix as %s", (value, expected) => {
    expect(BinaryOffset.string(value!)).toBe(expected);
    expect(new BinaryOffset().string(value!)).toBe(expected);
  });
});

describe("BinaryOffset buffer helpers", () => {
  it("sizes a buffer with its length prefix", () => {
    expect(BinaryOffset.getBufferLengthWithLength(new Uint8Array(0))).toBe(1);
    expect(BinaryOffset.getBufferLengthWithLength(new Uint8Array(3))).toBe(4);
    expect(BinaryOffset.getBufferLengthWithLength(new Uint8Array(200))).toBe(
      202,
    );
    expect(
      new BinaryOffset().getBufferLengthWithLength(new Uint8Array(3)),
    ).toBe(4);
  });

  it("measures the view, never the whole backing store", () => {
    const view = new Uint8Array(100).subarray(10, 13);

    expect(BinaryOffset.getBufferLengthWithLength(view)).toBe(4);
    expect(new BinaryOffset().getUint8ArrayLen(view)).toBe(4);
  });
});

describe("BinaryOffset.getNumberLength", () => {
  it.each([
    [0, 2],
    [255, 2],
    [256, 3],
    [65535, 3],
    [65536, 5],
    [2147483647, 5],
    [2147483648, 5],
    [4294967295, 5],
    [4294967296, 5],
    [-1, 2],
    [-128, 2],
    [-129, 3],
    [-32768, 3],
    [-32769, 5],
    [-2147483648, 5],
    [-2147483649, 9],
    [0.5, 5],
    [1.5, 5],
    [0.1, 9],
    [Math.PI, 9],
    [Number.POSITIVE_INFINITY, 5],
    [Number.NEGATIVE_INFINITY, 5],
    [Number.NaN, 9],
    [-0, 5],
    [Number.MAX_SAFE_INTEGER, 9],
    [Number.MAX_VALUE, 9],
    [Number.MIN_VALUE, 9],
  ])("sizes %s as %s bytes", (value, expected) => {
    expect(BinaryOffset.getNumberLength(value!)).toBe(expected);
  });
});

describe("BinaryOffset.getInternedStringLength", () => {
  it("charges full price once and a reference afterwards", () => {
    const strings = new Map<string, number>();

    expect(BinaryOffset.getInternedStringLength("hello", strings)).toBe(7);
    expect(BinaryOffset.getInternedStringLength("hello", strings)).toBe(2);
    expect(BinaryOffset.getInternedStringLength("world", strings)).toBe(7);
    expect(strings.get("hello")).toBe(0);
    expect(strings.get("world")).toBe(1);
  });

  it("grows the reference once the index needs two bytes", () => {
    const strings = new Map<string, number>();

    for (let i = 0; i < 200; i++) {
      BinaryOffset.getInternedStringLength(`s${i}`, strings);
    }

    expect(BinaryOffset.getInternedStringLength("s0", strings)).toBe(2);
    expect(BinaryOffset.getInternedStringLength("s126", strings)).toBe(2);
    expect(BinaryOffset.getInternedStringLength("s127", strings)).toBe(3);
    expect(BinaryOffset.getInternedStringLength("s199", strings)).toBe(3);
  });
});

describe("BinaryOffset.getAnyLength", () => {
  it.each([
    ["undefined", undefined, 1],
    ["null", null, 1],
    ["true", true, 1],
    ["false", false, 1],
    ["small number", 7, 2],
    ["float64", 0.1, 9],
    ["empty string", "", 2],
    ["short string", "abc", 5],
    ["empty array", [], 2],
    ["array of numbers", [1, 2], 6],
    ["empty object", {}, 2],
    ["object with a key", { a: 1 }, 7],
    ["empty bytes", new Uint8Array(0), 2],
    ["three bytes", new Uint8Array(3), 5],
    ["two hundred bytes", new Uint8Array(200), 203],
    ["repeated strings", ["a", "a", "b", "a"], 12],
    ["same string as key and value", { a: "a" }, 7],
  ])("sizes %s", (_label, value, expected) => {
    expect(BinaryOffset.getAnyLength(value)).toBe(expected);
    expect(new BinaryOffset().getAnyLength(value)).toBe(expected);
  });

  it("shares interned strings through a caller supplied map", () => {
    const strings = new Map<string, number>();

    expect(BinaryOffset.getAnyLength("hello", strings)).toBe(7);
    expect(BinaryOffset.getAnyLength("hello", strings)).toBe(2);
    expect(strings.size).toBe(1);
  });

  it("starts every call with a fresh map by default", () => {
    expect(BinaryOffset.getAnyLength("hello")).toBe(7);
    expect(BinaryOffset.getAnyLength("hello")).toBe(7);
  });

  it("sizes subarray views by their own length", () => {
    const view = new Uint8Array(100).subarray(5, 8);

    expect(BinaryOffset.getAnyLength(view)).toBe(5);
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
    ["a date nested in an array", [new Date()], "Unsupported object type"],
    [
      "a map nested in an object",
      { inner: new Map() },
      "Unsupported object type",
    ],
  ])("rejects %s", (_label, value, message) => {
    expect(() => {
      BinaryOffset.getAnyLength(value);
    }).toThrow(message as string);
  });

  it("accepts nesting up to the limit and rejects beyond it", () => {
    expect(() => {
      BinaryOffset.getAnyLength(nestArrays(257));
    }).not.toThrow();
    expect(() => {
      BinaryOffset.getAnyLength(nestArrays(258));
    }).toThrow("Maximum nesting depth exceeded");
    expect(() => {
      BinaryOffset.getAnyLength(nestObjects(257));
    }).not.toThrow();
    expect(() => {
      BinaryOffset.getAnyLength(nestObjects(258));
    }).toThrow("Maximum nesting depth exceeded");
  });

  it("rejects circular references instead of overflowing the stack", () => {
    const loop: unknown[] = [];
    loop.push(loop);

    const record: Record<string, unknown> = {};
    record["self"] = record;

    expect(() => {
      BinaryOffset.getAnyLength(loop);
    }).toThrow("Maximum nesting depth exceeded");
    expect(() => {
      BinaryOffset.getAnyLength(record);
    }).toThrow("Maximum nesting depth exceeded");
  });
});
