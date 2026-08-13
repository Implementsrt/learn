<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useData, useRoute, useRouter } from "vuepress/client";

type OpenPage = {
  path: string;
  title: string;
};

const maxTabs = 10;
const storageKey = "java-architecture-learning-open-pages";
const route = useRoute();
const router = useRouter();
const { page } = useData();
const tabs = ref<OpenPage[]>([]);

const isArticlePage = computed(
  () => route.path !== "/" && !route.path.endsWith("/README.html")
);

const persistTabs = () => {
  window.sessionStorage.setItem(storageKey, JSON.stringify(tabs.value));
};

const restoreTabs = () => {
  try {
    const savedTabs = JSON.parse(window.sessionStorage.getItem(storageKey) ?? "[]");

    if (Array.isArray(savedTabs)) {
      tabs.value = savedTabs.filter(
        (item): item is OpenPage =>
          typeof item?.path === "string" && typeof item?.title === "string"
      );
    }
  } catch {
    window.sessionStorage.removeItem(storageKey);
  }
};

const syncCurrentPage = () => {
  if (!isArticlePage.value) {
    return;
  }

  const currentPage = {
    path: route.path,
    title: page.value.title || "未命名页面"
  };
  const existingIndex = tabs.value.findIndex((item) => item.path === currentPage.path);

  if (existingIndex >= 0) {
    tabs.value.splice(existingIndex, 1);
  }

  tabs.value.push(currentPage);

  if (tabs.value.length > maxTabs) {
    tabs.value.splice(0, tabs.value.length - maxTabs);
  }

  persistTabs();
};

const activate = (path: string) => {
  if (path !== route.path) {
    void router.push(path);
  }
};

const close = (path: string) => {
  const closedIndex = tabs.value.findIndex((item) => item.path === path);

  if (closedIndex < 0) {
    return;
  }

  const wasActive = route.path === path;
  tabs.value.splice(closedIndex, 1);
  persistTabs();

  if (wasActive) {
    const fallback = tabs.value[closedIndex] ?? tabs.value[closedIndex - 1];
    void router.push(fallback?.path ?? "/");
  }
};

const clear = () => {
  tabs.value = [];
  persistTabs();
};

onMounted(() => {
  restoreTabs();
  syncCurrentPage();
});

onBeforeUnmount(() => {
  persistTabs();
});

watch(
  () => route.path,
  () => {
    void nextTick(syncCurrentPage);
  }
);
</script>

<template>
  <div v-if="tabs.length > 0" class="open-page-tabs" aria-label="本次打开的页面">
    <div class="open-page-tabs__label">已打开</div>
    <div class="open-page-tabs__list" aria-label="本次打开的页面">
      <div
        v-for="tab in tabs"
        :key="tab.path"
        class="open-page-tabs__tab"
        :class="{ 'is-active': tab.path === route.path }"
      >
        <button
          class="open-page-tabs__activate"
          type="button"
          :aria-current="tab.path === route.path ? 'page' : undefined"
          :title="tab.title"
          @click="activate(tab.path)"
        >
          <span class="open-page-tabs__tab-title">{{ tab.title }}</span>
        </button>
        <button
          class="open-page-tabs__close"
          type="button"
          aria-label="关闭此页面"
          title="关闭"
          @click="close(tab.path)"
        >
          ×
        </button>
      </div>
    </div>
    <button class="open-page-tabs__clear" type="button" title="清空本次打开的页面" @click="clear">
      清空
    </button>
  </div>
</template>
