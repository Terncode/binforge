import { BinaryOffset } from "./offset";
import type { IBinaryDynamicWriterMethods, IBitWriter } from "./types";
import { BinaryWriter } from "./writer";

export class BinaryDynamicWriter extends BinaryOffset implements IBinaryDynamicWriterMethods {
    private size = 0;
    private actionQueue: ((writer: BinaryWriter) => void)[] = [];

    private enqueue(size: number, action: (writer: BinaryWriter) => void) {
        this.size += size;
        this.actionQueue.push(action);
        return this;
    }

    date(value: Date) {
        return this.str(BinaryOffset.isoString(value));
    }

    bool(value: boolean) {
        return this.enqueue(BinaryOffset.BOOLEAN, (w) => w.bool(value));
    }

    nullLen() {
        return this.enqueue(BinaryOffset.UINT8, (w) => w.nullLen());
    }

    int8(value: number) {
        return this.enqueue(BinaryOffset.INT8, (w) => w.int8(value));
    }

    uint8(value: number) {
        return this.enqueue(BinaryOffset.UINT8, (w) => w.uint8(value));
    }

    int16(value: number) {
        return this.enqueue(BinaryOffset.INT16, (w) => w.int16LE(value));
    }

    int16LE(value: number) {
        return this.enqueue(BinaryOffset.INT16, (w) => w.int16LE(value));
    }

    int16BE(value: number) {
        return this.enqueue(BinaryOffset.INT16, (w) => w.int16BE(value));
    }

    uint16(value: number) {
        return this.enqueue(BinaryOffset.UINT16, (w) => w.uint16LE(value));
    }

    uint16LE(value: number) {
        return this.enqueue(BinaryOffset.UINT16, (w) => w.uint16LE(value));
    }

    uint16BE(value: number) {
        return this.enqueue(BinaryOffset.UINT16, (w) => w.uint16BE(value));
    }

    int32(value: number) {
        return this.enqueue(BinaryOffset.INT32, (w) => w.int32LE(value));
    }

    int32LE(value: number) {
        return this.enqueue(BinaryOffset.INT32, (w) => w.int32LE(value));
    }

    int32BE(value: number) {
        return this.enqueue(BinaryOffset.INT32, (w) => w.int32BE(value));
    }

    uint32(value: number) {
        return this.enqueue(BinaryOffset.UINT32, (w) => w.uint32LE(value));
    }

    uint32LE(value: number) {
        return this.enqueue(BinaryOffset.UINT32, (w) => w.uint32LE(value));
    }

    uint32BE(value: number) {
        return this.enqueue(BinaryOffset.UINT32, (w) => w.uint32BE(value));
    }

    float32(value: number) {
        return this.enqueue(BinaryOffset.FLOAT32, (w) => w.float32LE(value));
    }

    float32LE(value: number) {
        return this.enqueue(BinaryOffset.FLOAT32, (w) => w.float32LE(value));
    }

    float32BE(value: number) {
        return this.enqueue(BinaryOffset.FLOAT32, (w) => w.float32BE(value));
    }

    float64(value: number) {
        return this.enqueue(BinaryOffset.FLOAT64, (w) => w.float64LE(value));
    }

    float64LE(value: number) {
        return this.enqueue(BinaryOffset.FLOAT64, (w) => w.float64LE(value));
    }

    float64BE(value: number) {
        return this.enqueue(BinaryOffset.FLOAT64, (w) => w.float64BE(value));
    }

    str(value: string) {
        return this.enqueue(BinaryOffset.string(value), (w) => w.str(value));
    }

    len(value: number) {
        return this.enqueue(BinaryOffset.getLength(value), (w) => w.len(value));
    }

    strValue(value: string) {
        return this.enqueue(BinaryOffset.stringLengthInBytes(value), (w) => w.strValue(value));
    }

    uint8Array(value: Uint8Array) {
        return this.enqueue(BinaryOffset.getBufferLengthWithLength(value), (w) =>
            w.uint8Array(value),
        );
    }

    bytes(value: Uint8Array) {
        return this.enqueue(value.byteLength, (w) => w.bytes(value));
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
        return this.enqueue(BinaryOffset.UINT8, (w) =>
            w.write8Bools(b0, b1, b2, b3, b4, b5, b6, b7),
        );
    }

    writeNullable<T>(value: T | null | undefined, write: (w: this, value: T) => void) {
        if (value == null) {
            this.enqueue(BinaryOffset.UINT8, (w) => w.uint8(0));
        } else {
            this.enqueue(BinaryOffset.UINT8, (w) => w.uint8(1));
            write(this, value);
        }
        return this;
    }

    packBits<T>(fn: (bits: IBitWriter) => T): this {
        let accumulator = 0;
        let count = 0;

        const emit = (value: number, bits: number) => {
            for (let i = 0; i < bits; i++) {
                const bitValue = (value >> i) & 1;
                accumulator |= bitValue << count;
                count++;

                if (count === 8) {
                    const byte = accumulator;
                    this.enqueue(BinaryOffset.UINT8, (w) => w.uint8(byte));
                    accumulator = 0;
                    count = 0;
                }
            }
        };

        fn(BinaryOffset.createBitWriter(emit));

        if (count > 0) {
            const byte = accumulator;
            this.enqueue(BinaryOffset.UINT8, (w) => w.uint8(byte));
        }
        return this;
    }

    buffer() {
        const writer = new BinaryWriter(this.size);
        for (let i = 0; i < this.actionQueue.length; i++) {
            this.actionQueue[i]!(writer);
        }
        return writer.buffer();
    }
}
