import { MAX_ANY_DEPTH } from "./constants";
import { BinaryOffset } from "./offset";
import { BinaryTag, type IBinaryWriteMethods, type IBitWriter } from "./types";

export class BinaryWriter extends BinaryOffset implements IBinaryWriteMethods {
    private view: DataView;
    private offset: number;

    constructor(size: number) {
        super();
        const buf = new Uint8Array(size);
        this.view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
        this.offset = 0;
    }

    date(value: Date) {
        this.str(BinaryOffset.isoString(value));
        return this;
    }

    bool(value: boolean) {
        this.uint8(value ? 1 : 0);
        return this;
    }

    nullLen() {
        this.uint8(0);
        return this;
    }

    buffer() {
        return new Uint8Array(this.view.buffer, this.view.byteOffset, this.offset);
    }

    copy() {
        return new Uint8Array(this.buffer());
    }

    reset() {
        this.offset = 0;
        return this;
    }

    int8(value: number) {
        BinaryOffset.assertInteger(value, -128, 127);
        this.view.setInt8(this.offset, value);
        this.offset += 1;
        return this;
    }

    uint8(value: number) {
        BinaryOffset.assertInteger(value, 0, 0xff);
        this.view.setUint8(this.offset, value);
        this.offset += 1;
        return this;
    }

    private putInt16(value: number, littleEndian: boolean) {
        BinaryOffset.assertInteger(value, -32768, 32767);
        this.view.setInt16(this.offset, value, littleEndian);
        this.offset += 2;
        return this;
    }

    private putUint16(value: number, littleEndian: boolean) {
        BinaryOffset.assertInteger(value, 0, 0xffff);
        this.view.setUint16(this.offset, value, littleEndian);
        this.offset += 2;
        return this;
    }

    private putInt32(value: number, littleEndian: boolean) {
        BinaryOffset.assertInteger(value, -2147483648, 2147483647);
        this.view.setInt32(this.offset, value, littleEndian);
        this.offset += 4;
        return this;
    }

    private putUint32(value: number, littleEndian: boolean) {
        BinaryOffset.assertInteger(value, 0, 0xffffffff);
        this.view.setUint32(this.offset, value, littleEndian);
        this.offset += 4;
        return this;
    }

    private putFloat32(value: number, littleEndian: boolean) {
        this.view.setFloat32(this.offset, +value, littleEndian);
        this.offset += 4;
        return this;
    }

    private putFloat64(value: number, littleEndian: boolean) {
        this.view.setFloat64(this.offset, +value, littleEndian);
        this.offset += 8;
        return this;
    }

    int16(value: number) {
        return this.putInt16(value, true);
    }

    int16LE(value: number) {
        return this.putInt16(value, true);
    }

    int16BE(value: number) {
        return this.putInt16(value, false);
    }

    uint16(value: number) {
        return this.putUint16(value, true);
    }

    uint16LE(value: number) {
        return this.putUint16(value, true);
    }

    uint16BE(value: number) {
        return this.putUint16(value, false);
    }

    int32(value: number) {
        return this.putInt32(value, true);
    }

    int32LE(value: number) {
        return this.putInt32(value, true);
    }

    int32BE(value: number) {
        return this.putInt32(value, false);
    }

    uint32(value: number) {
        return this.putUint32(value, true);
    }

    uint32LE(value: number) {
        return this.putUint32(value, true);
    }

    uint32BE(value: number) {
        return this.putUint32(value, false);
    }

    float32(value: number) {
        return this.putFloat32(value, true);
    }

    float32LE(value: number) {
        return this.putFloat32(value, true);
    }

    float32BE(value: number) {
        return this.putFloat32(value, false);
    }

    float64(value: number) {
        return this.putFloat64(value, true);
    }

    float64LE(value: number) {
        return this.putFloat64(value, true);
    }

    float64BE(value: number) {
        return this.putFloat64(value, false);
    }

    str(value: string) {
        const byteLength = this.stringLengthInBytes(value);
        this.len(byteLength);
        this.strValue(value, byteLength);
        return this;
    }

    len(value: number) {
        if (!Number.isInteger(value) || value < 0 || value > 0x7ffffffe) {
            throw new Error("Invalid length value");
        }

        const encoded = value + 1;

        if ((encoded & 0xffffff80) === 0) {
            this.uint8(encoded);
        } else if ((encoded & 0xffffc000) === 0) {
            const a = (encoded & 0x7f) | 0x80;
            const b = encoded >> 7;
            this.uint16((b << 8) | a);
        } else if ((encoded & 0xffe00000) === 0) {
            const a = (encoded & 0x7f) | 0x80;
            const b = ((encoded >> 7) & 0x7f) | 0x80;
            const c = encoded >> 14;
            this.uint8(a);
            this.uint16((c << 8) | b);
        } else if ((encoded & 0xf0000000) === 0) {
            const a = (encoded & 0x7f) | 0x80;
            const b = ((encoded >> 7) & 0x7f) | 0x80;
            const c = ((encoded >> 14) & 0x7f) | 0x80;
            const d = encoded >> 21;
            this.uint32((d << 24) | (c << 16) | (b << 8) | a);
        } else {
            const a = (encoded & 0x7f) | 0x80;
            const b = ((encoded >> 7) & 0x7f) | 0x80;
            const c = ((encoded >> 14) & 0x7f) | 0x80;
            const d = ((encoded >> 21) & 0x7f) | 0x80;
            const e = (encoded >>> 28) & 0x0f;
            this.uint8(a);
            this.uint32((e << 24) | (d << 16) | (c << 8) | b);
        }
        return this;
    }

    writeNullable<T>(value: T | null | undefined, write: (w: this, value: T) => void) {
        if (value == null) {
            this.uint8(0);
        } else {
            this.uint8(1);
            write(this, value);
        }
        return this;
    }

    strValue(value: string, precomputedByteLength?: number) {
        const byteLength = precomputedByteLength ?? this.stringLengthInBytes(value);
        if (this.offset + byteLength > this.view.byteLength) {
            throw new RangeError("Exceeded DataView size");
        }
        this.offset = this.encodeStringTo(this.offset, value);
        return this;
    }

    encodeStringTo(offset: number, value: string): number {
        for (let i = 0; i < value.length; i++) {
            const code = value.charCodeAt(i);

            if (code >= 0xd800 && code <= 0xdbff) {
                if (i + 1 < value.length) {
                    const extra = value.charCodeAt(i + 1);
                    if ((extra & 0xfc00) === 0xdc00) {
                        i++;
                        const fullCode = ((code & 0x3ff) << 10) + (extra & 0x3ff) + 0x10000;
                        offset += this.chr(offset, fullCode);
                    } else {
                        offset += this.chr(offset, 0xfffd);
                    }
                } else {
                    offset += this.chr(offset, 0xfffd);
                }
            } else if (code >= 0xdc00 && code <= 0xdfff) {
                offset += this.chr(offset, 0xfffd);
            } else {
                offset += this.chr(offset, code);
            }
        }

        return offset;
    }

    chr(offset: number, code: number): number {
        const length = this.charLengthInBytes(code);

        switch (length) {
            case 1:
                this.view.setUint8(offset, code);
                break;
            case 2:
                this.view.setUint8(offset, ((code >> 6) & 0x1f) | 0xc0);
                this.view.setUint8(offset + 1, (code & 0x3f) | 0x80);
                break;
            case 3:
                this.view.setUint8(offset, ((code >> 12) & 0x0f) | 0xe0);
                this.view.setUint8(offset + 1, ((code >> 6) & 0x3f) | 0x80);
                this.view.setUint8(offset + 2, (code & 0x3f) | 0x80);
                break;
            default:
                this.view.setUint8(offset, ((code >> 18) & 0x07) | 0xf0);
                this.view.setUint8(offset + 1, ((code >> 12) & 0x3f) | 0x80);
                this.view.setUint8(offset + 2, ((code >> 6) & 0x3f) | 0x80);
                this.view.setUint8(offset + 3, (code & 0x3f) | 0x80);
                break;
        }

        return length;
    }

    uint8Array(value: Uint8Array) {
        this.len(value.byteLength);
        this.bytes(value);
        return this;
    }

    bytes(value: Uint8Array) {
        if (this.offset + value.byteLength > this.view.byteLength) {
            throw new RangeError("Exceeded DataView size");
        }
        new Uint8Array(this.view.buffer, this.view.byteOffset + this.offset, value.byteLength).set(
            value,
        );
        this.offset += value.byteLength;
        return this;
    }

    write8Bools(
        b0: boolean,
        b1: boolean = false,
        b2: boolean = false,
        b3: boolean = false,
        b4: boolean = false,
        b5: boolean = false,
        b6: boolean = false,
        b7: boolean = false,
    ) {
        this.uint8(
            (b0 ? 0x01 : 0) |
                (b1 ? 0x02 : 0) |
                (b2 ? 0x04 : 0) |
                (b3 ? 0x08 : 0) |
                (b4 ? 0x10 : 0) |
                (b5 ? 0x20 : 0) |
                (b6 ? 0x40 : 0) |
                (b7 ? 0x80 : 0),
        );
        return this;
    }

    private writeBitsRaw(value: number, bits: number, state: { acc: number; count: number }) {
        for (let i = 0; i < bits; i++) {
            const bitValue = (value >> i) & 1;
            state.acc |= bitValue << state.count;
            state.count++;

            if (state.count === 8) {
                this.uint8(state.acc);
                state.acc = 0;
                state.count = 0;
            }
        }
    }

    packBits<T>(fn: (bits: IBitWriter) => T): this {
        const state = { acc: 0, count: 0 };

        fn(
            BinaryOffset.createBitWriter((value, bits) => {
                this.writeBitsRaw(value, bits, state);
            }),
        );

        if (state.count > 0) {
            this.uint8(state.acc);
        }
        return this;
    }

    writeInternedString(value: string, strings: Map<string, number>) {
        const index = strings.get(value);

        if (index !== undefined) {
            this.uint8(BinaryTag.StringRef);
            this.len(index);
        } else {
            strings.set(value, strings.size);
            this.uint8(BinaryTag.StringNew);
            this.str(value);
        }
        return this;
    }

    private writeAnyNumber(value: number) {
        if (Object.is(value, -0)) {
            this.uint8(BinaryTag.Float32);
            this.float32(value);
        } else if (value >>> 0 === value) {
            if (value > 0xffff) {
                this.uint8(BinaryTag.Uint32);
                this.uint32(value);
            } else if (value > 0xff) {
                this.uint8(BinaryTag.Uint16);
                this.uint16(value);
            } else {
                this.uint8(BinaryTag.Uint8);
                this.uint8(value);
            }
        } else if ((value | 0) === value) {
            if (value >= -128 && value <= 127) {
                this.uint8(BinaryTag.Int8);
                this.int8(value);
            } else if (value >= -32768 && value <= 32767) {
                this.uint8(BinaryTag.Int16);
                this.int16(value);
            } else {
                this.uint8(BinaryTag.Int32);
                this.int32(value);
            }
        } else if (BinaryOffset.isFloat32Exact(value)) {
            this.uint8(BinaryTag.Float32);
            this.float32(value);
        } else {
            this.uint8(BinaryTag.Float64);
            this.float64(value);
        }
    }

    any(value: unknown, strings: Map<string, number> = new Map()) {
        return this.writeValue(value, strings, 0);
    }

    private writeValue(value: unknown, strings: Map<string, number>, depth: number): this {
        if (depth > MAX_ANY_DEPTH) {
            throw new Error("Maximum nesting depth exceeded");
        }

        if (value === undefined) {
            this.uint8(BinaryTag.Undefined);
        } else if (value === null) {
            this.uint8(BinaryTag.Null);
        } else if (value === true) {
            this.uint8(BinaryTag.True);
        } else if (value === false) {
            this.uint8(BinaryTag.False);
        } else if (typeof value === "number") {
            this.writeAnyNumber(value);
        } else if (typeof value === "string") {
            this.writeInternedString(value, strings);
        } else if (value instanceof Uint8Array) {
            this.uint8(BinaryTag.Uint8Array);
            this.uint8Array(value);
        } else if (Array.isArray(value)) {
            this.uint8(BinaryTag.Array);
            this.len(value.length);

            for (let i = 0; i < value.length; i++) {
                this.writeValue(value[i], strings, depth + 1);
            }
        } else if (typeof value === "object") {
            this.writeObjectBody(value as Record<string, unknown>, strings, depth);
        } else {
            throw new Error(`Invalid type: ${typeof value}`);
        }
        return this;
    }

    private writeObjectBody(value: Record<string, unknown>, strings: Map<string, number>, depth: number) {
        if (BinaryOffset.isUnsupportedObject(value)) {
            throw new Error("Unsupported object type");
        }

        this.uint8(BinaryTag.Object);
        const keys = Object.keys(value);
        this.len(keys.length);

        for (let i = 0; i < keys.length; i++) {
            const key = keys[i]!;
            this.writeInternedString(key, strings);
            this.writeValue(value[key], strings, depth + 1);
        }
        return this;
    }

    writeObject(value: Record<string, unknown>, strings: Map<string, number> = new Map()) {
        this.writeObjectBody(value, strings, 0);
        return this;
    }
}