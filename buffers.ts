import os from 'node:os';

export function constructCmnd(commandPath: string): Buffer {
    return Buffer.from('CMND\0' + commandPath);
}

export function constructDref(data: number, drefPath: string): Buffer {
    const buf = Buffer.alloc(509, 0);
    const xd = new XPDataView(buf);

    buf.write('DREF', 0);
    xd.writeXInt(data, 5);
    buf.write(drefPath, 9);

    return buf;
}

export function constructRref(freq: number, index: number, drefPath: string): Buffer {
    const buf = Buffer.alloc(413, 0);
    const xd = new XPDataView(buf);

    buf.write('RREF', 0);
    xd.writeXInt(freq, 5);
    xd.writeXInt(index, 9);
    buf.write(drefPath, 13, 'latin1');

    return buf;
}

export function decodeRrefResponse(buf: Buffer): Map<number, number> {
    const out = new Map<number, number>();
    const xd = new XPDataView(buf);

    const limit = buf.length - 7;

    for (let offset = 5; offset < limit; offset += 8) {
        const index = xd.readXInt(offset);
        const value = xd.readXFlt(offset + 4);
        out.set(index, value);
    }

    return out;
}

const IS_LE = os.endianness() === 'LE';

type ReaderFunction = (offset: number) => number;
type WriterFunction = (value: number, offset: number) => void;

export class XPDataView {
    readonly readXInt: ReaderFunction;
    readonly writeXInt: WriterFunction;

    readonly readXFlt: ReaderFunction;
    readonly writeXFlt: WriterFunction;

    constructor(buf: Buffer) {
        if (IS_LE) {
            this.readXInt = buf.readInt32LE.bind(buf)
            this.writeXInt = buf.writeInt32LE.bind(buf)
            this.readXFlt = buf.readFloatLE.bind(buf)
            this.writeXFlt = buf.writeFloatLE.bind(buf)
        } else {
            this.readXInt = buf.readInt32BE.bind(buf);
            this.writeXInt = buf.writeInt32BE.bind(buf);
            this.readXFlt = buf.readFloatBE.bind(buf);
            this.writeXFlt = buf.writeFloatBE.bind(buf);
        }
    }
}