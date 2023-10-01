import dgram from 'node:dgram';
import WebSocket, { WebSocketServer } from 'ws';

const dgramSocket = dgram.createSocket('udp4')
dgramSocket.bind();

const wsServer = new WebSocketServer({ port: 5174 });
wsServer.on('connection', ws => {
    ws.on('error', console.error);
    ws.on('message', handleWebSocketMessage.bind(ws))
});

dgramSocket.on('message', (msg) => {
    const header = msg.toString('latin1', 0, 4);

    if (header === 'RREF') {
        const map = decodeRrefResponse(msg);

        const jsonData = [];
        for (const pair of map.entries()) {
            jsonData.push(pair);
        }

        const jsonString = JSON.stringify({
            header: 'RREF',
            data: jsonData
        });

        wsServer.clients.forEach(client => {
            if (client.readyState !== WebSocket.OPEN) return;
            client.send(jsonString);
        });
    }
});

/**
 * Handle received WebSocket message
 * @param {string} rawData
 */
function handleWebSocketMessage(rawData) {
    const data = JSON.parse(rawData);

    switch (data['header']) {
        case "CMND":
            dgramSocket.send(constructCmndBuffer(data['path']), 49000);
            break;

        case "DREF":
            dgramSocket.send(constructDrefBuffer(data['data'], data['path']), 49000);
            break;
        
        case "RREF":
            dgramSocket.send(constructRrefBuffer(data['freq'], data['index'], data['path']), 49000);
            break;
    }
}

/**
 * Builds a buffer to send a command
 * @param {string} commandPath - The command path
 * @returns {Buffer}
 */
function constructCmndBuffer(commandPath) {
    return Buffer.from('CMND\0' + commandPath);
}

/**
 * Builds a buffer to set a dataref
 * @param {number} data - The number to set dataref to
 * @param {string} drefPath - The dataref path
 * @returns {Buffer}
 */
function constructDrefBuffer(data, drefPath) {
    const buf = Buffer.alloc(509, 0);

    buf.write('DREF', 0);
    buf.writeFloatLE(data, 5)
    buf.write(drefPath, 9);

    return buf;
}

/**
 * Builds a buffer to request datarefs to be sent back
 * @param {number} freq - Times per-second to receive dataref
 * @param {number} index - Unique 32-bit identifier for received data
 * @param {string} drefPath - The dataref path
 * @returns {Buffer}
 */
function constructRrefBuffer(freq, index, drefPath) {
    const buf = Buffer.alloc(413, 0);

    buf.write('RREF', 0);
    buf.writeInt32LE(freq, 5);
    buf.writeInt32LE(index, 9);
    buf.write(drefPath, 13, 'ascii');

    return buf;
}

/**
 * Decodes an rref response (this assumes the response is known to be rref)
 * @param {Buffer} buf - The response buffer
 * @returns {Map<number, number>}
 */
function decodeRrefResponse(buf) {
    const out = new Map();
    const limit = buf.length - 7;

    for (let offset = 5; offset < limit; offset += 8) {
        const index = buf.readInt32LE(offset);
        const value = buf.readFloatLE(offset + 4);
        out.set(index, value);
    }

    return out;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function logBuffer(inputBuf) {
    const buf = Buffer.from(inputBuf);
    const limit = buf.length - 1;
    for (let offset = 0; offset < limit; offset++) {
        const char = buf.readUInt8(offset);
        if (char < 32 || char > 126) buf.writeUInt8(63, offset);
        if (char === 0) buf.writeUInt8(48, offset);
    }
    console.log(buf.toString('latin1'));
}