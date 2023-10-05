import os from 'node:os';

const IS_LE = os.endianness() === 'LE';

export function constructCmndBuffer(commandPath: string): Buffer {
    return Buffer.from('CMND\0' + commandPath);
}

export function constructDrefBuffer(data: number, drefPath: string): Buffer {
    const buf = Buffer.alloc(509, 0);
    const xd = new XDataGetter(buf);

    buf.write('DREF', 0);
    xd.writeXInt(data, 5);
    buf.write(drefPath, 9);

    return buf;
}

export function constructRrefBuffer(freq: number, index: number, drefPath: string): Buffer {
    const buf = Buffer.alloc(413, 0);
    const xd = new XDataGetter(buf);

    buf.write('RREF', 0);
    xd.writeXInt(freq, 5);
    xd.writeXInt(index, 9);
    buf.write(drefPath, 13, 'latin1');

    return buf;
}

export function decodeRrefResponse(buf: Buffer): Map<number, number> {
    const out = new Map<number, number>();
    const xd = new XDataGetter(buf);

    const limit = buf.length - 7;

    for (let offset = 5; offset < limit; offset += 8) {
        const index = xd.readXInt(offset);
        const value = xd.readXFlt(offset + 4);
        out.set(index, value);
    }

    return out;
}

type ReaderFunction = (offset: number) => number;
type WriterFunction = (value: number, offset: number) => void;

export class XDataGetter {
    readonly readXInt: ReaderFunction;
    readonly writeXInt: WriterFunction;

    readonly readXFlt: ReaderFunction;
    readonly writeXFlt: WriterFunction;

    constructor(buf: Buffer) {
        this.readXInt = IS_LE ? buf.readInt32LE.bind(buf) : buf.readInt32BE.bind(buf);
        this.writeXInt = IS_LE ? buf.writeInt32LE.bind(buf) : buf.writeInt32BE.bind(buf);
        this.readXFlt = IS_LE ? buf.readFloatLE.bind(buf) : buf.readFloatBE.bind(buf);
        this.writeXFlt = IS_LE ? buf.writeFloatLE.bind(buf) : buf.writeFloatBE.bind(buf);
    }
}