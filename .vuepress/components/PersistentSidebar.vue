<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vuepress/client";
import { stripOrderPrefix } from "../document-order.js";

type SidebarLink = {
  text: string;
  link: string;
};

type SidebarGroup = {
  text: string;
  link?: string;
  children: SidebarItem[];
};

type SidebarItem = SidebarLink | SidebarGroup;

const props = defineProps<{
  items: SidebarItem[];
}>();

const route = useRoute();
const router = useRouter();
const expandedGroups = ref<Set<string>>(new Set());

const isGroup = (item: SidebarItem): item is SidebarGroup => "children" in item;
// README 标题可能带有与目录名一致的数字前缀，展示时保留正文名称即可。
const folderTitle = stripOrderPrefix;

const matchesRoute = (item: SidebarItem): boolean => {
  if (!isGroup(item)) {
    return route.path === item.link;
  }

  return item.children.some(matchesRoute) || Boolean(item.link && route.path.startsWith(item.link));
};

const groupKey = (parentKey: string, index: number) => `${parentKey}-${index}`;
const hasActiveChild = computed(() => props.items.some(matchesRoute));

const expandActiveBranches = () => {
  const next = new Set(expandedGroups.value);

  const visit = (items: SidebarItem[], parentKey: string) => {
    items.forEach((item, index) => {
      if (!isGroup(item)) {
        return;
      }

      const key = groupKey(parentKey, index);

      if (matchesRoute(item)) {
        next.add(key);
      }

      visit(item.children, key);
    });
  };

  visit(props.items, "root");
  expandedGroups.value = next;
};

const toggleGroup = (key: string) => {
  const next = new Set(expandedGroups.value);

  if (next.has(key)) {
    next.delete(key);
  } else {
    next.add(key);
  }

  expandedGroups.value = next;
};

const navigate = (link?: string) => {
  if (link && link !== route.path) {
    void router.push(link);
  }
};

watch(
  () => route.path,
  expandActiveBranches,
  { immediate: true }
);
</script>

<template>
  <nav class="persistent-sidebar" aria-label="文档目录">
    <div class="persistent-sidebar__caption">
      <span class="persistent-sidebar__caption-icon" aria-hidden="true"></span>
      文档目录
      <span v-if="hasActiveChild" class="persistent-sidebar__caption-state">当前</span>
    </div>
    <ul class="persistent-sidebar__tree">
      <template v-for="(item, index) in items" :key="`${item.text}-${index}`">
        <li v-if="!isGroup(item)" class="persistent-sidebar__file">
          <button
            type="button"
            :class="{ 'is-active': route.path === item.link }"
            @click="navigate(item.link)"
          >
            <span class="persistent-sidebar__file-icon" aria-hidden="true"></span>
            <span>{{ folderTitle(item.text) }}</span>
          </button>
        </li>
        <li v-else class="persistent-sidebar__folder">
          <button
            class="persistent-sidebar__folder-toggle"
            type="button"
            :aria-expanded="expandedGroups.has(groupKey('root', index))"
            @click="toggleGroup(groupKey('root', index))"
          >
            <span
              class="persistent-sidebar__chevron"
              :class="{ 'is-open': expandedGroups.has(groupKey('root', index)) }"
              aria-hidden="true"
            ></span>
            <span class="persistent-sidebar__folder-icon" aria-hidden="true"></span>
            <span>{{ folderTitle(item.text) }}</span>
          </button>
          <ul v-show="expandedGroups.has(groupKey('root', index))" class="persistent-sidebar__children">
            <template v-for="(child, childIndex) in item.children" :key="`${child.text}-${childIndex}`">
              <li v-if="!isGroup(child)" class="persistent-sidebar__file">
                <button
                  type="button"
                  :class="{ 'is-active': route.path === child.link }"
                  @click="navigate(child.link)"
                >
                  <span class="persistent-sidebar__file-icon" aria-hidden="true"></span>
                  <span>{{ folderTitle(child.text) }}</span>
                </button>
              </li>
              <li v-else class="persistent-sidebar__folder persistent-sidebar__folder--nested">
                <button
                  class="persistent-sidebar__folder-toggle"
                  type="button"
                  :aria-expanded="expandedGroups.has(groupKey(groupKey('root', index), childIndex))"
                  @click="toggleGroup(groupKey(groupKey('root', index), childIndex))"
                >
                  <span
                    class="persistent-sidebar__chevron"
                    :class="{
                      'is-open': expandedGroups.has(groupKey(groupKey('root', index), childIndex))
                    }"
                    aria-hidden="true"
                  ></span>
                  <span class="persistent-sidebar__folder-icon" aria-hidden="true"></span>
                  <span>{{ folderTitle(child.text) }}</span>
                </button>
                <ul
                  v-show="expandedGroups.has(groupKey(groupKey('root', index), childIndex))"
                  class="persistent-sidebar__children"
                >
                  <li v-for="(article, articleIndex) in child.children" :key="`${article.text}-${articleIndex}`" class="persistent-sidebar__file">
                    <button
                      v-if="!isGroup(article)"
                      type="button"
                      :class="{ 'is-active': route.path === article.link }"
                      @click="navigate(article.link)"
                    >
                      <span class="persistent-sidebar__file-icon" aria-hidden="true"></span>
                      <span>{{ folderTitle(article.text) }}</span>
                    </button>
                  </li>
                </ul>
              </li>
            </template>
          </ul>
        </li>
      </template>
    </ul>
  </nav>
</template>
