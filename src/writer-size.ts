import { BinaryOffset } from "./offset";
import type { IBinarySizeWriterMethods, IBitSizeCounter } from "./types";
import { BinaryWriter } from "./writer";

export class BinarySizeWriter
  extends BinaryOffset
  implements IBinarySizeWriterMethods
{
  private size = 0;

  get byteLength() {
    return this.size;
  }

  private add(bytes: number) {
    this.size += bytes;
    return this;
  }

  bool() {
    return this.add(BinaryOffset.BOOLEAN);
  }

  int8() {
    return this.add(BinaryOffset.INT8);
  }

  uint8() {
    return this.add(BinaryOffset.UINT8);
  }

  int16() {
    return this.add(BinaryOffset.INT16);
  }

  int16LE() {
    return this.add(BinaryOffset.INT16);
  }

  int16BE() {
    return this.add(BinaryOffset.INT16);
  }

  uint16() {
    return this.add(BinaryOffset.UINT16);
  }

  uint16LE() {
    return this.add(BinaryOffset.UINT16);
  }

  uint16BE() {
    return this.add(BinaryOffset.UINT16);
  }

  int32() {
    return this.add(BinaryOffset.INT32);
  }

  int32LE() {
    return this.add(BinaryOffset.INT32);
  }

  int32BE() {
    return this.add(BinaryOffset.INT32);
  }

  uint32() {
    return this.add(BinaryOffset.UINT32);
  }

  uint32LE() {
    return this.add(BinaryOffset.UINT32);
  }

  uint32BE() {
    return this.add(BinaryOffset.UINT32);
  }

  float32() {
    return this.add(BinaryOffset.FLOAT32);
  }

  float32LE() {
    return this.add(BinaryOffset.FLOAT32);
  }

  float32BE() {
    return this.add(BinaryOffset.FLOAT32);
  }

  float64() {
    return this.add(BinaryOffset.FLOAT64);
  }

  float64LE() {
    return this.add(BinaryOffset.FLOAT64);
  }

  float64BE() {
    return this.add(BinaryOffset.FLOAT64);
  }

  date(value?: Date) {
    if (value === undefined) {
      return this.add(BinaryOffset.DATE_ISO_STRING);
    }
    return this.add(BinaryOffset.string(BinaryOffset.isoString(value)));
  }

  bools8() {
    return this.add(BinaryOffset.UINT8);
  }

  str(value: string) {
    return this.add(BinaryOffset.string(value));
  }

  len(value: number) {
    return this.add(BinaryOffset.getLength(value));
  }

  uint8Array(value: Uint8Array) {
    return this.add(BinaryOffset.getBufferLengthWithLength(value));
  }

  writeNullable<T>(value: T | null | undefined, size: (value: T) => number) {
    return this.add(BinaryOffset.nullableLen(value, size));
  }

  any(value: unknown, strings: Map<string, number> = new Map()) {
    return this.add(BinaryOffset.getAnyLength(value, strings));
  }

  packBits<T>(fn: (bits: IBitSizeCounter) => T): this {
    let bitCount = 0;

    const counter: IBitSizeCounter = {
      bit: () => {
        bitCount += 1;
        return counter;
      },
      uint2: () => {
        bitCount += 2;
        return counter;
      },
      int2: () => {
        bitCount += 2;
        return counter;
      },
      uint4: () => {
        bitCount += 4;
        return counter;
      },
      int4: () => {
        bitCount += 4;
        return counter;
      },
    };

    fn(counter);
    return this.add(Math.ceil(bitCount / 8));
  }

  make() {
    const writer = new BinaryWriter(this.size);
    this.size = 0;
    return writer;
  }
}