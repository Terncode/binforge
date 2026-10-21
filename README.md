# binforge

A compact, dependency-free binary serializer for TypeScript, with variant lengths, string
interning, bit packing, and explicit little- and big-endian primitives.

- Zero runtime dependencies
- Explicit byte layout — nothing is hidden behind `JSON.stringify`
- Fixed-size and growable writers, plus a size-only pass for exact buffer allocation
- Self-describing `any` encoding with string interning for repeated keys/values
- UTF-8 strings, ISO-8601 dates, packed bits, nullables, and typed primitives

## Install

```sh
npm install binforge
```

Ships both ESM and CommonJS builds, so `import` and `require` both work:

```ts
import { BinaryWriter } from "binforge"; // ESM
```

```js
const { BinaryWriter } = require("binforge"); // CommonJS
```

The declarations are emitted with generic typed arrays (`Uint8Array<ArrayBuffer>`), so
consumers need **TypeScript >= 5.7**.

## Quick start

```ts
import { BinaryWriter, BinaryReader } from "binforge";

const writer = new BinaryWriter(64);
writer.uint8(1).str("hello").int32(-42).float64(3.14).bool(true);

const bytes = writer.copy();
const reader = new BinaryReader(bytes);

reader.uint8(); // 1
reader.str(); // "hello"
reader.int32(); // -42
reader.float64(); // 3.14
reader.bool(); // true
```

`BinaryWriter` is fixed-size: you must know the byte length up front. If you do not, use
`BinarySizeWriter` to compute it, or `BinaryDynamicWriter` to build it lazily.

### Exact allocation with `BinarySizeWriter`

`BinarySizeWriter` mirrors the writer API but only counts bytes.

```ts
import { BinarySizeWriter, BinaryWriter } from "binforge";

const size = new BinarySizeWriter()
    .uint8(1)
    .str("hello")
    .int32(-42)
    .byteLength; // 1 + 1 + 5 + 4 = 11

const bytes = new BinaryWriter(size)
    .uint8(1)
    .str("hello")
    .int32(-42)
    .copy();
```

`make()` returns a `BinaryWriter` pre-sized to the accumulated byte length and resets the
counter, so the size writer can be reused for the next record.

### Growable output with `BinaryDynamicWriter`

`BinaryDynamicWriter` queues write operations and materialises the buffer on demand. Use it
when the shape of the payload is not known while writing.

```ts
import { BinaryDynamicWriter } from "binforge";

const writer = new BinaryDynamicWriter();
writer.str("hello").uint8(1).int32(-42);

const bytes = writer.buffer();
```

### Serialising arbitrary values

`any` / `readAny` round-trip JSON-like values, plus `Uint8Array` and `-0`.

```ts
import { BinaryWriter, BinaryReader } from "binforge";

const writer = new BinaryWriter(256);
writer.any({ id: 7, name: "ada", tags: ["x", "y"], blob: new Uint8Array([1, 2, 3]) });

const value = new BinaryReader(writer.buffer()).any();
// { id: 7, name: "ada", tags: ["x", "y"], blob: Uint8Array [ 1, 2, 3 ] }
```

To size an `any` payload, use `BinarySizeWriter.any(value).byteLength`.

## API

### `BinaryWriter(size: number)`

Fixed-capacity writer. Every method returns `this` for chaining.

| Method | Description |
| --- | --- |
| `bool(value)` | 1 byte, `0` or `1` |
| `nullLen()` | 1 byte, `0` (null length marker) |
| `int8` / `uint8` | 1 byte, range-checked |
| `int16` / `uint16` | 2 bytes, little-endian by default |
| `int16LE` / `int16BE` | 2 bytes, explicit endianness |
| `int32` / `uint32` | 4 bytes, little-endian by default |
| `int32LE` / `int32BE` | 4 bytes, explicit endianness |
| `float32` / `float32LE` / `float32BE` | 4 bytes IEEE-754 |
| `float64` / `float64LE` / `float64BE` | 8 bytes IEEE-754 |
| `date(value)` | ISO-8601 string (`toISOString()`) |
| `str(value)` | length-prefixed UTF-8 string |
| `strValue(value, precomputedByteLength?)` | UTF-8 bytes, **no** length prefix |
| `len(value)` | variable-length length prefix (see [Length encoding](#length-encoding)) |
| `uint8Array(value)` | length-prefixed byte block |
| `bytes(value)` | raw bytes, **no** length prefix |
| `write8Bools(b0, b1?, …, b7?)` | 8 booleans packed into 1 byte, `b0` is the LSB |
| `packBits(fn)` | packs 1/2/4-bit values into whole bytes |
| `writeNullable(value, write)` | 1 presence byte + payload |
| `writeInternedString(value, strings)` | interned string (see [String interning](#string-interning)) |
| `any(value, strings?)` | self-describing value encoding |
| `writeObject(value, strings?)` | self-describing object encoding |
| `buffer()` | `Uint8Array` view over the written region (no copy) |
| `copy()` | `Uint8Array` copy of the written region |
| `reset()` | rewinds the write cursor to `0` |

Out-of-range integers throw a `RangeError`; writing past the buffer capacity throws a
`RangeError`.

### `BinaryReader(buffer: Uint8Array | ArrayBuffer)`

| Method | Description |
| --- | --- |
| `remaining` | number of unread bytes |
| `bool()` | reads 1 byte, `true` when `1` |
| `int8` / `uint8` | 1 byte |
| `int16` / `uint16` / `int32` / `uint32` | little-endian by default |
| `int16LE` / `int16BE` / `int32LE` / `int32BE` / `uint16LE` / `uint16BE` / `uint32LE` / `uint32BE` | explicit endianness |
| `float32` / `float64` | IEEE-754, little-endian by default |
| `float32LE` / `float32BE` / `float64LE` / `float64BE` | explicit endianness |
| `date()` | parses an ISO-8601 string |
| `str()` | length-prefixed UTF-8 string |
| `len()` | reads a variable-length length prefix |
| `bytes(length)` | raw byte block |
| `uint8Array()` | length-prefixed byte block |
| `read8Bools()` | unpacks 8 booleans from 1 byte |
| `readBits(fn)` | reads packed 1/2/4-bit values |
| `readNullable(read)` | 1 presence byte + payload, `null` when absent |
| `any(strings?)` / `readAny(strings?)` | reads a self-describing value |
| `readObject(strings?)` | reads a self-describing object |

Reading past the end of the buffer throws; malformed UTF-8, malformed lengths, and unknown
tags all throw instead of returning corrupt data.

### `BinarySizeWriter()`

Mirrors the writer API but only counts bytes. `byteLength` returns the total.

```ts
const size = new BinarySizeWriter().str("hello").int32(1).byteLength;
```

`writeNullable(value, size)` takes a size callback instead of a write callback, and `any`
mirrors `BinaryWriter.any`. `bools8()` accounts for the 8-booleans-in-one-byte form, and
`date()` without a value accounts for a 25-byte ISO date. `make()` returns a
`BinaryWriter` sized to the accumulated length and resets the counter.

### `BinaryDynamicWriter()`

Queues operations and materialises them on `buffer()`.

```ts
const writer = new BinaryDynamicWriter();
writer.str("hello").uint8(1);
const bytes = writer.buffer();
```

`writeNullable(value, write)` receives the dynamic writer, so nested writes stay in order.

### `BinaryOffset`

A utility base class (also inherited by the writers and the reader) exposing the size
constants and the sizing helpers used to compute buffer lengths.

| Member | Description |
| --- | --- |
| `BOOLEAN` / `BOOLS8` / `INT8` / `UINT8` | `1` |
| `INT16` / `UINT16` | `2` |
| `INT32` / `UINT32` / `FLOAT32` | `4` |
| `FLOAT64` | `8` |
| `DATE_ISO_STRING` | `25` |
| `getLength(value)` | byte size of a length prefix |
| `string(value)` | byte size of a length-prefixed string |
| `stringLengthInBytes(value)` | UTF-8 byte length of a string |
| `charLengthInBytes(code)` | UTF-8 byte length of a code point |
| `getBufferLengthWithLength(buffer)` | byte size of a length-prefixed byte block |
| `getShortLength(length)` | byte size of a short length prefix (1 byte below 31, otherwise 1 + the variable length prefix) |
| `getAnyLength(value, strings?)` | byte size of an `any` payload |
| `nullableLen(value, size)` | byte size of a nullable payload |

`BinaryOffset` is also the base class of `BinaryWriter`, `BinaryReader`,
`BinarySizeWriter`, and `BinaryDynamicWriter`, so the sizing helpers are available on
every writer instance.

### `BinaryTag`

The tag byte used by `any` / `readAny`:

| Tag | Value | Payload |
| --- | --- | --- |
| `Undefined` | 0 | — |
| `Null` | 1 | — |
| `True` | 2 | — |
| `False` | 3 | — |
| `Uint8` | 4 | 1 byte |
| `Uint16` | 5 | 2 bytes, little-endian |
| `Uint32` | 6 | 4 bytes, little-endian |
| `Int8` | 7 | 1 byte |
| `Int16` | 8 | 2 bytes, little-endian |
| `Int32` | 9 | 4 bytes, little-endian |
| `Float32` | 10 | 4 bytes IEEE-754 |
| `Float64` | 11 | 8 bytes IEEE-754 |
| `StringNew` | 12 | length-prefixed UTF-8 string |
| `StringRef` | 13 | length-prefixed intern table index |
| `Array` | 14 | length-prefixed element count, then elements |
| `Uint8Array` | 15 | length-prefixed byte block |
| `Object` | 16 | length-prefixed key count, then key/value pairs |

### Exports

Value exports: `BinaryWriter`, `BinaryReader`, `BinarySizeWriter`, `BinaryDynamicWriter`,
`BinaryOffset`, `BinaryTag`, `BINARY_EMPTY`.

Type exports: `IBinary`, `IBinaryWriter`, `IBinaryReader`, `IBinarySizeWriter`,
`IBinaryDynamicWriter`, `IBinaryOffset`, `IBinaryWriteMethods`,
`IBinaryReaderMethods`, `IBinarySizeWriterMethods`, `IBinaryDynamicWriterMethods`,
`IBitWriter`, `IBitReader`, `IBitSizeCounter`.

Subpath export: `binforge/constants` exposes the raw size/depth constants
(`OFFSET_INT32`, `MAX_ANY_DEPTH`, …).

## Binary format
### Length encoding

Lengths use a LEB128-style variable-length encoding of `value + 1`. The `+1` keeps `0`
reserved as an invalid marker, so a valid length never encodes to a zero byte.

| Encoded value | Bytes | Decoded length range |
| --- | --- | --- |
| `≤ 0x7F` | 1 | `0 … 126` |
| `≤ 0x3FFF` | 2 | `127 … 16382` |
| `≤ 0x1FFFFF` | 3 | `16383 … 2097150` |
| `≤ 0x0FFFFFFF` | 4 | `2097151 … 268435454` |
| otherwise | 5 | `268435455 … 2147483646` |

Groups are stored least-significant first, with the continuation bit (`0x80`) set on every
byte except the last.

### Strings

Strings are a length prefix (in **bytes**, not UTF-16 code units) followed by UTF-8
encoded bytes. Unpaired surrogates are replaced with `U+FFFD` on write; overlong
encodings, lone surrogates, and invalid continuation bytes are rejected on read.

### Bit packing

`packBits` and `readBits` pack values LSB-first into whole bytes; a trailing partial byte
is zero-padded.

```ts
const writer = new BinaryWriter(1);
writer.packBits((b) => {
    b.bit(true).bit(false).bit(true).bit(true);
});
// 0b1101 = 0x0d
```

Available bit widths: `bit` (1), `uint2` / `int2` (2), `uint4` / `int4` (4). Signed widths
use two's complement.

### String interning

Repeated strings — typically object keys — can be written once and referenced afterwards.
The writer keeps a `Map<string, number>` of already-written strings; the reader keeps the
matching `string[]` table.

```ts
const strings = new Map<string, number>();
const writer = new BinaryWriter(64);

writer.writeInternedString("name", strings); // StringNew + "name"
writer.writeInternedString("name", strings); // StringRef + index 0

const reader = new BinaryReader(writer.buffer());
const table: string[] = [];
reader.any(table);
```

Indexes are assigned in first-seen order, so the reader reconstructs the same table.

### Nullables

`writeNullable` prefixes the payload with a presence byte (`1` = present, `0` = absent) and
`readNullable` mirrors it.

```ts
const writer = new BinaryWriter(16);
writer.writeNullable(42, (w, v) => w.int32(v));

const reader = new BinaryReader(writer.buffer());
reader.readNullable((r) => r.int32()); // 42
```

## Notes

- `BinaryWriter` is little-endian by default. The `LE`/`BE` variants are explicit; the
  unsuffixed 16/32/64-bit methods are aliases for the `LE` variants.
- `float32`/`float64` write `+value`, so numeric strings are coerced.
- `any` uses the smallest integer width that fits, promotes to `Float32` when the value is
  exactly representable as a `float32`, and otherwise uses `Float64`.
- `-0` is preserved as a `Float32` so that `Object.is` round-trips.
- `any` rejects `Date`, `Map`, `Set`, `ArrayBuffer`, and typed-array views other than
  `Uint8Array`; use `date()` / `uint8Array()` explicitly for those.
- `any` and `readAny` are depth-limited to 256 levels to stop runaway recursion.

## Development

```sh
npm install
npm run build      # tsdown -> dist/ (esm + cjs + types)
npm run typecheck  # tsc --noEmit over src/ and test/
npm test           # vitest run
npm run lint       # eslint
```

## License

[GPL-3.0-only](./LICENSE)
