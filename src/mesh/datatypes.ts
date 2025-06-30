export const dataIds = [
    {
        "id": 0,
        "name": "Invalid",
        "description": "Invalid and reserved",
        "type": "invalid",
        "special": true
    },
    { "id": 1,
        "name": "Data Request",
        "description": "A request for data, list of Data IDs, or 0 to request all data",
        "type": "array",
        "special": true
    },
    {
        "id": 2,
        "name": "Unique ID",
        "description": "An ID that is unique within the channel",
        "type": "number",
        "special": false,
        "writable": true
    },
    {
        "id": 3,
        "name": "Friendly Name",
        "description": "An arbitrary non-unique name",
        "type": "string",
        "special": false,
        "writable": true
    },
    {
        "id": 4,
        "name": "Documentation URL",
        "description": "A URL to HTML/PDF/Markdown Documentation",
        "type": "string",
        "special": false,
        "writable": true
    },
    {
        "id": 5,
        "name": "Destination Node",
        "description": "Must be a node ID, If present, all other nodes ignore this packet",
        "type": "number",
        "special": true,
        "writable": true
    },
    {
        "id": 6,
        "name": "Write Command",
        "description": "If the value is 1, all subsequent values are interpreted as commands to set the values",
        "type": "number",
        "special": true,
        "writable": true
    },


    // Lower than 32 reserved for core protocol features
    {
        "id": 32,
        "name": "Simple Text Message",
        "description": "A simple text message, can be prefixed by username: ",
        "type": "string",
        "special": true
    },

    {
        "id": 33,
        "name": "Battery Level",
        "description": "0-255 internal battery level",
        "type": "number",
        "special": false
    },
    {
        "id": 34,
        "name": "Battery Voltage",
        "description": "Battery Voltage",
        "unit": "V",
        "scale": 0.025,
        "type": "number",
        "special": false
    },
    {
        "id": 35,
        "name": "Input Voltage",
        "description": "Input Voltage",
        "unit": "V",
        "scale": 0.025,
        "type": "number",
        "special": false
    },
    {
        "id": 35,
        "name": "Input Voltage",
        "description": "Input Voltage",
        "unit": "V",
        "scale": 0.025,
        "type": "number",
        "special": false
    },
    {
        "id": 35,
        "name": "Input Current",
        "description": "Input Current",
        "unit": "A",
        "scale": 0.01,
        "type": "number",
        "special": false
    },
    {
        "id": 36,
        "name": "Motion Event Count",
        "description": "Motion Event Count",
        "type": "number",
        "special": false
    }
    // 192-255 Reserved for device specific features
]

export const idToTypeInfo = new Map(dataIds.map((d) => [d.id, d]))
export const nameToIDMap = new Map(dataIds.map((d) => [d.name, d.id]))

export function nameToID(dataName: string): number {
    return nameToIDMap.get(dataName) || 0
}