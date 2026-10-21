import { MAX_ANY_DEPTH } from "./constants";
import { BinaryOffset } from "./offset";
import { BinaryTag, type IBinaryReaderMethods, type IBitReader } from "./types";

export class BinaryReader extends BinaryOffset implements IBinaryReaderMethods {
    private view: DataView;
    private offset: number;

    constructor(buffer: Uint8Array | ArrayBuffer) {
        super();

        if (buffer instanceof Uint8Array) {
            this.view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
        } else {
            this.view = new DataView(buffer);
        }
        this.offset = 0;
    }

    get remaining() {
        return this.view.byteLength - this.offset;
    }

    private ensure(size: number) {
        if (size < 0 || size > this.remaining) {
            throw new Error(`Buffer underflow at offset ${this.offset}`);
        }
    }

    private assertCount(count: number, minimumBytesEach: number) {
        if (count < 0 || count * minimumBytesEach > this.remaining) {
            throw new Error(`Invalid element count ${count} at offset ${this.offset}`);
        }
    }

    int8() {
        this.ensure(1);
        const value = this.view.getInt8(this.offset);
        this.offset += 1;
        return value;
    }

    uint8() {
        this.ensure(1);
        const value = this.view.getUint8(this.offset);
        this.offset += 1;
        return value;
    }

    private readInt16(littleEndian: boolean) {
        this.ensure(2);
        const value = this.view.getInt16(this.offset, littleEndian);
        this.offset += 2;
        return value;
    }

    private readUint16(littleEndian: boolean) {
        this.ensure(2);
        const value = this.view.getUint16(this.offset, littleEndian);
        this.offset += 2;
        return value;
    }

    private readInt32(littleEndian: boolean) {
        this.ensure(4);
        const value = this.view.getInt32(this.offset, littleEndian);
        this.offset += 4;
        return value;
    }

    private readUint32(littleEndian: boolean) {
        this.ensure(4);
        const value = this.view.getUint32(this.offset, littleEndian);
        this.offset += 4;
        return value;
    }

    private readFloat32(littleEndian: boolean) {
        this.ensure(4);
        const value = this.view.getFloat32(this.offset, littleEndian);
        this.offset += 4;
        return value;
    }

    private readFloat64(littleEndian: boolean) {
        this.ensure(8);
        const value = this.view.getFloat64(this.offset, littleEndian);
        this.offset += 8;
        return value;
    }

    int16() {
        return this.readInt16(true);
    }

    int16LE() {
        return this.readInt16(true);
    }

    int16BE() {
        return this.readInt16(false);
    }

    uint16() {
        return this.readUint16(true);
    }

    uint16LE() {
        return this.readUint16(true);
    }

    uint16BE() {
        return this.readUint16(false);
    }

    int32() {
        return this.readInt32(true);
    }

    int32LE() {
        return this.readInt32(true);
    }

    int32BE() {
        return this.readInt32(false);
    }

    uint32() {
        return this.readUint32(true);
    }

    uint32LE() {
        return this.readUint32(true);
    }

    uint32BE() {
        return this.readUint32(false);
    }

    float32() {
        return this.readFloat32(true);
    }

    float32LE() {
        return this.readFloat32(true);
    }

    float32BE() {
        return this.readFloat32(false);
    }

    float64() {
        return this.readFloat64(true);
    }

    float64LE() {
        return this.readFloat64(true);
    }

    float64BE() {
        return this.readFloat64(false);
    }

    bytes(length: number) {
        this.ensure(length);
        const offset = this.offset;
        this.offset += length;
        return new Uint8Array(this.view.buffer, this.view.byteOffset + offset, length);
    }

    bool() {
        return this.uint8() === 1;
    }

    date() {
        const value = new Date(this.str());

        if (Number.isNaN(value.getTime())) {
            throw new Error("Invalid date string");
        }
        return value;
    }

    readNullable<T>(read: (r: this) => T): T | null {
        const exists = this.uint8();

        if (exists === 0) {
            return null;
        }

        if (exists !== 1) {
            throw new Error(`Invalid nullable marker ${exists} at offset ${this.offset - 1}`);
        }
        return read(this);
    }

    str() {
        const length = this.len();

        if (length < 0) {
            throw new Error(`Unexpected null length at offset ${this.offset}`);
        }

        this.ensure(length);
        const result = this.decodeString(this.offset, length);
        this.offset += length;
        return result;
    }

    len() {
        let length = 0;
        let shift = 0;
        let b: number;

        do {
            if (shift > 28) {
                throw new Error(`Malformed length at offset ${this.offset}`);
            }

            b = this.uint8();
            length = (length | ((b & 0x7f) << shift)) >>> 0;
            shift += 7;
        } while (b & 0x80);

        if (length > 0x7fffffff) {
            throw new Error(`Length out of range at offset ${this.offset}`);
        }

        return length - 1;
    }

    uint8Array() {
        const length = this.len();
        return this.bytes(length);
    }

    decodeString(offset: number, length: number): string {
        const end = offset + length;

        if (offset < 0 || length < 0 || end > this.view.byteLength) {
            throw new Error("String range exceeds buffer");
        }

        let result = "";

        for (let i = offset; i < end; ) {
            const byte1 = this.view.getUint8(i++);
            let code: number;

            if ((byte1 & 0x80) === 0) {
                code = byte1;
            } else if ((byte1 & 0xe0) === 0xc0) {
                const byte2 = this.continuationByte(i++, end);
                code = ((byte1 & 0x1f) << 6) | byte2;

                if (code < 0x80) {
                    throw new Error("Overlong 2-byte UTF-8 encoding");
                }
            } else if ((byte1 & 0xf0) === 0xe0) {
                const byte2 = this.continuationByte(i++, end);
                const byte3 = this.continuationByte(i++, end);
                code = ((byte1 & 0x0f) << 12) | (byte2 << 6) | byte3;

                if (code < 0x0800) {
                    throw new Error("Overlong 3-byte UTF-8 encoding");
                }

                if (code >= 0xd800 && code <= 0xdfff) {
                    throw new Error(
                        `Lone surrogate U+${code.toString(16).toUpperCase()} is not a scalar value`,
                    );
                }
            } else if ((byte1 & 0xf8) === 0xf0) {
                const byte2 = this.continuationByte(i++, end);
                const byte3 = this.continuationByte(i++, end);
                const byte4 = this.continuationByte(i++, end);
                code = ((byte1 & 0x07) << 18) | (byte2 << 12) | (byte3 << 6) | byte4;

                if (code < 0x010000 || code > 0x10ffff) {
                    throw new Error("Invalid 4-byte UTF-8 sequence");
                }
            } else {
                throw new Error("Invalid UTF-8 detected");
            }

            if (code > 0xffff) {
                code -= 0x10000;
                result += String.fromCharCode(((code >>> 10) & 0x3ff) | 0xd800);
                code = 0xdc00 | (code & 0x3ff);
            }

            result += String.fromCharCode(code);
        }

        return result;
    }

    private continuationByte(index: number, end: number): number {
        if (index >= end) {
            throw new Error("Unexpected end of UTF-8 sequence");
        }

        const continuationByte = this.view.getUint8(index);

        if ((continuationByte & 0xc0) === 0x80) {
            return continuationByte & 0x3f;
        } else {
            throw new Error("Invalid continuation byte");
        }
    }

    read8Bools(): [boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean] {
        const b = this.uint8();
        return [
            (b & 0x01) !== 0,
            (b & 0x02) !== 0,
            (b & 0x04) !== 0,
            (b & 0x08) !== 0,
            (b & 0x10) !== 0,
            (b & 0x20) !== 0,
            (b & 0x40) !== 0,
            (b & 0x80) !== 0,
        ];
    }

    private readBitsRaw(bits: number, state: { acc: number; count: number }): number {
        let result = 0;
        for (let i = 0; i < bits; i++) {
            if (state.count === 0) {
                state.acc = this.uint8();
                state.count = 8;
            }
            result |= (state.acc & 1) << i;
            state.acc >>= 1;
            state.count--;
        }
        return result;
    }

    readBits<T>(fn: (bits: IBitReader) => T): T {
        const state = { acc: 0, count: 0 };

        const bitReader: IBitReader = {
            bit: () => this.readBitsRaw(1, state) === 1,
            uint2: () => this.readBitsRaw(2, state),
            int2: () => {
                const value = this.readBitsRaw(2, state);
                return value >= 2 ? value - 4 : value;
            },
            uint4: () => this.readBitsRaw(4, state),
            int4: () => {
                const value = this.readBitsRaw(4, state);
                return value >= 8 ? value - 16 : value;
            },
        };

        return fn(bitReader);
    }

    any(strings: string[] = []): unknown {
        return this.readValue(strings, 0);
    }

    readAny(strings: string[] = []): unknown {
        return this.readValue(strings, 0);
    }

    private readValue(strings: string[], depth: number): unknown {
        if (depth > MAX_ANY_DEPTH) {
            throw new Error("Maximum nesting depth exceeded");
        }

        const tag = this.uint8();

        switch (tag) {
            case BinaryTag.Undefined:
                return undefined;
            case BinaryTag.Null:
                return null;
            case BinaryTag.True:
                return true;
            case BinaryTag.False:
                return false;
            case BinaryTag.Uint8:
                return this.uint8();
            case BinaryTag.Uint16:
                return this.uint16();
            case BinaryTag.Uint32:
                return this.uint32();
            case BinaryTag.Int8:
                return this.int8();
            case BinaryTag.Int16:
                return this.int16();
            case BinaryTag.Int32:
                return this.int32();
            case BinaryTag.Float32:
                return this.float32();
            case BinaryTag.Float64:
                return this.float64();
            case BinaryTag.StringNew: {
                const value = this.str();
                strings.push(value);
                return value;
            }
            case BinaryTag.StringRef: {
                const index = this.len();
                const value = strings[index];

                if (value === undefined) {
                    throw new Error(`Invalid string reference ${index}`);
                }
                return value;
            }
            case BinaryTag.Uint8Array:
                return this.uint8Array();
            case BinaryTag.Array: {
                const length = this.len();
                this.assertCount(length, 1);
                const result = new Array(length);

                for (let i = 0; i < length; i++) {
                    result[i] = this.readValue(strings, depth + 1);
                }
                return result;
            }
            case BinaryTag.Object:
                return this.readObjectBody(strings, depth);
            default:
                throw new Error(`Unknown tag: ${tag}`);
        }
    }

    private readObjectBody(strings: string[], depth: number): Record<string, unknown> {
        const length = this.len();
        this.assertCount(length, 3);
        const result: Record<string, unknown> = {};

        for (let i = 0; i < length; i++) {
            const key = this.readValue(strings, depth + 1);

            if (typeof key !== "string") {
                throw new Error("Object key must be a string");
            }

            const value = this.readValue(strings, depth + 1);

            Object.defineProperty(result, key, {
                value,
                enumerable: true,
                writable: true,
                configurable: true,
            });
        }
        return result;
    }

    readObject(strings: string[] = []): Record<string, unknown> {
        const tag = this.uint8();

        if (tag !== BinaryTag.Object) {
            throw new Error(`Expected object tag, got ${tag}`);
        }
        return this.readObjectBody(strings, 0);
    }
}