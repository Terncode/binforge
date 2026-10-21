import {
    MAX_ANY_DEPTH,
    OFFSET_BOOLEAN,
    OFFSET_DATE_ISO_STRING,
    OFFSET_FLOAT32,
    OFFSET_FLOAT64,
    OFFSET_INT8,
    OFFSET_INT16,
    OFFSET_INT32,
    OFFSET_UINT8,
    OFFSET_UINT16,
    OFFSET_UINT32,
} from "./constants";
import type { IBinaryOffset, IBitWriter } from "./types";
import { BINARY_FLOAT } from "./utils";

export class BinaryOffset implements IBinaryOffset {
    static get BOOLEAN() {
        return OFFSET_BOOLEAN;
    }

    static get INT8() {
        return OFFSET_INT8;
    }

    static get BOOLS8() {
        return OFFSET_UINT8;
    }

    static get UINT8() {
        return OFFSET_UINT8;
    }

    static get INT16() {
        return OFFSET_INT16;
    }

    static get UINT16() {
        return OFFSET_UINT16;
    }

    static get INT32() {
        return OFFSET_INT32;
    }

    static get UINT32() {
        return OFFSET_UINT32;
    }

    static get FLOAT32() {
        return OFFSET_FLOAT32;
    }

    static get FLOAT64() {
        return OFFSET_FLOAT64;
    }

    static get DATE_ISO_STRING() {
        return OFFSET_DATE_ISO_STRING;
    }

    get BOOLEAN() {
        return BinaryOffset.BOOLEAN;
    }

    get INT8() {
        return BinaryOffset.INT8;
    }

    get UINT8() {
        return BinaryOffset.UINT8;
    }

    get INT16() {
        return BinaryOffset.INT16;
    }

    get UINT16() {
        return BinaryOffset.UINT16;
    }

    get INT32() {
        return BinaryOffset.INT32;
    }

    get UINT32() {
        return BinaryOffset.UINT32;
    }

    get FLOAT32() {
        return BinaryOffset.FLOAT32;
    }

    get FLOAT64() {
        return BinaryOffset.FLOAT64;
    }

    get DATE_ISO_STRING() {
        return BinaryOffset.DATE_ISO_STRING;
    }

    get BOOLS8() {
        return BinaryOffset.BOOLS8;
    }

    static assertInteger(value: number, min: number, max: number) {
        if (!Number.isInteger(value) || value < min || value > max) {
            throw new RangeError(`Value ${value} is outside the range ${min}..${max}`);
        }
    }

    static isoString(value: Date) {
        if (Number.isNaN(value.getTime())) {
            throw new RangeError("Invalid Date");
        }
        return value.toISOString();
    }

    static isUnsupportedObject(value: object) {
        return (
            value instanceof Date ||
            value instanceof Map ||
            value instanceof Set ||
            value instanceof ArrayBuffer ||
            ArrayBuffer.isView(value)
        );
    }

    static isFloat32Exact(value: number) {
        BINARY_FLOAT[0] = value;
        return BINARY_FLOAT[0] === value;
    }

    static createBitWriter(emit: (value: number, bits: number) => void): IBitWriter {
        const bitWriter: IBitWriter = {
            bit: (value) => {
                emit(value ? 1 : 0, 1);
                return bitWriter;
            },
            uint2: (value) => {
                BinaryOffset.assertInteger(value, 0, 3);
                emit(value, 2);
                return bitWriter;
            },
            int2: (value) => {
                BinaryOffset.assertInteger(value, -2, 1);
                emit(value & 0x3, 2);
                return bitWriter;
            },
            uint4: (value) => {
                BinaryOffset.assertInteger(value, 0, 15);
                emit(value, 4);
                return bitWriter;
            },
            int4: (value) => {
                BinaryOffset.assertInteger(value, -8, 7);
                emit(value & 0xf, 4);
                return bitWriter;
            },
        };

        return bitWriter;
    }

    static getLength(value: number) {
        if (!Number.isInteger(value) || value < 0 || value > 0x7ffffffe) {
            throw new Error("Invalid length value");
        }

        const encoded = value + 1;

        if ((encoded & 0xffffff80) === 0) {
            return BinaryOffset.UINT8;
        } else if ((encoded & 0xffffc000) === 0) {
            return BinaryOffset.UINT16;
        } else if ((encoded & 0xffe00000) === 0) {
            return BinaryOffset.UINT8 + BinaryOffset.UINT16;
        } else if ((encoded & 0xf0000000) === 0) {
            return BinaryOffset.UINT32;
        } else {
            return BinaryOffset.UINT8 + BinaryOffset.UINT32;
        }
    }

    getLength(value: number) {
        return BinaryOffset.getLength(value);
    }

    static nullableLen<T>(value: T | null | undefined, size: (value: T) => number): number {
        if (value == null) {
            return BinaryOffset.UINT8;
        }
        return BinaryOffset.UINT8 + size(value);
    }

    nullableLen<T>(value: T | null | undefined, size: (value: T) => number): number {
        return BinaryOffset.nullableLen(value, size);
    }

    static getNumberLength(value: number) {
        if (Object.is(value, -0)) {
            return BinaryOffset.UINT8 + BinaryOffset.FLOAT32;
        } else if (value >>> 0 === value) {
            if (value > 0xffff) {
                return BinaryOffset.UINT8 + BinaryOffset.UINT32;
            } else if (value > 0xff) {
                return BinaryOffset.UINT8 + BinaryOffset.UINT16;
            } else {
                return BinaryOffset.UINT8 + BinaryOffset.UINT8;
            }
        } else if ((value | 0) === value) {
            if (value >= -128 && value <= 127) {
                return BinaryOffset.UINT8 + BinaryOffset.INT8;
            } else if (value >= -32768 && value <= 32767) {
                return BinaryOffset.UINT8 + BinaryOffset.INT16;
            } else {
                return BinaryOffset.UINT8 + BinaryOffset.INT32;
            }
        } else if (BinaryOffset.isFloat32Exact(value)) {
            return BinaryOffset.UINT8 + BinaryOffset.FLOAT32;
        } else {
            return BinaryOffset.UINT8 + BinaryOffset.FLOAT64;
        }
    }

    static getInternedStringLength(value: string, strings: Map<string, number>) {
        const index = strings.get(value);

        if (index !== undefined) {
            return BinaryOffset.UINT8 + BinaryOffset.getLength(index);
        }

        strings.set(value, strings.size);
        return BinaryOffset.UINT8 + BinaryOffset.string(value);
    }

    static getAnyLength(value: unknown, strings: Map<string, number> = new Map(), depth = 0): number {
        if (depth > MAX_ANY_DEPTH) {
            throw new Error("Maximum nesting depth exceeded");
        }

        if (value === undefined || value === null || value === true || value === false) {
            return BinaryOffset.UINT8;
        }

        if (typeof value === "number") {
            return BinaryOffset.getNumberLength(value);
        }

        if (typeof value === "string") {
            return BinaryOffset.getInternedStringLength(value, strings);
        }

        if (value instanceof Uint8Array) {
            return BinaryOffset.UINT8 + BinaryOffset.getBufferLengthWithLength(value);
        }

        if (Array.isArray(value)) {
            let length = BinaryOffset.UINT8 + BinaryOffset.getLength(value.length);

            for (let i = 0; i < value.length; i++) {
                length += BinaryOffset.getAnyLength(value[i], strings, depth + 1);
            }
            return length;
        }

        if (typeof value === "object") {
            if (BinaryOffset.isUnsupportedObject(value)) {
                throw new Error("Unsupported object type");
            }

            const record = value as Record<string, unknown>;
            const keys = Object.keys(record);
            let length = BinaryOffset.UINT8 + BinaryOffset.getLength(keys.length);

            for (let i = 0; i < keys.length; i++) {
                const key = keys[i]!;
                length += BinaryOffset.getInternedStringLength(key, strings);
                length += BinaryOffset.getAnyLength(record[key], strings, depth + 1);
            }
            return length;
        }

        throw new Error(`Invalid type: ${typeof value}`);
    }

    getAnyLength(value: unknown, strings: Map<string, number> = new Map()) {
        return BinaryOffset.getAnyLength(value, strings);
    }

    getUint8ArrayLen(value: Uint8Array) {
        return BinaryOffset.getBufferLengthWithLength(value);
    }

    static getShortLength(length: number) {
        return length < 31 ? BinaryOffset.UINT8 : BinaryOffset.UINT8 + BinaryOffset.getLength(length);
    }

    getShortLength(length: number) {
        return BinaryOffset.getShortLength(length);
    }

    static string(value: string) {
        const length = BinaryOffset.stringLengthInBytes(value);
        return BinaryOffset.getLength(length) + length;
    }

    string(value: string) {
        return BinaryOffset.string(value);
    }

    static getBufferLengthWithLength(buffer: { readonly byteLength: number }) {
        return BinaryOffset.getLength(buffer.byteLength) + buffer.byteLength;
    }

    getBufferLengthWithLength(buffer: { readonly byteLength: number }) {
        return BinaryOffset.getBufferLengthWithLength(buffer);
    }

    static stringLengthInBytes(value: string): number {
        let result = 0;

        for (let i = 0; i < value.length; i++) {
            const code = value.charCodeAt(i);

            if (code >= 0xd800 && code <= 0xdbff) {
                if (i + 1 < value.length) {
                    const extra = value.charCodeAt(i + 1);
                    if ((extra & 0xfc00) === 0xdc00) {
                        i++;
                        result += BinaryOffset.charLengthInBytes(
                            ((code & 0x3ff) << 10) + (extra & 0x3ff) + 0x10000,
                        );
                    } else {
                        result += BinaryOffset.charLengthInBytes(0xfffd);
                    }
                } else {
                    result += BinaryOffset.charLengthInBytes(0xfffd);
                }
            } else if (code >= 0xdc00 && code <= 0xdfff) {
                result += BinaryOffset.charLengthInBytes(0xfffd);
            } else {
                result += BinaryOffset.charLengthInBytes(code);
            }
        }

        return result;
    }

    stringLengthInBytes(value: string) {
        return BinaryOffset.stringLengthInBytes(value);
    }

    static charLengthInBytes(code: number): number {
        if ((code & 0xffffff80) === 0) {
            return 1;
        } else if ((code & 0xfffff800) === 0) {
            return 2;
        } else if ((code & 0xffff0000) === 0) {
            return 3;
        } else {
            return 4;
        }
    }

    charLengthInBytes(code: number) {
        return BinaryOffset.charLengthInBytes(code);
    }
}