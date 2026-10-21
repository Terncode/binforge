import { describe, expect, it } from "vitest";
import * as constants from "../src/constants";
import { BinaryTag } from "../src/types";
import { BINARY_EMPTY, BINARY_FLOAT } from "../src/utils";

describe("binary-constants", () => {
    it("defines every fixed width", () => {
        expect(constants.OFFSET_BOOLEAN).toBe(1);
        expect(constants.OFFSET_INT8).toBe(1);
        expect(constants.OFFSET_UINT8).toBe(1);
        expect(constants.OFFSET_INT16).toBe(2);
        expect(constants.OFFSET_UINT16).toBe(2);
        expect(constants.OFFSET_INT32).toBe(4);
        expect(constants.OFFSET_UINT32).toBe(4);
        expect(constants.OFFSET_FLOAT32).toBe(4);
        expect(constants.OFFSET_FLOAT64).toBe(8);
        expect(constants.OFFSET_DATE_ISO_STRING).toBe(25);
    });

    it("limits nesting depth to 256", () => {
        expect(constants.MAX_ANY_DEPTH).toBe(256);
    });
});

describe("BinaryTag", () => {
    it("assigns stable wire values to every tag", () => {
        expect(BinaryTag.Undefined).toBe(0);
        expect(BinaryTag.Null).toBe(1);
        expect(BinaryTag.True).toBe(2);
        expect(BinaryTag.False).toBe(3);
        expect(BinaryTag.Uint8).toBe(4);
        expect(BinaryTag.Uint16).toBe(5);
        expect(BinaryTag.Uint32).toBe(6);
        expect(BinaryTag.Int8).toBe(7);
        expect(BinaryTag.Int16).toBe(8);
        expect(BinaryTag.Int32).toBe(9);
        expect(BinaryTag.Float32).toBe(10);
        expect(BinaryTag.Float64).toBe(11);
        expect(BinaryTag.StringNew).toBe(12);
        expect(BinaryTag.StringRef).toBe(13);
        expect(BinaryTag.Array).toBe(14);
        expect(BinaryTag.Uint8Array).toBe(15);
        expect(BinaryTag.Object).toBe(16);
    });

    it("never reuses a tag value", () => {
        const values = Object.values(BinaryTag).filter((value) => typeof value === "number");

        expect(values).toHaveLength(17);
        expect(new Set(values).size).toBe(17);
    });
});

describe("binary-utils", () => {
    it("exposes an empty byte array", () => {
        expect(BINARY_EMPTY).toBeInstanceOf(Uint8Array);
        expect(BINARY_EMPTY).toHaveLength(0);
    });

    it("exposes a single-slot float32 scratch buffer", () => {
        expect(BINARY_FLOAT).toBeInstanceOf(Float32Array);
        expect(BINARY_FLOAT).toHaveLength(1);

        BINARY_FLOAT[0] = 0.1;
        expect(BINARY_FLOAT[0]).not.toBe(0.1);
        BINARY_FLOAT[0] = 0.5;
        expect(BINARY_FLOAT[0]).toBe(0.5);
    });
});
