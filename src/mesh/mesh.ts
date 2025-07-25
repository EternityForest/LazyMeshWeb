import type { ITransport } from "./ITransport";
import { MeshPacket, Payload, PacketMetadata } from "./packet";
import { deriveRoutingKey, deriveCryptoKey } from "./crypto";

const areEqual = (first: Uint8Array, second: Uint8Array) =>
  first.length === second.length &&
  first.every((value, index) => value === second[index]);

export class MeshChannel {
  psk: Uint8Array | null = null;
  node: MeshNode | null = null;

  maintainenceTimer: number | null = null;

  tempKeys: {
    routingKey: Uint8Array;
    cryptoKey: Uint8Array;
    nextRoutingKey: Uint8Array;
    nextCryptoKey: Uint8Array;
  } | null = null;

  packetCallback: ((payload: Payload, meta: PacketMetadata) => void) | null =
    null;

  setPacketCallback(
    callback: (payload: Payload, meta: PacketMetadata) => void
  ) {
    this.packetCallback = callback;
  }
  /* Get the routing and crypto keys for this hour, and the next closest hour
    if there's a close one*/

  async getTempKeys() {
    if (!this.psk) {
      throw new Error("No PSK set");
    }
    const ret: {
      routingKey: Uint8Array;
      cryptoKey: Uint8Array;
      nextRoutingKey: Uint8Array;
      nextCryptoKey: Uint8Array;
    } = {
      routingKey: new Uint8Array(16),
      cryptoKey: new Uint8Array(16),
      nextRoutingKey: new Uint8Array(16),
      nextCryptoKey: new Uint8Array(16),
    };

    const unixTime = Date.now() / 1000;
    const hoursSinceEpoch = Math.floor(unixTime / 3600);
    const nexthoursSinceEpoch = Math.floor((unixTime + 600) / 3600);
    const prevhoursSinceEpoch = Math.floor((unixTime - 600) / 3600);

    ret.routingKey = await deriveRoutingKey(this.psk, unixTime);
    ret.cryptoKey = await deriveCryptoKey(this.psk, unixTime);

    if (hoursSinceEpoch != nexthoursSinceEpoch) {
      ret.nextRoutingKey = await deriveRoutingKey(
        this.psk,

        unixTime + 600
      );
      ret.nextCryptoKey = await deriveCryptoKey(this.psk, unixTime + 600);
    } else if (hoursSinceEpoch != prevhoursSinceEpoch) {
      ret.nextRoutingKey = await deriveRoutingKey(this.psk, unixTime - 600);
      ret.nextCryptoKey = await deriveCryptoKey(this.psk, unixTime - 600);
    } else {
      ret.nextRoutingKey = ret.routingKey;
      ret.nextCryptoKey = ret.cryptoKey;
    }

    return ret;
  }

  async handlePacket(rawPacket: Uint8Array) {
    if (!this.tempKeys) {
      this.tempKeys = await this.getTempKeys();
    }

    // We don't currently do control packets, since we only use inherently
    // reliable transports in the TS version
    if (
      (rawPacket[MeshPacket.HEADER_OFFSET] & MeshPacket.PACKET_TYPE_BITMASK) ==
      0
    ) {
      return;
    }

    const p = MeshPacket.parse(rawPacket);
    if (areEqual(p.routingID, this.tempKeys.routingKey)) {
      await p.decrypt(this.tempKeys.cryptoKey);
      if (this.packetCallback) {
        if (!p.plaintext) throw new Error("No plaintext");
        const payload = Payload.fromBuffer(p.plaintext);
        payload.unixTime = p.timestamp;
        const meta = new PacketMetadata();
        this.packetCallback(payload, meta);
      }
    } else if (areEqual(p.routingID, this.tempKeys.nextRoutingKey)) {
      await p.decrypt(this.tempKeys.nextCryptoKey);
      if (this.packetCallback) {
        if (!p.plaintext) throw new Error("No plaintext");
        const payload = Payload.fromBuffer(p.plaintext);
        payload.unixTime = p.timestamp;
        const meta = new PacketMetadata();
        this.packetCallback(payload, meta);
      }
    }
  }

  async sendPacket(payload: Payload, reliable: boolean | null) {
    if (!this.psk) throw new Error("No psk set");
    if (!this.node) throw new Error("No node set");

    const rawPayload = payload.toBuffer();

    const unixTime = Date.now() / 1000;

    const tempRouteKey = await deriveRoutingKey(this.psk, unixTime);
    const tempCryptoKey = await deriveCryptoKey(this.psk, unixTime);

    const entropy = new Uint8Array(8);
    crypto.getRandomValues(entropy);

    let header1 = 0;

    if (reliable) {
      header1 = MeshPacket.PACKET_TYPE_DATA_RELIABLE;
    } else {
      header1 = MeshPacket.PACKET_TYPE_DATA;
    }

    // Outgoing TTL 0
    header1 |= 5 << 2;

    const p = new MeshPacket(
      header1, // h
      0, // h
      0, // routenum
      0, // loss
      0, // hoploss
      tempRouteKey,
      entropy,
      unixTime,
      null,
      null,
      rawPayload
    );

    // If we are sending a packet, it probably means we are interested!
    // Since we don't support repeating.
    
    // Just ignore the other flags since we don't support repeating
    // And we also don't need to support reliable retransmits since
    // this is oretty much just for MQTT an the like.
    p.setHeader2(MeshPacket.HEADER_2_INTERESTED_BIT, true);

    await p.encrypt(tempCryptoKey);

    await this.node?.rawSend(p.serialize());
  }

  async hourlyMaintenance() {
    if (this.psk) {
      this.tempKeys = await this.getTempKeys();
    }
    const p = new Payload();
    this.sendPacket(p, false);
  }

  constructor() {
    const t = this;

    const f = async () => {
      if (t.psk) {
        t.hourlyMaintenance();
      }
    };
    this.maintainenceTimer = window.setInterval(f, 240000);
  }

  destructor() {
    if (this.maintainenceTimer) {
      clearInterval(this.maintainenceTimer);
    }
  }

  async setPassword(password: string) {
    // sha256 hash pasword to get psk
    const encoder = new TextEncoder();
    const p = encoder.encode(password);
    this.psk = new Uint8Array(await crypto.subtle.digest("SHA-256", p)).slice(
      0,
      16
    );

    this.tempKeys = await this.getTempKeys();
  }
}

export class MeshNode {
  transport: ITransport | null = null;
  generator: AsyncGenerator<Uint8Array|null> | null = null;
  channels: Array<MeshChannel> = [];

  // Unix time
  seenPackets: Map<string, number> = new Map();

  constructor() {}

  addChannel(channel: MeshChannel) {
    if (channel.node) throw new Error("Channel already has node");
    this.channels.push(channel);
    channel.node = this;
  }

  removeChannel(channel: MeshChannel) {
    this.channels = this.channels.filter((c) => c !== channel);
    channel.node = null;
  }

  async setTransport(transport: ITransport) {
    this.transport = transport;
    this.generator = transport.listen();
  }

  hasSeenPacket(packet: Uint8Array): boolean {
    const id = packet
      .slice(
        MeshPacket.ENTROPY_OFFSET,
        MeshPacket.ENTROPY_OFFSET + MeshPacket.ENTROPY_LENGTH
      )
      .toString();

    const unixTime = new DataView(packet.buffer).getUint32(
      MeshPacket.TIMESTAMP_OFFSET,
      true
    );

    // reject anything not within 3 mintues
    if (unixTime < ((Date.now() / 1000) - 180)) {
      return true;
    }

    if(this.seenPackets.has(id)) {
      const lastSeen = this.seenPackets.get(id) ?? 0;
      if (lastSeen + 60 > unixTime) {
        return true;
      }
    }

    while(this.seenPackets.size > 1000000) {
      const oldest = this.seenPackets.entries().next().value;
      // Delete if older than 3 minutes
      if (oldest && oldest[1] + 180 < unixTime) {
        this.seenPackets.delete(oldest[0]);
      }
      else {
        break;
      }
    }
    if(this.seenPackets.size > 1000000) {
      console.warn("Too many seen packets");
      return true;
    }

    this.seenPackets.set(id, unixTime);
    return false;
  }

  async rawSend(data: Uint8Array): Promise<void> {
    if (!this.transport) throw new Error("No transport set");
    
    if(this.hasSeenPacket(data)){
      console.debug("Dropping duplicate outgoing packet");
      return;
    }
    await this.transport.send(data);
  }

  async run() {
    if (!this.transport) throw new Error("No transport set");
    const iter = await this.generator?.next();
    if (!iter) {
      return;
    }
    if (iter.done) {
      this.generator = this.transport.listen();
    }
    if (iter.value) {
      if (this.hasSeenPacket(iter.value)) {
        console.debug("Dropping duplicate packet");
        return;
      }
      for (const channel of this.channels) {
        await channel.handlePacket(iter.value);
      }
    }
  }
}
