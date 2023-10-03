# XWebSockets
### UDP ⇆ WebSockets translator for X-Plane

### Features:
- Static asset server
- Simple, JSON-based communication

### Currently supported operations:
- CMND
- RREF
- DREF

### Installation
Prerequisites: Node.js, NPM

Clone the repository, open up your shell and navigate to the repo folder. Run `npm install` to install dependencies and `node index.mjs` to start the server.

<hr>

## Commands

To actuate a command, send the following JSON:
```json
{
    "header": "CMND",
    "path": "sim/autopilot/heading_sync"
}
```

## Datarefs

To set a dataref, send the following JSON:
```json
{
    "header": "DREF",
    "path": "sim/cockpit/radios/transponder_code",
    "data": 1200
}
```

To subscribe to dataref updates, send the following JSON:
```json
{
    "header": "RREF",
    "freq": 5,
    "index": 101,
    "path": "sim/cockpit/autopilot/heading_mag"
}
```

`freq` times per second, you'll receive the following JSON:
```json
{
    "header": "RREF",
    "data": [
        [101, 212.366]
    ]
}
```

X-Plane is smart and can batch datarefs over UDP, and XWebSockets matches that behavior. Returned JSON could look like:
```json
{
    "header": "RREF",
    "data": [
        [101, 212.366],
        [102, 1200],
        [103, 129100]
    ]
}
```

