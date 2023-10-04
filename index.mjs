import dgram from 'node:dgram';
import path from 'node:path';
import os from 'node:os';
import dotenv from 'dotenv';
import WebSocket, { WebSocketServer } from 'ws';
import express from 'express';

const IS_LE = os.endianness() === 'LE';

dotenv.config({
    path: path.resolve(process.cwd(), 'xws_config.txt')
});

// Express server
const serverApp = express();

if (process.env.XWS_STATIC && process.env.XWS_STATIC !== "null") {
    serverApp.use('/', express.static(process.env.XWS_STATIC));
}

const expressServer = serverApp.listen(parseInt(process.env.XWS_PORT) || 5173);

// WebSocket server that automatically handles upgrade events from express server
const wsServer = new WebSocketServer({ server: expressServer });

wsServer.on('connection', ws => {
    ws.on('error', console.error);
    ws.on('message', handleWebSocketMessage.bind(ws))
});

// UDP socket to send/receive X-Plane data
const dgramSocket = dgram.createSocket('udp4');
dgramSocket.bind();

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
    const dv = new DataView(buf);

    buf.write('DREF', 0);
    dv.setFloat32(data, 5, IS_LE);
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
    const dv = new DataView(buf);

    buf.write('RREF', 0);
    dv.setInt32(freq, 5, IS_LE);
    dv.setInt32(index, 9, IS_LE);
    buf.write(drefPath, 13, 'latin1');

    return buf;
}

/**
 * Decodes an rref response (this assumes the response is known to be rref)
 * @param {Buffer} buf - The response buffer
 * @returns {Map<number, number>}
 */
function decodeRrefResponse(buf) {
    /** @type {Map<number, number>} */
    const out = new Map();
    const dv = new DataView(buf);
    const limit = buf.length - 7;

    for (let offset = 5; offset < limit; offset += 8) {
        const index = dv.getInt32(offset, IS_LE);
        const value = dv.getFloat32(offset + 4, IS_LE);
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