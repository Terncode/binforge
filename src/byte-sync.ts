import type { IByteSinkMethods, IVarintReaderMethods } from "./types";

export class ByteSink implements IByteSinkMethods {
    private bytes: Uint8Array;
    private size = 0;

    constructor(initialCapacity = 1 << 16) {
        this.bytes = new Uint8Array(initialCapacity);
    }

    get length(): number {
        return this.size;
    }

    reset(): void {
        this.size = 0;
    }

    view(): Uint8Array {
        return this.bytes.subarray(0, this.size);
    }

    private ensure(extra: number): void {
        const needed = this.size + extra;
        if (needed <= this.bytes.length) {
            return;
        }
        let capacity = this.bytes.length * 2;
        while (capacity < needed) {
            capacity *= 2;
        }
        const next = new Uint8Array(capacity);
        next.set(this.bytes.subarray(0, this.size));
        this.bytes = next;
    }

    writeVarint(value: number): void {
        this.ensure(5);
        let rest = value;
        while (rest > 127) {
            this.bytes[this.size++] = (rest & 127) | 128;
            rest >>>= 7;
        }
        this.bytes[this.size++] = rest;
    }

    writeZigzag(value: number): void {
        this.writeVarint(value >= 0 ? value * 2 : -value * 2 - 1);
    }
}

export class VarintReader implements IVarintReaderMethods {
    private position: number;

    constructor(
        private readonly bytes: Uint8Array,
        start = 0,
    ) {
        this.position = start;
    }

    get offset(): number {
        return this.position;
    }

    readVarint(): number {
        let result = 0;
        let multiplier = 1;
        let byte: number;
        do {
            byte = this.bytes[this.position++]!;
            result += (byte & 127) * multiplier;
            multiplier *= 128;
        } while (byte > 127);
        return result;
    }

    readZigzag(): number {
        const value = this.readVarint();
        return value % 2 === 0 ? value / 2 : -(value + 1) / 2;
    }
}
