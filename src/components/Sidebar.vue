<template>
  <div class="sidebar w-18rem">
    <h2>Channels</h2>
    <ul>
      <div v-for="(channel, index) in channels" :key="index">
        <h3>{{ channel.name }}</h3>
        <div class="tool-bar">
          <button @click="promptDeleteChannel(channel.name)">Remove</button>
          <button @click="promptRenameChannel(channel.name, index)">
            Rename
          </button>
        </div>
      </div>
    </ul>
    <div class="stacked-form">
      <label
        >Username:
        <input
          v-model="username"
          type="text"
          placeholder="Username"
          @change="saveState"
        />
      </label>
    </div>
    <div class="tool-bar">
      <button @click="importState">Import</button>
      <button @click="exportState">Export</button>
      <button @click="addChannel">Add Channel</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import type { Ref } from "vue";
import { channels, state, username } from "../appState";

onMounted(() => {
  const storedState = localStorage.getItem("userState");
  if (storedState) {
    const parsedState = JSON.parse(storedState);
    username.value = parsedState.username;
    channels.value = parsedState.channels;
  }
});

function saveState() {
  const stateValue = state.value;
  localStorage.setItem("userState", JSON.stringify(stateValue));
}

function importState() {
  const importedState = prompt("Enter JSON state:");
  if (importedState) {
    const parsedState = JSON.parse(importedState);
    username.value = parsedState.username;
    channels.value = parsedState.channels;
    saveState();
  }
}

function exportState() {
  const stateValue = state.value;
  const jsonState = JSON.stringify(stateValue);
  alert(jsonState);
}

function promptDeleteChannel(channel: string) {
  if (confirm(`Delete channel ${channel}?`)) {
    channels.value = channels.value.filter((c) => c.name !== channel);
    saveState();
  }
}

function promptRenameChannel(channel: string, index: number) {
  const newName = prompt("Enter new channel name:");
  if (newName) {
    channels.value[index].name = newName;
    saveState();
  }
}

function addChannel() {
  const newChannel = prompt("Enter channel name:");
  const newPassword = prompt("Enter channel password:");

  if (newChannel && newPassword) {
    // Ensure local name not already in use
    if (channels.value.some((c) => c.name === newChannel)) {
      alert("Channel name already in use");
      return;
    }
    channels.value.push({ name: newChannel, password: newPassword });
    saveState();
  }
}
</script>
