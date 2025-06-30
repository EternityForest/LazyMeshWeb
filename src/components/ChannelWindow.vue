<script setup lang="ts">
import "../assets/barrel.css";
import type { MeshNode } from "../mesh/mesh";
import type { DataItem } from "../mesh/packet";
import { Payload } from "../mesh/packet";
import { nameToID, idToTypeInfo, dataIds } from "../mesh/datatypes";
import { MeshChannel } from "../mesh/mesh";
import { ref, onUnmounted } from "vue";
import { username } from "../appState";
import type { Ref } from "vue";

const props = defineProps<{ password: string; name: string; node: MeshNode }>();
const chatMessages: Ref<Array<string>> = ref([]);

class NodeInfo {
  uid: number;
  dataIds: { [id: number]: DataItem};
  constructor(uid: number) {
    this.uid = uid;
    this.dataIds = {};

    typeof nameToID("Unique ID");
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

  let nodeID: number = -1;
  if (packet.getDataById(nameToID("Unique ID"))) {
    nodeID = parseInt(packet.getDataById(nameToID("Unique ID")).toString());
  }
  if (!nodes.value[nodeID]) {
    nodes.value[nodeID] = new NodeInfo(nodeID);
  }

  const node = nodes.value[nodeID];
  for (const i of packet) {
    if (!idToTypeInfo.get(i[0])?.special) {
      node.dataIds[i[0]] = i[1];
    }
  }
});

const text = ref("");
const dataIdRequestBox = ref(0);

const setDataTargetNode = ref(0);
const setDataStringValue = ref("");
const setDataIntValue = ref(0);
const setDataId = ref(0);

function setRegister(dataId: number, nodeID: number, value: number|string) {
  const p = new Payload();
  if(nodeID) {
    p.addData(nameToID("Destination Node"), nodeID);
  }
  p.addData(nameToID("Write Command"), 1);
  p.addData(dataId, value);
  channel.sendPacket(p, true);
}

function sendRequest(dataId: number, nodeID: number = 0) {
  const p = new Payload();
  if(nodeID == -1) {
    nodeID = 0;
  }
  if(nodeID) {
    p.addData(nameToID("Destination Node"), nodeID);
  }
  p.addData(nameToID("Data Request"), [dataId]);
  channel.sendPacket(p, true);
}

function sendText(msg: string) {
  chatMessages.value.push(username.value + ": " + msg);
  const packet = new Payload();
  packet.addData(32, username.value + ": " + msg);
  channel.sendPacket(packet, true);
}

onUnmounted(() => {
  // Perform cleanup tasks here
  console.log("Component destroyed");
});
</script>

<template>
  <div class="window flex-col w-36rem">
    <div popover :id="'request-data-' + props.name" class="window flex-col">
      <div class="tool-bar">
        <h2>Request Data From Nodes</h2>
        <button
          type="button"
          popoveraction="close"
          :popovertarget="'request-data-' + props.name"
        >
          Close
        </button>
      </div>
      <div>
        <h2>Request by data ID</h2>
        <input
          type="number"
          v-model="dataIdRequestBox"
        >
        <button
          type="button"
          class="button"
          @click="sendRequest(dataIdRequestBox)"
        >
          Request
        </button>
      </div>
      <template v-for="datatype in dataIds">
        <div v-if="!datatype.special">
          <h3>{{ datatype.name }}</h3>
          <p>{{ datatype.description }}</p>
          <div class="tool-bar">
          <button
            type="button"
            class="button"
            @click="sendRequest(datatype.id)"
          >
            Request
          </button>

          <button
            type="button"
            popoveraction="open"
            :popovertarget="'set-data-' + props.name"
            @click="setDataId = datatype.id"
          >
            Set
          </button>
        </div>
        </div>
      </template>
    </div>

 <div popover :id="'set-data-' + props.name" class="window flex-col">
      <div class="tool-bar">
        <h2>Set Values on Node</h2>
        <button
          type="button"
          popoveraction="close"
          :popovertarget="'request-data-' + props.name"
        >
          Close
        </button>
      </div>
      <div class="stacked-form">
        <label>
          Node ID(0 for all):
          <input
            type="number"
            v-model="setDataTargetNode"
          />
        </label>
        <p class="warning" v-if="setDataTargetNode == 0">
          This will set the value on all nodes in the channel
        </p>


        <label>
          Data ID:
          <input
            type="number"
            v-model="setDataId"
          />
        </label>
        <p>
          {{ dataIds.find((d) => d.id == setDataId)?.name  || "Unknown" }}
        </p>
        <label>
          String Value:
          <input
            type="text"
            v-model="setDataStringValue"
          />
        </label>
        <button type="button" 
        @click="setRegister(setDataId, setDataTargetNode, setDataStringValue)">Set String</button>
        <label>
          Int Value:
          <input
            type="number"
            v-model="setDataIntValue"
          />
        </label>
        <button type="button" 
        @click="setRegister(setDataId, setDataTargetNode, setDataIntValue)">Set Int</button>
      </div>
    </div>

    <h1>{{ props.name }}</h1>
    <div class="tool-bar">
      <button
        type="button"
        class="button"
        popoveraction="open"
        :popovertarget="'request-data-' + props.name"
      >
        Request Data
      </button>
    </div>

    <div class="card flex-row">
      <div class="card flex-col w-18rem">
        <h3>Chat</h3>
        <div class="scroll h-12rem border">
          <p
            v-for="message in chatMessages"
            class="text-left"
            :class="{ 'text-right highlight': message.startsWith(username) }"
          >
            <b>{{ message.split(": ")[0] }}:</b>
            {{ message.indexOf(": ") == -1 ? message : message.split(": ")[1] }}
          </p>
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

      <div class="card flex-col margin" v-for="node in nodes">
        <div class="scroll max-h-12rem w-18rem">
          <div v-for="(data, id) in node.dataIds" class="text-left">
            <b
              >{{ idToTypeInfo.get(parseInt(id.toString()))?.name }}({{
                id
              }}):</b
            >
              </br>
            {{ data }}
            <div class="tool-bar">
            <button type="button" @click="sendRequest(parseInt(id.toString()), node.uid)">Request</button>
            <button type="button" popoveraction="open" :popovertarget="'set-data-' + props.name"
            @click="setDataId = parseInt(id.toString()); setDataTargetNode = node.uid==-1 ? 0 : node.uid || 0"
            >Set</button>
            </div>
            </div>
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
