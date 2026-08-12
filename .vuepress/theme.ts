import { hopeTheme } from "vuepress-theme-hope";

export default hopeTheme({
  navbar: [
    { text: "首页", link: "/" },
    { text: "学习路线", link: "/学习路线图.html" },
    {
      text: "Java 核心",
      children: [
        { text: "Java 基础", link: "/1-Java基础/" },
        { text: "Java 高级", link: "/2-Java高级/" }
      ]
    },
    {
      text: "框架与中间件",
      children: [{ text: "Java 框架", link: "/3-Java框架/" }]
    },
    {
      text: "架构与性能",
      children: [
        { text: "架构设计", link: "/4-架构设计/" },
        { text: "性能优化", link: "/5-性能优化/" }
      ]
    },
    {
      text: "工程与云原生",
      children: [
        { text: "DevOps 与云原生", link: "/6-DevOps与云原生/" },
        { text: "工程实践", link: "/7-工程实践/" }
      ]
    },
    {
      text: "场景与总结",
      children: [
        { text: "业务场景实践题", link: "/99-业务场景实践题/" },
        { text: "面试与总结", link: "/8-面试与总结/" }
      ]
    },
    { text: "发布规范", link: "/发布与脱敏规则.html" }
  ],
  sidebar: "structure",
  footer: "公开技术学习笔记",
  displayFooter: true,
  darkmode: "switch",
  markdown: {
    gfm: true,
    mark: true,
    plantuml: true,
    tasklist: true
  },
  plugins: {
    slimsearch: {
      indexContent: true
    }
  }
});
