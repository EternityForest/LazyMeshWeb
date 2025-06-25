import type { ITransport } from "./ITransport";
import { MeshPacket } from "./packet";

export class OpenDHT implements ITransport {
  private url: string;
  private listenerGenerators: { [key: string]: AsyncGenerator<Uint8Array> } =
    {};
  constructor(url: string) {
    this.url = url;
  }

  async *listen(): AsyncGenerator<Uint8Array|null> {
      const toDelete: string[] = [];
      for (const gen of Object.keys(this.listenerGenerators)) {
        const res = await this.listenerGenerators[gen].next();
        if (!res.done) {
          yield res.value;
        } else {
          toDelete.push(gen);
        }
      }
      for (const key of toDelete) {
        delete this.listenerGenerators[key];
      }
  }

  async routingIdToHexKey(routingID: Uint8Array): Promise<string> {
    const hash = await crypto.subtle.digest("SHA-256", routingID.slice(0, 16));
    const b20 = new Uint8Array(hash.slice(0, 20));
    const hex = b20.reduce((a, b) => a + b.toString(16).padStart(2, "0"), "");
    return hex;
  }

  async *connnect(routingID: Uint8Array): AsyncGenerator<Uint8Array> {   
    const hex = await this.routingIdToHexKey(routingID);
    const res = await fetch(this.url + "/key/" + hex + "/listen");
    const reader = res.body?.getReader();
    if (!reader) throw new Error("No readable stream");

    let buffer = "";
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");

      while (lines.length > 1) {
        const line = lines.shift()!;
        const json = JSON.parse(line);
        const base64: string = json.data;

        const bin = atob(base64);
        const payload = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) {
          payload[i] = bin.charCodeAt(i);
        }


        const iv = payload.slice(0, 12);
        const tag = payload.slice(payload.length - 4);
        const withoutTag = payload.slice(12, payload.length - 4);
        
        const ciphertext = new Uint8Array([...tag, ...withoutTag]);

        const cryptoKey = await crypto.subtle.importKey(
          "raw",
          routingID,
          "AES-GCM",
          false,
          ["decrypt"]
        );

        const decrypted = new Uint8Array(await crypto.subtle.decrypt(
          { name: "AES-GCM", iv: iv, tagLength: 32 },
          cryptoKey,
          ciphertext
        ));

        const metaDataLen: number = decrypted[0];


        yield decrypted.slice(metaDataLen + 1, decrypted.length-(1+metaDataLen));
      }
      buffer = lines[0];
    }
  }

  async send(data: Uint8Array): Promise<void> {
    const routingID = data.slice(
      MeshPacket.ROUTING_ID_OFFSET,
      MeshPacket.ROUTING_ID_OFFSET + 16
    );

    // Ignore control packets
    if(data.length< 38) {
        return;
    }

    const pathLossByte = data[MeshPacket.PATH_LOSS_OFFSET];
    
    const hex = await this.routingIdToHexKey(routingID);

    // Sniff outgoing packets and if they are from us and not repeated
    // not that we have repeaters in JS yet, make a listen connection
    if(pathLossByte == 0) {
        this.listenerGenerators[routingID.toString()] = this.connnect(routingID);
    }


    const cryptoKey = data.slice(
      MeshPacket.ROUTING_ID_OFFSET,
      MeshPacket.ROUTING_ID_OFFSET + MeshPacket.ROUTING_ID_LENGTH
    );

    const iv = new Uint8Array(12);
    crypto.getRandomValues(iv);

    const cryptoKey2 = await crypto.subtle.importKey(
      "raw",
      cryptoKey,
      "AES-GCM",
      false,
      ["encrypt"]
    );

    // payload has one extra zero byte before it because metadata is unused
    const payload = new Uint8Array(data.length + 1);
    payload[0] = 0;
    payload.set(data, 1);

    const encrypted = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv, tagLength: 32 },
      cryptoKey2,
      payload
    );

    // Put the tag before the ciphertext to match how cpp does it
    const withoutTag = new Uint8Array(encrypted).slice(0, -4);
    const tag = new Uint8Array(encrypted).slice(-4);
    const encryptedWithTag = new Uint8Array([...tag,...withoutTag]);

    await fetch(this.url+"/key/" + hex, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: btoa(String.fromCharCode(...encryptedWithTag)) }),
    });
  }
}
