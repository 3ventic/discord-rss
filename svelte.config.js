import adapter from "@sveltejs/adapter-node";
import { optimizeCarbonImports } from "carbon-preprocess-svelte";
import { sveltePreprocess } from "svelte-preprocess/dist/autoProcess.js";

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// options passed to svelte.compile (https://svelte.dev/docs#compile-time-svelte-compile)
	compilerOptions: {
		enableSourcemap: true,
	},

	// an array of file extensions that should be treated as Svelte components
	extensions: [".svelte"],

	kit: {
		adapter: adapter(),
		alias: {},
		appDir: "_app",
		browser: {
			hydrate: true,
			router: true,
		},
		csp: {
			mode: "auto",
			directives: {
				"default-src": undefined,
				// ...
			},
		},
		moduleExtensions: [".js", ".ts"],
		files: {
			assets: "static",
			hooks: "src/hooks",
			lib: "src/lib",
			params: "src/params",
			routes: "src/routes",
			serviceWorker: "src/service-worker",
			template: "src/app.html",
		},
		inlineStyleThreshold: 0,
		methodOverride: {
			parameter: "_method",
			allowed: [],
		},
		outDir: ".svelte-kit",
		package: {
			dir: "package",
			emitTypes: true,
			// excludes all .d.ts and files starting with _ as the name
			exports: (filepath) => !/^_|\/_|\.d\.ts$/.test(filepath),
			files: () => true,
		},
		paths: {
			assets: "",
			base: "",
		},
		prerender: {
			concurrency: 1,
			crawl: true,
			default: false,
			enabled: true,
			entries: ["*"],
			onError: "fail",
		},
		routes: (filepath) =>
			!/(?:(?:^_|\/_)|(?:^\.|\/\.)(?!well-known))/.test(filepath),
		serviceWorker: {
			register: true,
			files: (filepath) => !/\.DS_Store/.test(filepath),
		},
		trailingSlash: "never",
		version: {
			name: Date.now().toString(),
			pollInterval: 0,
		},
	},

	// options passed to svelte.preprocess (https://svelte.dev/docs#compile-time-svelte-preprocess)
	preprocess: [sveltePreprocess(), optimizeCarbonImports()],
};

export default config;
