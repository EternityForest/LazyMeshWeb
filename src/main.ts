import { createApp } from 'vue'
import './assets/barrel.css'
import App from './App.vue'


// import { MeshPacket, Payload } from './mesh/packet'
// import { MeshNode, MeshChannel } from './mesh/mesh'
// import { LoopbackTestTransport } from './mesh/ITransport'

// const pl = new Payload()

// pl.addData(68, "test")


// async function test(payload: Payload) {
//     console.log("Payload callback function")
//     console.log(payload.getDataById(68))
// }


// const loopback = new LoopbackTestTransport()

// const node = new MeshNode()
// node.setTransport(loopback)

// const ch1 = new MeshChannel()
// await ch1.setPassword("foo", null);
// node.addChannel(ch1)
// ch1.setPacketCallback(test)

// await ch1.sendPacket(pl)

// async function main() {
//     for await (const _packet of node.run()) {
//         console.log("Received packet")
//     }
// }
// main()

// const p = new MeshPacket(
//     0x00,
//     0x00,
//     0x00,
//     0x00,
//     0x00,
//     new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]),
//     new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]),
//     0x00,
//     null,
//     null,
//     pl.toBuffer()
// )

// await p.encrypt(new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]))
// await p.decrypt(new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]))
// if(!p.plaintext) throw new Error("No plaintext")
// const pl2 = Payload.fromBuffer(p.plaintext)
// for(const [id, val] of pl2) {
//     console.log(id, val)
// }

// console.log(p.plaintext)
createApp(App).mount('#app')
