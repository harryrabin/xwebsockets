import os from 'node:os';

namespace buffers {
    export function constructCmnd(commandPath: string): Buffer {
        return Buffer.from('CMND\0' + commandPath, 'ascii');
    }

    export function constructDref(data: number, drefPath: string): Buffer {
        const buf = Buffer.alloc(509, 0);
        const x = new XPDataView(buf);

        buf.write('DREF', 0);
        x.writeXFlt(data, 5);
        buf.write(drefPath, 9, 'ascii');

        return buf;
    }

    export function constructRref(freq: number, index: number, drefPath: string): Buffer {
        const buf = Buffer.alloc(413, 0);
        const x = new XPDataView(buf);

        buf.write('RREF', 0);
        x.writeXInt(freq, 5);
        x.writeXInt(index, 9);
        buf.write(drefPath, 13, 'ascii');

        return buf;
    }

    export function decodeRrefResponse(buf: Buffer): Map<number, number> {
        const out = new Map<number, number>();
        const x = new XPDataView(buf);

        const limit = buf.length - 7;

        for (let offset = 5; offset < limit; offset += 8) {
            const index = x.readXInt(offset);
            const value = x.readXFlt(offset + 4);
            out.set(index, value);
        }

        return out;
    }

    const IS_LE = os.endianness() === 'LE' ?
        (process.env.XWS_FLIP_BYTES !== 'true')
        : (process.env.XWS_FLIP_BYTES === 'true');

    type ReaderFunction = (offset: number) => number;
    type WriterFunction = (value: number, offset: number) => void;

    class XPDataView {
        readonly readXFlt: ReaderFunction;
        readonly writeXFlt: WriterFunction;

        readonly readXInt: ReaderFunction;
        readonly writeXInt: WriterFunction;

        constructor(buf: Buffer) {
            if (IS_LE) {
                this.readXFlt = Buffer.prototype.readFloatLE.bind(buf);
                this.writeXFlt = Buffer.prototype.writeFloatLE.bind(buf);
                this.readXInt = Buffer.prototype.readInt32LE.bind(buf);
                this.writeXInt = Buffer.prototype.writeInt32LE.bind(buf);
            } else {
                this.readXFlt = Buffer.prototype.readFloatBE.bind(buf);
                this.writeXFlt = Buffer.prototype.writeFloatBE.bind(buf);
                this.readXInt = Buffer.prototype.readInt32BE.bind(buf);
                this.writeXInt = Buffer.prototype.writeInt32BE.bind(buf);
            }
        }
    }
}

export default buffers;