import { ref, computed } from "vue";
import type { Ref } from "vue";

export const username = ref("");

export const channels: Ref<Array<{
  name: string;
  password: string;
}>> = ref([]);

export const state = computed(() => ({
  username: username.value,
  channels: channels.value,
}));
