export enum BinaryTag {
    Undefined = 0,
    Null = 1,
    True = 2,
    False = 3,
    Uint8 = 4,
    Uint16 = 5,
    Uint32 = 6,
    Int8 = 7,
    Int16 = 8,
    Int32 = 9,
    Float32 = 10,
    Float64 = 11,
    StringNew = 12,
    StringRef = 13,
    Array = 14,
    Uint8Array = 15,
    Object = 16,
}

export interface IBinaryOffset {
    readonly BOOLEAN: number;
    readonly BOOLS8: number;
    readonly INT8: number;
    readonly UINT8: number;
    readonly INT16: number;
    readonly UINT16: number;
    readonly INT32: number;
    readonly UINT32: number;
    readonly FLOAT32: number;
    readonly FLOAT64: number;
    readonly DATE_ISO_STRING: number;
    getLength(value: number): number;
    getAnyLength(value: unknown, strings?: Map<string, number>): number;
    getShortLength(length: number): number;
    string(value: string): number;
    getBufferLengthWithLength(buffer: { readonly byteLength: number }): number;
    stringLengthInBytes(value: string): number;
    charLengthInBytes(code: number): number;
    nullableLen<T>(value: T | null | undefined, size: (value: T) => number): number;
}

export interface IBitWriter {
    bit(value: boolean | number): IBitWriter;
    uint2(value: number): IBitWriter;
    int2(value: number): IBitWriter;
    uint4(value: number): IBitWriter;
    int4(value: number): IBitWriter;
}

export interface IBitReader {
    bit(): boolean;
    uint2(): number;
    int2(): number;
    uint4(): number;
    int4(): number;
}

export type IBitSizeCounter = IBitWriter;

export interface IByteSinkMethods {
    readonly length: number;
    reset(): void;
    view(): Uint8Array;
    writeVarint(value: number): void;
    writeZigzag(value: number): void;
}

export interface IVarintReaderMethods {
    readonly offset: number;
    readVarint(): number;
    readZigzag(): number;
}

export interface IBinaryWriteMethods extends IBinaryOffset {
    bool(value: boolean): this;
    nullLen(): this;
    buffer(): Uint8Array;
    copy(): Uint8Array;
    reset(): this;
    date(value: Date): this;
    int8(value: number): this;
    uint8(value: number): this;
    int16(value: number): this;
    int16LE(value: number): this;
    int16BE(value: number): this;
    uint16(value: number): this;
    uint16LE(value: number): this;
    uint16BE(value: number): this;
    int32(value: number): this;
    int32LE(value: number): this;
    int32BE(value: number): this;
    uint32(value: number): this;
    uint32LE(value: number): this;
    uint32BE(value: number): this;
    float32(value: number): this;
    float32LE(value: number): this;
    float32BE(value: number): this;
    float64(value: number): this;
    float64LE(value: number): this;
    float64BE(value: number): this;
    str(value: string): this;
    len(value: number): this;
    strValue(value: string, precomputedByteLength?: number): this;
    encodeStringTo(offset: number, value: string): number;
    chr(offset: number, code: number): number;
    uint8Array(value: Uint8Array): this;
    bytes(value: Uint8Array): this;
    packBits<T>(fn: (bits: IBitWriter) => T): this;
    writeInternedString(value: string, strings: Map<string, number>): this;
    any(value: unknown, strings?: Map<string, number>): this;
    writeObject(value: Record<string, unknown>, strings?: Map<string, number>): this;
    writeNullable<T>(value: T | null | undefined, write: (w: this, value: T) => void): this;
    write8Bools(
        b0: boolean,
        b1?: boolean,
        b2?: boolean,
        b3?: boolean,
        b4?: boolean,
        b5?: boolean,
        b6?: boolean,
        b7?: boolean,
    ): this;
}

export interface IBinaryReaderMethods extends IBinaryOffset {
    readonly remaining: number;
    int8(): number;
    uint8(): number;
    int16(): number;
    int16LE(): number;
    int16BE(): number;
    uint16(): number;
    uint16LE(): number;
    uint16BE(): number;
    int32(): number;
    int32LE(): number;
    int32BE(): number;
    uint32(): number;
    uint32LE(): number;
    uint32BE(): number;
    float32(): number;
    float32LE(): number;
    float32BE(): number;
    float64(): number;
    float64LE(): number;
    float64BE(): number;
    date(): Date;
    bytes(length: number): Uint8Array;
    bool(): boolean;
    str(): string;
    len(): number;
    uint8Array(): Uint8Array;
    decodeString(offset: number, length: number): string;
    readNullable<T>(read: (r: this) => T): T | null;
    read8Bools(): [boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean];
    readBits<T>(fn: (bits: IBitReader) => T): T;
    any(strings?: string[]): unknown;
    readAny(strings?: string[]): unknown;
    readObject(strings?: string[]): Record<string, unknown>;
}

export interface IBinarySizeWriterMethods extends IBinaryOffset {
    readonly byteLength: number;
    bool(): this;
    int8(): this;
    uint8(): this;
    int16(): this;
    int16LE(): this;
    int16BE(): this;
    uint16(): this;
    uint16LE(): this;
    uint16BE(): this;
    int32(): this;
    int32LE(): this;
    int32BE(): this;
    uint32(): this;
    uint32LE(): this;
    uint32BE(): this;
    float32(): this;
    float32LE(): this;
    float32BE(): this;
    float64(): this;
    float64LE(): this;
    float64BE(): this;
    date(value?: Date): this;
    bools8(): this;
    uint8Array(value: Uint8Array): this;
    str(value: string): this;
    len(value: number): this;
    any(value: unknown, strings?: Map<string, number>): this;
    packBits<T>(fn: (bits: IBitSizeCounter) => T): this;
    writeNullable<T>(value: T | null | undefined, size: (value: T) => number): this;
    make(): IBinaryWriteMethods;
}

export interface IBinaryDynamicWriterMethods extends IBinaryOffset {
    date(value: Date): this;
    bool(value: boolean): this;
    nullLen(): this;
    int8(value: number): this;
    uint8(value: number): this;
    int16(value: number): this;
    int16LE(value: number): this;
    int16BE(value: number): this;
    uint16(value: number): this;
    uint16LE(value: number): this;
    uint16BE(value: number): this;
    int32(value: number): this;
    int32LE(value: number): this;
    int32BE(value: number): this;
    uint32(value: number): this;
    uint32LE(value: number): this;
    uint32BE(value: number): this;
    float32(value: number): this;
    float32LE(value: number): this;
    float32BE(value: number): this;
    float64(value: number): this;
    float64LE(value: number): this;
    float64BE(value: number): this;
    str(value: string): this;
    len(value: number): this;
    strValue(value: string, precomputedByteLength?: number): this;
    uint8Array(value: Uint8Array): this;
    bytes(value: Uint8Array): this;
    packBits<T>(fn: (bits: IBitWriter) => T): this;
    buffer(): Uint8Array;
    writeNullable<T>(value: T | null | undefined, write: (w: this, value: T) => void): this;
    write8Bools(
        b0: boolean,
        b1?: boolean,
        b2?: boolean,
        b3?: boolean,
        b4?: boolean,
        b5?: boolean,
        b6?: boolean,
        b7?: boolean,
    ): this;
}

export interface IBinaryReader extends IBinaryOffset {
    new (buffer: Uint8Array | ArrayBuffer): IBinaryReaderMethods;
}

export interface IBinaryWriter extends IBinaryOffset {
    new (size: number): IBinaryWriteMethods;
}

export interface IBinarySizeWriter extends IBinaryOffset {
    new (): IBinarySizeWriterMethods;
}

export interface IBinaryDynamicWriter extends IBinaryOffset {
    new (): IBinaryDynamicWriterMethods;
}

export interface IByteSink {
    new (initialCapacity?: number): IByteSinkMethods;
}

export interface IVarintReader {
    new (bytes: Uint8Array, start?: number): IVarintReaderMethods;
}

export interface IBinary {
    BinaryWriter: IBinaryWriter;
    BinaryDynamicWriter: IBinaryDynamicWriter;
    BinarySizeWriter: IBinarySizeWriter;
    BinaryReader: IBinaryReader;
    BinaryOffset: IBinaryOffset;
    BinaryTag: typeof BinaryTag;
    BINARY_EMPTY: Uint8Array;
    BINARY_FLOAT: Float32Array;
    ByteSink: IByteSink;
    VarintReader: IVarintReader;
}
