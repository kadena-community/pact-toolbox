import { defineConfig } from "rspress/config";
import { pluginShiki } from "@rspress/plugin-shiki";

export default defineConfig({
  plugins: [
    pluginShiki({
      langs: ["lisp", "mermaid"],
    }),
  ],
  root: "docs",
  title: "Pact Toolbox",
  description:
    "A comprehensive development toolchain for building, testing, and deploying Pact smart contracts on the Kadena blockchain",
  icon: "/favicon.ico",
  // Base path for GitHub Pages deployment
  base: process.env.GITHUB_PAGES ? "/pact-toolbox/" : "/",
  themeConfig: {
    nav: [
      {
        text: "Guide",
        link: "/intro",
      },
      {
        text: "API",
        link: "/api/",
      },
    ],
    socialLinks: [
      {
        icon: "github",
        mode: "link",
        content: "https://github.com/kadena-community/pact-toolbox",
      },
    ],
    sidebar: {
      "/": [
        {
          text: "Introduction",
          link: "/intro",
        },
        {
          text: "Getting Started",
          collapsed: false,
          items: [
            {
              text: "First Project",
              link: "/getting-started/first-project",
            },
          ],
        },
        {
          text: "Environment Setup",
          collapsed: false,
          items: [
            {
              text: "Docker Setup",
              link: "/setup/docker",
            },
            {
              text: "Pactup",
              link: "/setup/pactup",
            },
          ],
        },
        {
          text: "Core Packages",
          collapsed: true,
          items: [
            {
              text: "Overview",
              link: "/packages/",
            },
            {
              text: "CLI",
              link: "/packages/cli",
            },
            {
              text: "Unplugin",
              link: "/packages/unplugin",
            },
            {
              text: "Chainweb Client",
              link: "/packages/chainweb-client",
            },
            {
              text: "Transaction",
              link: "/packages/transaction",
            },
            {
              text: "Test",
              link: "/packages/test",
            },
            {
              text: "Network",
              link: "/packages/network",
            },
            {
              text: "Wallet",
              link: "/packages/wallet",
            },
          ],
        },
      ],
      "/api/": [
        {
          text: "API Reference",
          link: "/api/",
        },
      ],
    },
  },
});
