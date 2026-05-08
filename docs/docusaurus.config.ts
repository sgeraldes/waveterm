import type { Config } from "@docusaurus/types";
import path from "node:path";
import rehypeHighlight from "rehype-highlight";
import { docOgRenderer } from "./src/renderer/image-renderers";

const baseUrl = process.env.EMBEDDED ? "/docsite/" : "/";
const docsNodeModules = path.resolve(__dirname, "node_modules");

const config: Config = {
    title: "SG Wave Documentation",
    tagline: "A fork-first terminal with graphical widgets, better workflows, and stronger defaults",
    favicon: "img/logo/wave-logo_appicon.svg",

    // Set the production url of your site here
    url: "https://sgeraldes.github.io",
    // Set the /<baseUrl>/ pathname under which your site is served
    // For GitHub pages deployment, it is often '/<projectName>/'
    baseUrl,

    // GitHub pages deployment config.
    // If you aren't using GitHub pages, you don't need these.
    organizationName: "sgeraldes", // Usually your GitHub org/user name.
    projectName: "waveterm", // Usually your repo name.
    deploymentBranch: "main",

    onBrokenAnchors: "ignore",
    onBrokenLinks: "throw",
    markdown: {
        hooks: {
            onBrokenMarkdownLinks: "warn",
        },
    },
    trailingSlash: false,

    // Even if you don't use internationalization, you can use this field to set
    // useful metadata like html lang. For example, if your site is Chinese, you
    // may want to replace "en" with "zh-Hans".
    i18n: {
        defaultLocale: "en",
        locales: ["en"],
    },
    plugins: [
        function docsReactRuntimeAliasPlugin() {
            return {
                name: "docs-react-runtime-alias",
                configureWebpack() {
                    return {
                        resolve: {
                            alias: {
                                react: path.join(docsNodeModules, "react"),
                                "react-dom": path.join(docsNodeModules, "react-dom"),
                                "react/jsx-runtime": path.join(docsNodeModules, "react", "jsx-runtime.js"),
                                "react/jsx-dev-runtime": path.join(docsNodeModules, "react", "jsx-dev-runtime.js"),
                            },
                        },
                    };
                },
            };
        },
        [
            "content-docs",
            {
                path: "docs",
                routeBasePath: "/",
                exclude: ["features/**"],
                editUrl: !process.env.EMBEDDED ? "https://github.com/sgeraldes/waveterm/edit/main/docs/" : undefined,
                rehypePlugins: [rehypeHighlight],
            } as import("@docusaurus/plugin-content-docs").Options,
        ],
        "ideal-image",
        [
            "@docusaurus/plugin-sitemap",
            {
                changefreq: "daily",
                filename: "sitemap.xml",
            },
        ],
        !process.env.EMBEDDED && [
            "@waveterm/docusaurus-og",
            {
                path: "./preview-images", // relative to the build directory
                imageRenderers: {
                    "docusaurus-plugin-content-docs": docOgRenderer,
                },
            },
        ],
        "docusaurus-plugin-sass",
        "@docusaurus/plugin-svgr",
    ].filter((v) => v),
    themes: [
        ["classic", { customCss: "src/css/custom.scss" }],
        !process.env.EMBEDDED && "@docusaurus/theme-search-algolia",
    ].filter((v) => v),
    themeConfig: {
        docs: {
            sidebar: {
                hideable: false,
                autoCollapseCategories: false,
            },
        },
        colorMode: {
            defaultMode: "light",
            disableSwitch: false,
            respectPrefersColorScheme: true,
        },
        navbar: {
            logo: {
                src: "img/logo/wave-light.png",
                srcDark: "img/logo/wave-dark.png",
                href: "https://github.com/sgeraldes/waveterm",
            },
            hideOnScroll: true,
            items: [
                {
                    type: "doc",
                    position: "left",
                    docId: "index",
                    label: "Docs",
                },
                !process.env.EMBEDDED
                    ? [
                          {
                              position: "left",
                              href: "https://github.com/sgeraldes/waveterm/releases",
                              label: "Releases",
                          },
                          {
                              href: "https://github.com/sgeraldes/waveterm",
                              position: "right",
                              className: "header-link-custom custom-icon-github",
                              "aria-label": "GitHub repository",
                          },
                      ]
                    : [],
            ].flat(),
        },
        metadata: [
            {
                name: "keywords",
                content:
                    "terminal, developer, development, command, line, wave, linux, macos, windows, connection, ssh, cli, waveterm, documentation, docs, ai, graphical, widgets, remote, open, source, open-source, go, golang, react, typescript, javascript",
            },
            {
                name: "og:type",
                content: "website",
            },
            {
                name: "og:site_name",
                content: "SG Wave Documentation",
            },
            {
                name: "application-name",
                content: "SG Wave Documentation",
            },
            {
                name: "apple-mobile-web-app-title",
                content: "SG Wave Documentation",
            },
        ],
        footer: {
            copyright: `Copyright © ${new Date().getFullYear()} sgeraldes. Upstream Wave Terminal credited. Built with Docusaurus.`,
        },
        algolia: {
            appId: "B6A8512SN4",
            apiKey: "e879cd8663f109b2822cd004d9cd468c",
            indexName: "waveterm",
        },
    },
    headTags: [
        {
            tagName: "link",
            attributes: {
                rel: "preload",
                as: "font",
                type: "font/woff2",
                "data-next-font": "size-adjust",
                href: `${baseUrl}fontawesome/webfonts/fa-sharp-regular-400.woff2`,
            },
        },
        {
            tagName: "link",
            attributes: {
                rel: "preload",
                as: "font",
                type: "font/woff2",
                "data-next-font": "size-adjust",
                href: `${baseUrl}fontawesome/webfonts/fa-sharp-solid-900.woff2`,
            },
        },
        {
            tagName: "link",
            attributes: {
                rel: "sitemap",
                type: "application/xml",
                title: "Sitemap",
                href: `${baseUrl}sitemap.xml`,
            },
        },
        !process.env.EMBEDDED && {
            tagName: "script",
            attributes: {
                defer: "true",
                "data-domain": "github.com/sgeraldes/waveterm",
                src: "https://plausible.io/js/script.file-downloads.outbound-links.tagged-events.js",
            },
        },
    ].filter((v) => v),
    stylesheets: [
        `${baseUrl}fontawesome/css/fontawesome.min.css`,
        `${baseUrl}fontawesome/css/sharp-regular.min.css`,
        `${baseUrl}fontawesome/css/sharp-solid.min.css`,
    ],
    staticDirectories: ["static", "storybook"],
};

export default config;
