import dgram from 'node:dgram';
import path from 'node:path';
import dotenv from 'dotenv';
import WebSocket, { WebSocketServer } from 'ws';
import express from 'express';
import ip from 'ip';
import * as buffers from './buffers';

dotenv.config({
    path: path.resolve(process.cwd(), 'xws_config.txt')
});

const XP_PORT = 49000;
const SERVER_PORT = parseInt(process.env.XWS_PORT!) || 0;
const DEBUG_MODE = process.env.XWS_ENV === 'debug';

// Express server
const serverApp = express();

if (DEBUG_MODE) serverApp.use('/', (req, _res, next) => {
    console.log(`${req.method} ${req.originalUrl}`);
    next();
});

if (process.env.XWS_STATIC && process.env.XWS_STATIC !== "null") {
    serverApp.use('/', express.static(process.env.XWS_STATIC));
}

const expressServer = serverApp.listen(SERVER_PORT);

if (DEBUG_MODE) expressServer.on('upgrade', (req) => {
    console.log(`UPGRADE ${req.method} ${req.url}`);
})

// WebSocket server that automatically handles upgrade events from express server
const wsServer = new WebSocketServer({ server: expressServer });

wsServer.on('connection', ws => {
    ws.on('message', handleWebSocketMessage.bind(ws));
    if (DEBUG_MODE) ws.on('error', console.error);
});

function handleWebSocketMessage(this: WebSocket, rawData: WebSocket.RawData) {
    const data = JSON.parse(rawData.toString());

    // console.dir(data);

    let msg: Buffer | undefined;

    switch (data['header']) {
        case "CMND":
            msg = buffers.constructCmnd(data['path']);
            break;

        case "DREF":
            msg = buffers.constructDref(data['data'], data['path']);
            break;

        case "RREF":
            msg = buffers.constructRref(data['freq'], data['index'], data['path']);
            break;
    }

    if (msg) {
        // logBuffer(msg);
        dgramSocket.send(msg, XP_PORT);
    }
}

// UDP socket to send/receive X-Plane data
const dgramSocket = dgram.createSocket('udp4');
dgramSocket.bind();

dgramSocket.on('message', (msg) => {
    const header = msg.toString('ascii', 0, 4);

    if (header === 'RREF') {
        const map = buffers.decodeRrefResponse(msg);

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

// Debug helper
function logBuffer(inputBuf: Buffer) {
    const buf = Buffer.from(inputBuf);
    const limit = buf.length - 1;
    for (let offset = 0; offset < limit; offset++) {
        const char = buf.readUInt8(offset);
        if (char < 32 || char > 126) buf.writeUInt8(63, offset);
        if (char === 0) buf.writeUInt8(95, offset);
    }
    console.log(buf.toString('latin1'));
}

// Launch complete!
console.log(`Server running @ http://${ip.address()}:${SERVER_PORT}`);