import { describe, expect, it } from "vitest";
import * as api from "../src/index";

describe("public api", () => {
    it("exports the classes", () => {
        expect(typeof api.BinaryReader).toBe("function");
        expect(typeof api.BinaryWriter).toBe("function");
        expect(typeof api.BinaryDynamicWriter).toBe("function");
        expect(typeof api.BinarySizeWriter).toBe("function");
        expect(typeof api.BinaryOffset).toBe("function");
        expect(typeof api.ByteSink).toBe("function");
        expect(typeof api.VarintReader).toBe("function");
    });

    it("lets the byte sync classes round-trip a zigzag varint", () => {
        const sink = new api.ByteSink();

        sink.writeZigzag(-300);
        expect(new api.VarintReader(sink.view()).readZigzag()).toBe(-300);
    });

    it("exports the tag enum and the shared empty buffer", () => {
        expect(api.BinaryTag.Object).toBe(16);
        expect(api.BINARY_EMPTY).toHaveLength(0);
    });

    it("lets the exported pieces cooperate", () => {
        const size = new api.BinarySizeWriter().any({ a: [1, 2, 3] }).byteLength;
        const writer = new api.BinaryWriter(size).any({ a: [1, 2, 3] });
        const decoded = new api.BinaryReader(writer.buffer()).any();

        expect(decoded).toStrictEqual({ a: [1, 2, 3] });
    });
});