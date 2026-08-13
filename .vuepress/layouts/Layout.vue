<script setup lang="ts">
import { Layout } from "vuepress-theme-hope/client";
import OpenPageTabs from "../components/OpenPageTabs.vue";
import PersistentSidebar from "../components/PersistentSidebar.vue";
</script>

<template>
  <Layout>
    <template #sidebarItems="items">
      <PersistentSidebar :items="items" />
    </template>
    <template #contentBefore>
      <OpenPageTabs />
    </template>
  </Layout>
</template>
