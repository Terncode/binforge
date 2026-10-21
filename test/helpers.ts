import { BinaryReader } from "../src/reader";
import { BinaryWriter } from "../src/writer";
import { BinarySizeWriter } from "../src/writer-size";

export const ANY_VECTORS: [string, unknown, number[]][] = [
    ["undefined", undefined, [0]],
    ["null", null, [1]],
    ["true", true, [2]],
    ["false", false, [3]],
    ["small unsigned", 5, [4, 5]],
    ["uint8 upper bound", 255, [4, 255]],
    ["uint16 lower bound", 256, [5, 0x00, 0x01]],
    ["uint16", 300, [5, 0x2c, 0x01]],
    ["uint16 upper bound", 65535, [5, 0xff, 0xff]],
    ["uint32 lower bound", 65536, [6, 0x00, 0x00, 0x01, 0x00]],
    ["uint32", 70000, [6, 0x70, 0x11, 0x01, 0x00]],
    ["uint32 upper bound", 4294967295, [6, 0xff, 0xff, 0xff, 0xff]],
    ["int8", -5, [7, 0xfb]],
    ["int8 lower bound", -128, [7, 0x80]],
    ["int16", -200, [8, 0x38, 0xff]],
    ["int16 lower bound", -32768, [8, 0x00, 0x80]],
    ["int32", -100000, [9, 0x60, 0x79, 0xfe, 0xff]],
    ["int32 lower bound", -2147483648, [9, 0x00, 0x00, 0x00, 0x80]],
    ["exact float32", 0.5, [10, 0x00, 0x00, 0x00, 0x3f]],
    ["infinity as float32", Number.POSITIVE_INFINITY, [10, 0x00, 0x00, 0x80, 0x7f]],
    ["negative zero", -0, [10, 0x00, 0x00, 0x00, 0x80]],
    ["float64", 0.1, [11, 0x9a, 0x99, 0x99, 0x99, 0x99, 0x99, 0xb9, 0x3f]],
    ["new string", "a", [12, 2, 0x61]],
    ["empty array", [], [14, 1]],
    ["array with repeated string", ["a", "a"], [14, 3, 12, 2, 0x61, 13, 1]],
    ["byte array", new Uint8Array([1, 2]), [15, 3, 1, 2]],
    ["empty object", {}, [16, 1]],
    ["object with one key", { a: 1 }, [16, 2, 12, 2, 0x61, 4, 1]],
];

export function encode(value: unknown): Uint8Array {
    const size = new BinarySizeWriter().any(value).byteLength;
    return new BinaryWriter(size).any(value).copy();
}

export function decode(bytes: Uint8Array): unknown {
    return new BinaryReader(bytes).any();
}

export function roundTrip(value: unknown): unknown {
    return decode(encode(value));
}

export function toArray(bytes: Uint8Array): number[] {
    return Array.from(bytes);
}

export function nestArrays(levels: number): unknown[] {
    let value: unknown[] = [];

    for (let i = 1; i < levels; i++) {
        value = [value];
    }
    return value;
}

export function nestObjects(levels: number): Record<string, unknown> {
    let value: Record<string, unknown> = {};

    for (let i = 1; i < levels; i++) {
        value = { child: value };
    }
    return value;
}

export function nestedArrayBytes(levels: number): Uint8Array {
    const bytes: number[] = [];

    for (let i = 1; i < levels; i++) {
        bytes.push(14, 2);
    }
    bytes.push(14, 1);
    return new Uint8Array(bytes);
}

export function createRandom(seed: number): () => number {
    let state = seed >>> 0;

    return function next() {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state / 4294967296;
    };
}

const STRING_POOL = ["", "a", "b", "key", "é", "€", "😀", "a longer string value", "x".repeat(40)];
const KEY_POOL = ["a", "b", "key", "é", "😀", "", "x y"];

function pick<T>(random: () => number, items: T[]): T {
    return items[Math.floor(random() * items.length)]!;
}

export function randomValue(random: () => number, depth = 0): unknown {
    const kinds = depth >= 3 ? 9 : 12;
    const kind = Math.floor(random() * kinds);

    switch (kind) {
        case 0:
            return undefined;
        case 1:
            return null;
        case 2:
            return random() < 0.5;
        case 3:
            return Math.floor(random() * 300) - 100;
        case 4:
            return Math.floor(random() * 8589934592) - 4294967296;
        case 5:
            return (random() - 0.5) * 1e6;
        case 6:
            return pick(random, STRING_POOL);
        case 7:
            return pick(random, STRING_POOL) + Math.floor(random() * 10);
        case 8: {
            const bytes = new Uint8Array(Math.floor(random() * 9));

            for (let i = 0; i < bytes.length; i++) {
                bytes[i] = Math.floor(random() * 256);
            }
            return bytes;
        }
        case 9: {
            const count = Math.floor(random() * 5);
            const result: unknown[] = [];

            for (let i = 0; i < count; i++) {
                result.push(randomValue(random, depth + 1));
            }
            return result;
        }
        case 10: {
            const count = Math.floor(random() * 5);
            const result: Record<string, unknown> = {};

            for (let i = 0; i < count; i++) {
                result[pick(random, KEY_POOL)] = randomValue(random, depth + 1);
            }
            return result;
        }
        default:
            return Math.fround((random() - 0.5) * 1000);
    }
}