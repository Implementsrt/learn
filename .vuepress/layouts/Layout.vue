<script setup lang="ts">
import { onBeforeUnmount, onMounted } from "vue";
import { useRoute, useRouter } from "vuepress/client";
import { Layout } from "vuepress-theme-hope/client";
import OpenPageTabs from "../components/OpenPageTabs.vue";
import PersistentSidebar from "../components/PersistentSidebar.vue";

const route = useRoute();
const router = useRouter();

const handleTocLinkClick = (event: Event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;

  const link = target.closest("#toc .vp-toc-link");
  const hash = link?.getAttribute("href");
  if (!link || !hash?.startsWith("#")) return;

  // Hope 默认会在标题点击时切换大纲；这里保留路由定位，把展开收起交给大纲标题栏。
  event.preventDefault();
  event.stopImmediatePropagation();
  void router.push({ path: route.path, hash });
};

onMounted(() => document.addEventListener("click", handleTocLinkClick, true));
onBeforeUnmount(() => document.removeEventListener("click", handleTocLinkClick, true));
</script>

<template>
  <Layout>
    <template #sidebarItems="items">
      <PersistentSidebar :items="items" />
    </template>
    <template #pageTop>
      <OpenPageTabs />
    </template>
  </Layout>
</template>
