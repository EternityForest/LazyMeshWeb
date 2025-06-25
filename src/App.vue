<script setup lang="ts">
import ChannelWindow from './components/ChannelWindow.vue'
import { MeshNode } from './mesh/mesh';
import { MQTTTransport } from './mesh/mqtt';
import Sidebar from './components/Sidebar.vue';
import { channels } from './appState';

const node = new MeshNode();
const tr = new MQTTTransport("wss://test.mosquitto.org:8081");

node.setTransport(tr);

async function loop() {
    await node.run();
}

window.setInterval(loop, 100);


</script>

<template>
  <main class="flex-row">
    <Sidebar></Sidebar>
    <ChannelWindow :password="channel.password" :name="channel.name" :node="node" v-for="channel in channels"></ChannelWindow>
  </main>

</template>

<style scoped>
.logo {
  height: 6em;
  padding: 1.5em;
  will-change: filter;
  transition: filter 300ms;
}
.logo:hover {
  filter: drop-shadow(0 0 2em #646cffaa);
}
.logo.vue:hover {
  filter: drop-shadow(0 0 2em #42b883aa);
}
</style>
