import { describe, expect, it } from "vitest";
import { BinaryReader } from "../src/reader";
import { BinaryWriter } from "../src/writer";
import { BinaryDynamicWriter } from "../src/writer-dynamic";
import { toArray } from "./helpers";

const SAMPLE_DATE = new Date(Date.UTC(2020, 0, 2, 3, 4, 5, 6));

function fill(sink: BinaryWriter | BinaryDynamicWriter) {
    sink.bool(true)
        .int8(-5)
        .uint8(200)
        .int16(-300)
        .int16LE(-300)
        .int16BE(-300)
        .uint16(500)
        .uint16LE(500)
        .uint16BE(500)
        .int32(-70000)
        .int32LE(-70000)
        .int32BE(-70000)
        .uint32(3000000000)
        .uint32LE(3000000000)
        .uint32BE(3000000000)
        .float32(1.5)
        .float32LE(1.5)
        .float32BE(1.5)
        .float64(Math.PI)
        .float64LE(Math.PI)
        .float64BE(Math.PI)
        .str("héllo")
        .len(300)
        .uint8Array(new Uint8Array([1, 2, 3]))
        .bytes(new Uint8Array([4, 5]))
        .write8Bools(true, false, true)
        .strValue("raw")
        .nullLen()
        .date(SAMPLE_DATE);
}

describe("BinaryDynamicWriter", () => {
    it("starts empty", () => {
        expect(new BinaryDynamicWriter().buffer()).toHaveLength(0);
    });

    it("produces the same bytes as BinaryWriter for the same calls", () => {
        const dynamic = new BinaryDynamicWriter();
        const direct = new BinaryWriter(512);

        fill(dynamic);
        fill(direct);
        expect(toArray(dynamic.buffer())).toEqual(toArray(direct.buffer()));
    });

    it("produces bytes the reader understands", () => {
        const dynamic = new BinaryDynamicWriter();

        dynamic.uint16BE(0x1234).uint32LE(0xdeadbeef).float64(Math.E).str("日本語").bool(false);

        const reader = new BinaryReader(dynamic.buffer());

        expect(reader.uint16BE()).toBe(0x1234);
        expect(reader.uint32LE()).toBe(0xdeadbeef);
        expect(reader.float64()).toBe(Math.E);
        expect(reader.str()).toBe("日本語");
        expect(reader.bool()).toBe(false);
        expect(reader.remaining).toBe(0);
    });

    it("returns itself from every chainable method", () => {
        const dynamic = new BinaryDynamicWriter();
        const results = [
            dynamic.bool(true),
            dynamic.nullLen(),
            dynamic.int8(1),
            dynamic.uint8(1),
            dynamic.int16(1),
            dynamic.uint16(1),
            dynamic.int32(1),
            dynamic.uint32(1),
            dynamic.float32(1),
            dynamic.float64(1),
            dynamic.str("a"),
            dynamic.len(1),
            dynamic.strValue("a"),
            dynamic.uint8Array(new Uint8Array(1)),
            dynamic.bytes(new Uint8Array(1)),
            dynamic.write8Bools(true),
            dynamic.date(SAMPLE_DATE),
            dynamic.writeNullable(null, () => {}),
            dynamic.packBits(() => {}),
        ];

        for (const result of results) {
            expect(result).toBe(dynamic);
        }
    });

    it("writes the unsuffixed numerics as little-endian", () => {
        const dynamic = new BinaryDynamicWriter();

        dynamic.uint16(0x1234).int32(-2).float32(1.5);
        expect(toArray(dynamic.buffer())).toEqual([
            0x34, 0x12, 0xfe, 0xff, 0xff, 0xff, 0x00, 0x00, 0xc0, 0x3f,
        ]);
    });

    it("writes the BE variants as big-endian", () => {
        const dynamic = new BinaryDynamicWriter();

        dynamic.uint16BE(0x1234).int32BE(-2).float32BE(1.5);
        expect(toArray(dynamic.buffer())).toEqual([
            0x12, 0x34, 0xff, 0xff, 0xff, 0xfe, 0x3f, 0xc0, 0x00, 0x00,
        ]);
    });

    it("writes nullable values with a marker byte", () => {
        const dynamic = new BinaryDynamicWriter();

        dynamic.writeNullable(null, (w) => {
            w.uint8(9);
        });
        dynamic.writeNullable(undefined, (w) => {
            w.uint8(9);
        });
        dynamic.writeNullable(7, (w, value) => {
            w.uint8(value);
        });
        dynamic.writeNullable(0, (w, value) => {
            w.uint8(value);
        });
        expect(toArray(dynamic.buffer())).toEqual([0, 0, 1, 7, 1, 0]);
    });

    it("packs bits exactly like BinaryWriter", () => {
        const dynamic = new BinaryDynamicWriter();

        dynamic.packBits((bits) => {
            bits.bit(true).bit(false).uint2(3).uint4(5);
        });
        expect(toArray(dynamic.buffer())).toEqual([0x5d]);
    });

    it("flushes a partial byte and spills across bytes", () => {
        const dynamic = new BinaryDynamicWriter();

        dynamic.packBits((bits) => {
            bits.uint4(15).uint4(0).bit(true);
        });
        expect(toArray(dynamic.buffer())).toEqual([0x0f, 0x01]);
    });

    it("writes nothing for an empty packBits", () => {
        const dynamic = new BinaryDynamicWriter();

        dynamic.packBits(() => {});
        expect(dynamic.buffer()).toHaveLength(0);
    });

    it("returns independent buffers on repeated calls", () => {
        const dynamic = new BinaryDynamicWriter();

        dynamic.uint8(1).uint8(2);

        const first = dynamic.buffer();
        const second = dynamic.buffer();

        expect(toArray(first)).toEqual([1, 2]);
        expect(toArray(second)).toEqual([1, 2]);
        first[0] = 99;
        expect(second[0]).toBe(1);
    });

    it("includes writes made after an earlier buffer() call", () => {
        const dynamic = new BinaryDynamicWriter();

        dynamic.uint8(1);
        expect(toArray(dynamic.buffer())).toEqual([1]);
        dynamic.uint8(2);
        expect(toArray(dynamic.buffer())).toEqual([1, 2]);
    });

    it("rejects invalid dates and lengths immediately", () => {
        expect(() => {
            new BinaryDynamicWriter().date(new Date(Number.NaN));
        }).toThrow(RangeError);
        expect(() => {
            new BinaryDynamicWriter().len(-1);
        }).toThrow("Invalid length value");
    });

    it("surfaces out-of-range integers no later than buffer()", () => {
        const methods: ((writer: BinaryDynamicWriter) => void)[] = [
            function (writer) {
                writer.uint8(300);
            },
            function (writer) {
                writer.int8(-129);
            },
            function (writer) {
                writer.uint16(65536);
            },
            function (writer) {
                writer.int32BE(2147483648);
            },
            function (writer) {
                writer.uint32(-1);
            },
        ];

        for (const method of methods) {
            expect(() => {
                const dynamic = new BinaryDynamicWriter();

                method(dynamic);
                dynamic.buffer();
            }).toThrow(RangeError);
        }
    });

    it("handles large payloads", () => {
        const dynamic = new BinaryDynamicWriter();
        const payload = new Uint8Array(70000).fill(7);

        dynamic.uint8Array(payload).str("x".repeat(20000));

        const reader = new BinaryReader(dynamic.buffer());

        expect(reader.uint8Array()).toHaveLength(70000);
        expect(reader.str()).toHaveLength(20000);
        expect(reader.remaining).toBe(0);
    });
});
