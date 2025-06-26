<script setup lang="ts">
import "../assets/barrel.css";
import type { MeshNode } from "../mesh/mesh";
import { Payload } from "../mesh/packet";
import { nameToID, idToTypeInfo } from "../mesh/datatypes";
import { MeshChannel } from "../mesh/mesh";
import { ref, onUnmounted } from "vue";
import { username } from "../appState";
import type { Ref } from "vue";

const props = defineProps<{ password: string;  name: string; node: MeshNode }>();
const chatMessages: Ref<Array<string>> = ref([]);

class NodeInfo {
  uid: string;
  dataIds: { [id: number]: string | number };
  constructor(uid: string) {
    this.uid = uid;
    this.dataIds = {
    };

    typeof(nameToID("Unique ID"));
    this.dataIds[nameToID("Unique ID")] = uid;
    this.dataIds[nameToID("Friendly Name")] = "Unknown";
  }
}

const channel = new MeshChannel();
props.node.addChannel(channel);
channel.setPassword(props.password);

const nodes = ref<{ [id: string]: NodeInfo }>({});

channel.setPacketCallback((packet) => {
  // Handle texts specially
  const texts = packet.getDataById(32);
  for (const i of texts) {
    chatMessages.value.push(i.toString());
    if (chatMessages.value.length > 50) {
      chatMessages.value.shift();
    }
  }

  let nodeID: string = "";
  if (packet.getDataById(nameToID("Unique ID"))) {
    nodeID = packet.getDataById(nameToID("Unique ID")).toString();
  }
  if (!nodes.value[nodeID]) {
    nodes.value[nodeID] = new NodeInfo(nodeID);
  }

  const node = nodes.value[nodeID];
  for (const i of packet) {
    if (idToTypeInfo.get(i[0]) && !idToTypeInfo.get(i[0])?.special) {
      node.dataIds[i[0]] = i[1];
    }
  }
});

const text = ref("");
function sendText(msg: string) {
  chatMessages.value.push(username.value+": "+msg);
  const packet = new Payload();
  packet.addData(32, username.value+": "+msg);
  channel.sendPacket(packet, true);
}

onUnmounted(() => {
  // Perform cleanup tasks here
  console.log("Component destroyed");
});
</script>

<template>
  <div class="window">
    <h1>{{ props.name }}</h1>

    <div class="card flex-row">
      <div class="card flex-col w-18rem">
        <h3>Chat</h3>
        <div class="scroll h-12rem border">
          <p v-for="message in chatMessages" class="text-left"
          :class="{'text-right highlight': message.startsWith(username)}"
          ><b>{{ message.split(": ")[0] }}:</b>
            {{ message.indexOf(": ") == -1 ? message : message.split(": ")[1]}}</p>
        </div>

        <input
          type="text"
          class="text-input w-full"
          placeholder="Type your message here"
          v-model="text"
          @keyup.enter="sendText(text)"
        />
        <button type="button" class="button w-full" @click="sendText(text)">
          Send
        </button>
      </div>

      <div class="card flex-col" v-for="node in nodes">
        <div class="scroll max-h-12rem">
          <p v-for="data, id in node.dataIds" class="text-left">
           <b>{{ idToTypeInfo.get(parseInt(id.toString()))?.name }}({{id}}):</b> {{ data }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.read-the-docs {
  color: #888;
}
</style>
