import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  base: '/fterm/',
  title: "Fterm",
  description: "A modern, cross-platform terminal application built with Tauri and React.",
  themeConfig: {
    logo: '/logo.png',

    nav: [
      { text: 'Home', link: '/' }
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/TeamTaoist/fterm' }
    ],

    footer: {
      copyright: `Copyright © ${new Date().getFullYear()} TeamTaoist`
    }
  }
})
