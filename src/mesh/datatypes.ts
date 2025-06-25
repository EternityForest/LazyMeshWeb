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
        "description": "An ID that is unique within th channel",
        "type": "string",
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

    // Lower than 32 reserved for core protocol features
    {
        "id": 32,
        "name": "Simple Text Message",
        "description": "A simple text message, can be prefixed by username: ",
        "type": "string",
        "special": true
    },



    // 192-255 Reserved for device specific features
]

export const idToTypeInfo = new Map(dataIds.map((d) => [d.id, d]))
export const nameToIDMap = new Map(dataIds.map((d) => [d.name, d.id]))

export function nameToID(dataName: string): number {
    return nameToIDMap.get(dataName) || 0
}