import type { ITransport } from "./ITransport";
import { AsyncQueue } from "./ITransport";
import { MeshPacket } from "./packet";
import mqtt from "mqtt"; // import namespace "mqtt"

export class MQTTTransport implements ITransport {
  private url: string;

  private topicInterestTimestamps = new Map<string, number>();
  private topicCryptoKeys = new Map<string, Uint8Array>();
  private queue: AsyncQueue<Uint8Array> = new AsyncQueue<Uint8Array>(100);
  private listenerGenerators: { [key: string]: AsyncGenerator<Uint8Array> } =
    {};
  private client: mqtt.MqttClient;

  constructor(url: string) {
    this.url = url;

    this.client = mqtt.connect(this.url, {
      protocolVersion: 4, // MQTT 3.1.1
    });

    this.client.on("connect", () => {
      console.log("Connected to MQTT server");
    });

    this.client.on("message", async (topic, raw) => {
      const message = Uint8Array.from(raw);
      if (this.topicCryptoKeys.has(topic)) {
        const iv = message.slice(0, 12);
        const ciphertext = message.slice(12, message.length);

        const routingID = this.topicCryptoKeys.get(topic)!;

        const cryptoKey = await crypto.subtle.importKey(
          "raw",
          routingID,
          "AES-GCM",
          false,
          ["decrypt"]
        );

        const decrypted1 = await crypto.subtle.decrypt(
          { name: "AES-GCM", iv: iv, tagLength: 32 },
          cryptoKey,
          ciphertext
        );
        const decrypted = new Uint8Array(decrypted1);

        const metaDataLen: number = decrypted[0];

        this.queue.enqueue(decrypted.slice(metaDataLen + 1, decrypted.length));
      }
    });

    this.client.on("error", (error) => {
      console.error("MQTT error:", error);
    });

    this.client.on("reconnect", () => {
      console.log("Reconnecting to MQTT server");
      for (const topic of this.topicInterestTimestamps.keys()) {
        const ts = this.topicInterestTimestamps.get(topic);
        if (ts && ts > Date.now() - 1000 * 60 * 65) {
          this.client.subscribe(topic);
        }
      }
    });

    this.client.on("disconnect", () => {
      console.log("Disconnected from MQTT server");
    });
  }

  async *listen(): AsyncGenerator<Uint8Array | null> {
    yield await this.queue.dequeue();
  }

  async routingIdToHexKey(routingID: Uint8Array): Promise<string> {
    const hash = await crypto.subtle.digest("SHA-256", routingID.slice(0, 16));
    const b20 = new Uint8Array(hash.slice(0, 8));
    const hex = b20.reduce((a, b) => a + b.toString(16).padStart(2, "0"), "");
    return hex;
  }

  async send(data: Uint8Array): Promise<void> {
    const routingID = data.slice(
      MeshPacket.ROUTING_ID_OFFSET,
      MeshPacket.ROUTING_ID_OFFSET + MeshPacket.ROUTING_ID_LENGTH
    );

    // Ignore control packets
    if (data.length < 38) {
      return;
    }

    const pathLossByte = data[MeshPacket.PATH_LOSS_OFFSET];

    const hex = await this.routingIdToHexKey(routingID);
    const topic = `lazymesh_route/${hex}`;

    // Sniff outgoing packets and if they are from us and not repeated
    // not that we have repeaters in JS yet, make a listen connection
    if (pathLossByte == 0) {
      if (!this.topicInterestTimestamps.has(topic)) {
        this.client.subscribe(topic);
      }
      this.topicInterestTimestamps.set(topic, Date.now());
      this.client.subscribe(topic);
    }

    this.topicCryptoKeys.set(topic, routingID);

    const iv = new Uint8Array(12);
    crypto.getRandomValues(iv);

    const cryptoKey2 = await crypto.subtle.importKey(
      "raw",
      routingID,
      "AES-GCM",
      false,
      ["encrypt"]
    );

    // payload has one extra zero byte before it because metadata is unused
    const payload = new Uint8Array(data.length + 1);
    payload[0] = 0;
    payload.set(data, 1);

    const encrypted = new Uint8Array(
      await crypto.subtle.encrypt(
        { name: "AES-GCM", iv, tagLength: 32 },
        cryptoKey2,
        payload
      )
    );
    const encryptedWithTag = new Uint8Array([...iv, ...encrypted]);
    this.client.publish(topic, encryptedWithTag);
  }
}
