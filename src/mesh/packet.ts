
import { encode, decode } from "@msgpack/msgpack";

export class PacketMetadata {
    
}

export class Payload {
  private items: [number, string | number][] = [];

  unixTime: number = 0;

  addData(id: number, item: string | number): void {
    this.items.push([id, item]);
  }

  getDataById(id: number): (string | number)[] {
    return this.items.filter(([entryId]) => entryId === id).map(([, entry]) => entry);
  }

  [Symbol.iterator](): Iterator<[number, string | number]> {
    return this.items[Symbol.iterator]();
  }

  static fromBuffer(buf: Uint8Array): Payload {
    const unpacked = decode(buf);
    if (!Array.isArray(unpacked)) throw new Error("Invalid payload format");
    const payload = new Payload();

    for (let i = 0; i < unpacked.length; i += 2) {
      const id = unpacked[i];
      const val = unpacked[i + 1];
      if (typeof id !== "number" || (typeof val !== "string" && typeof val !== "number")) {
        throw new Error("Invalid payload entry at index " + i);
      }
      payload.addData(id, val);
    }
    return payload;
  }

  toBuffer(): Uint8Array {
    const flat: (number | string)[] = [];
    for (const [id, val] of this.items) {
      flat.push(id, val);
    }
    return encode(flat);
  }
}

export class MeshPacket {
  static readonly HEADER_OFFSET = 0;
  static readonly HEADER2_OFFSET = 1;
  static readonly MESH_ROUTE_NUM_OFFSET = 2;
  static readonly PATH_LOSS_OFFSET = 3;
  static readonly ROUTING_ID_OFFSET = 4;
  static readonly ROUTING_ID_LENGTH = 16;
  static readonly ENTROPY_OFFSET = MeshPacket.ROUTING_ID_OFFSET + MeshPacket.ROUTING_ID_LENGTH;
  static readonly ENTROPY_LENGTH = 8;
  static readonly TIMESTAMP_OFFSET = MeshPacket.ENTROPY_OFFSET + MeshPacket.ENTROPY_LENGTH;
  static readonly TIMESTAMP_LENGTH = 4;
  static readonly AUTH_TAG_LENGTH = 6;
  static readonly CIPHERTEXT_OFFSET = MeshPacket.TIMESTAMP_OFFSET + MeshPacket.TIMESTAMP_LENGTH;


  static readonly PACKET_TYPE_DATA = 1;
  static readonly PACKET_TYPE_DATA_RELIABLE = 2;
  static readonly PACKET_TYPE_BITMASK = 0b11;

  header: number;
  header2: number;
  meshRouteNum: number;
  pathLoss: number;
  lastHopLoss: number;
  routingID: Uint8Array;
  entropy: Uint8Array;
  timestamp: number;
  authTag: Uint8Array | null;
  ciphertext: Uint8Array | null;
  plaintext: Uint8Array | null;

  constructor(
    header: number,
    header2: number,
    meshRouteNum: number,
    pathLoss: number,
    lastHopLoss: number,
    routingID: Uint8Array,
    entropy: Uint8Array,
    timestamp: number,
    authTag: Uint8Array | null,
    ciphertext: Uint8Array | null,
    plaintext: Uint8Array | null = null
  ) {
    this.header = header;
    this.header2 = header2;
    this.meshRouteNum = meshRouteNum;
    this.pathLoss = pathLoss;
    this.lastHopLoss = lastHopLoss;
    this.routingID = routingID;
    this.entropy = entropy;
    this.timestamp = timestamp;
    this.authTag = authTag;
    this.ciphertext = ciphertext;
    this.plaintext = plaintext;
  }

  static parse(data: Uint8Array): MeshPacket {
    const view = new DataView(data.buffer);

    const header = data[MeshPacket.HEADER_OFFSET];
    const header2 = data[MeshPacket.HEADER2_OFFSET];
    const meshRouteNum = data[MeshPacket.MESH_ROUTE_NUM_OFFSET];
    const pathLossByte = data[MeshPacket.PATH_LOSS_OFFSET];
    const pathLoss = pathLossByte >> 3;
    const lastHopLoss = pathLossByte & 0b111;
    const routingID = data.slice(MeshPacket.ROUTING_ID_OFFSET, MeshPacket.ROUTING_ID_OFFSET + MeshPacket.ROUTING_ID_LENGTH);
    const entropy = data.slice(MeshPacket.ENTROPY_OFFSET, MeshPacket.ENTROPY_OFFSET + MeshPacket.ENTROPY_LENGTH);
    const timestamp = view.getUint32(MeshPacket.TIMESTAMP_OFFSET, true);
    const authTag = data.slice(-MeshPacket.AUTH_TAG_LENGTH, data.length);
    const ciphertext = data.slice(MeshPacket.CIPHERTEXT_OFFSET, data.length - MeshPacket.AUTH_TAG_LENGTH);

    return new MeshPacket(
      header,
      header2,
      meshRouteNum,
      pathLoss,
      lastHopLoss,
      routingID,
      entropy,
      timestamp,
      authTag,
      ciphertext,
      null
    );
  }

  serialize(): Uint8Array {
    if (!this.ciphertext || !this.authTag) {
      throw new Error("Packet is not encrypted");
    }

    const buffer = new Uint8Array(MeshPacket.CIPHERTEXT_OFFSET + this.ciphertext.length + MeshPacket.AUTH_TAG_LENGTH);
    const view = new DataView(buffer.buffer);

    buffer[MeshPacket.HEADER_OFFSET] = this.header;
    buffer[MeshPacket.HEADER2_OFFSET] = this.header2;
    buffer[MeshPacket.MESH_ROUTE_NUM_OFFSET] = this.meshRouteNum;
    buffer[MeshPacket.PATH_LOSS_OFFSET] = (this.pathLoss << 3) | (this.lastHopLoss & 0b111);
    buffer.set(this.routingID, MeshPacket.ROUTING_ID_OFFSET);
    buffer.set(this.entropy, MeshPacket.ENTROPY_OFFSET);
    view.setUint32(MeshPacket.TIMESTAMP_OFFSET, this.timestamp, true);
    buffer.set(this.ciphertext, MeshPacket.CIPHERTEXT_OFFSET);
    buffer.set(this.authTag, buffer.length - MeshPacket.AUTH_TAG_LENGTH);

    return buffer;
  }

  async encrypt(key: Uint8Array): Promise<void> {
    if (!this.plaintext) throw new Error("No plaintext to encrypt");

    const iv = new Uint8Array(12);
    crypto.getRandomValues(iv);
    this.entropy = iv.slice(0, MeshPacket.ENTROPY_LENGTH);
    new DataView(iv.buffer).setUint32(8, this.timestamp, true);

    const cryptoKey = await crypto.subtle.importKey("raw", key, "AES-GCM", false, ["encrypt"]);
    const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv, tagLength: 96 }, cryptoKey, this.plaintext);

    const encryptedBytes = new Uint8Array(encrypted);
    this.ciphertext = encryptedBytes.slice(0, -12);
    this.authTag = encryptedBytes.slice(-12, -6); // 6-byte tag per spec
    this.plaintext = null;
  }

  async decrypt(key: Uint8Array): Promise<void> {
    if (!this.ciphertext || !this.authTag) {
      throw new Error("Missing ciphertext or authTag for decryption");
    }

    const iv = new Uint8Array(12);
    iv.set(this.entropy, 0);
    new DataView(iv.buffer).setUint32(8, this.timestamp, true);

    // We only use the first 4 bytes of the tag
    // because web crypto doesn't support 48 bit tags.
    const combined = new Uint8Array(this.ciphertext.length + 4);
    combined.set(this.ciphertext, 0);
    combined.set(this.authTag.slice(0, 4), this.ciphertext.length); // Rebuild tag for WebCrypto

    const cryptoKey = await crypto.subtle.importKey("raw", key, "AES-GCM", false, ["decrypt"]);

    try {
      const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv, tagLength: 32 }, cryptoKey, combined);
      this.plaintext = new Uint8Array(decrypted);
    } catch (e) {
      throw new Error("Decryption failed: " + (e instanceof Error ? e.message : String(e)));
    }

    this.ciphertext = null;
    this.authTag = null;
  }
} 
