import { onMount, tick } from 'svelte';
import { writable } from 'svelte/store';
import { assets, set_paths } from '../paths.js';
import Root from '__GENERATED__/root.svelte';
import { components, dictionary, matchers } from '__GENERATED__/client-manifest.js';
import { init } from './singletons.js';

/**
 * @param {unknown} err
 * @return {Error}
 */
function coalesce_to_error(err) {
	return err instanceof Error ||
		(err && /** @type {any} */ (err).name && /** @type {any} */ (err).message)
		? /** @type {Error} */ (err)
		: new Error(JSON.stringify(err));
}

/**
 * @param {import('types').LoadOutput} loaded
 * @returns {import('types').NormalizedLoadOutput}
 */
function normalize(loaded) {
	// TODO remove for 1.0
	// @ts-expect-error
	if (loaded.fallthrough) {
		throw new Error(
			'fallthrough is no longer supported. Use matchers instead: https://kit.svelte.dev/docs/routing#advanced-routing-matching'
		);
	}

	// TODO remove for 1.0
	if ('maxage' in loaded) {
		throw new Error('maxage should be replaced with cache: { maxage }');
	}

	const has_error_status =
		loaded.status && loaded.status >= 400 && loaded.status <= 599 && !loaded.redirect;
	if (loaded.error || has_error_status) {
		const status = loaded.status;

		if (!loaded.error && has_error_status) {
			return { status: status || 500, error: new Error() };
		}

		const error = typeof loaded.error === 'string' ? new Error(loaded.error) : loaded.error;

		if (!(error instanceof Error)) {
			return {
				status: 500,
				error: new Error(
					`"error" property returned from load() must be a string or instance of Error, received type "${typeof error}"`
				)
			};
		}

		if (!status || status < 400 || status > 599) {
			console.warn('"error" returned from load() without a valid status code — defaulting to 500');
			return { status: 500, error };
		}

		return { status, error };
	}

	if (loaded.redirect) {
		if (!loaded.status || Math.floor(loaded.status / 100) !== 3) {
			throw new Error(
				'"redirect" property returned from load() must be accompanied by a 3xx status code'
			);
		}

		if (typeof loaded.redirect !== 'string') {
			throw new Error('"redirect" property returned from load() must be a string');
		}
	}

	if (loaded.dependencies) {
		if (
			!Array.isArray(loaded.dependencies) ||
			loaded.dependencies.some((dep) => typeof dep !== 'string')
		) {
			throw new Error('"dependencies" property returned from load() must be of type string[]');
		}
	}

	// TODO remove before 1.0
	if (/** @type {any} */ (loaded).context) {
		throw new Error(
			'You are returning "context" from a load function. ' +
				'"context" was renamed to "stuff", please adjust your code accordingly.'
		);
	}

	return /** @type {import('types').NormalizedLoadOutput} */ (loaded);
}

/**
 * @param {string} path
 * @param {import('types').TrailingSlash} trailing_slash
 */
function normalize_path(path, trailing_slash) {
	if (path === '/' || trailing_slash === 'ignore') return path;

	if (trailing_slash === 'never') {
		return path.endsWith('/') ? path.slice(0, -1) : path;
	} else if (trailing_slash === 'always' && !path.endsWith('/')) {
		return path + '/';
	}

	return path;
}

class LoadURL extends URL {
	/** @returns {string} */
	get hash() {
		throw new Error(
			'url.hash is inaccessible from load. Consider accessing hash from the page store within the script tag of your component.'
		);
	}
}

/** @param {HTMLDocument} doc */
function get_base_uri(doc) {
	let baseURI = doc.baseURI;

	if (!baseURI) {
		const baseTags = doc.getElementsByTagName('base');
		baseURI = baseTags.length ? baseTags[0].href : doc.URL;
	}

	return baseURI;
}

function scroll_state() {
	return {
		x: pageXOffset,
		y: pageYOffset
	};
}

/** @param {Event} event */
function find_anchor(event) {
	const node = event
		.composedPath()
		.find((e) => e instanceof Node && e.nodeName.toUpperCase() === 'A'); // SVG <a> elements have a lowercase name
	return /** @type {HTMLAnchorElement | SVGAElement | undefined} */ (node);
}

/** @param {HTMLAnchorElement | SVGAElement} node */
function get_href(node) {
	return node instanceof SVGAElement
		? new URL(node.href.baseVal, document.baseURI)
		: new URL(node.href);
}

/** @param {any} value */
function notifiable_store(value) {
	const store = writable(value);
	let ready = true;

	function notify() {
		ready = true;
		store.update((val) => val);
	}

	/** @param {any} new_value */
	function set(new_value) {
		ready = false;
		store.set(new_value);
	}

	/** @param {(value: any) => void} run */
	function subscribe(run) {
		/** @type {any} */
		let old_value;
		return store.subscribe((new_value) => {
			if (old_value === undefined || (ready && new_value !== old_value)) {
				run((old_value = new_value));
			}
		});
	}

	return { notify, set, subscribe };
}

function create_updated_store() {
	const { set, subscribe } = writable(false);

	const interval = +(
		/** @type {string} */ (import.meta.env.VITE_SVELTEKIT_APP_VERSION_POLL_INTERVAL)
	);
	const initial = import.meta.env.VITE_SVELTEKIT_APP_VERSION;

	/** @type {NodeJS.Timeout} */
	let timeout;

	async function check() {
		if (import.meta.env.DEV || import.meta.env.SSR) return false;

		clearTimeout(timeout);

		if (interval) timeout = setTimeout(check, interval);

		const file = import.meta.env.VITE_SVELTEKIT_APP_VERSION_FILE;

		const res = await fetch(`${assets}/${file}`, {
			headers: {
				pragma: 'no-cache',
				'cache-control': 'no-cache'
			}
		});

		if (res.ok) {
			const { version } = await res.json();
			const updated = version !== initial;

			if (updated) {
				set(true);
				clearTimeout(timeout);
			}

			return updated;
		} else {
			throw new Error(`Version check failed: ${res.status}`);
		}
	}

	if (interval) timeout = setTimeout(check, interval);

	return {
		subscribe,
		check
	};
}

/**
 * Hash using djb2
 * @param {import('types').StrictBody} value
 */
function hash(value) {
	let hash = 5381;
	let i = value.length;

	if (typeof value === 'string') {
		while (i) hash = (hash * 33) ^ value.charCodeAt(--i);
	} else {
		while (i) hash = (hash * 33) ^ value[--i];
	}

	return (hash >>> 0).toString(36);
}

let loading = 0;

const native_fetch = window.fetch;

function lock_fetch() {
	loading += 1;
}

function unlock_fetch() {
	loading -= 1;
}

if (import.meta.env.DEV) {
	let can_inspect_stack_trace = false;

	const check_stack_trace = async () => {
		const stack = /** @type {string} */ (new Error().stack);
		can_inspect_stack_trace = stack.includes('check_stack_trace');
	};

	check_stack_trace();

	window.fetch = (input, init) => {
		const url = input instanceof Request ? input.url : input.toString();
		const stack = /** @type {string} */ (new Error().stack);

		const heuristic = can_inspect_stack_trace ? stack.includes('load_node') : loading;
		if (heuristic) {
			console.warn(
				`Loading ${url} using \`window.fetch\`. For best results, use the \`fetch\` that is passed to your \`load\` function: https://kit.svelte.dev/docs/loading#input-fetch`
			);
		}

		return native_fetch(input, init);
	};
}

/**
 * @param {RequestInfo} resource
 * @param {RequestInit} [opts]
 */
function initial_fetch(resource, opts) {
	const url = JSON.stringify(typeof resource === 'string' ? resource : resource.url);

	let selector = `script[sveltekit\\:data-type="data"][sveltekit\\:data-url=${url}]`;

	if (opts && typeof opts.body === 'string') {
		selector += `[sveltekit\\:data-body="${hash(opts.body)}"]`;
	}

	const script = document.querySelector(selector);
	if (script && script.textContent) {
		const { body, ...init } = JSON.parse(script.textContent);
		return Promise.resolve(new Response(body, init));
	}

	return native_fetch(resource, opts);
}

const param_pattern = /^(\.\.\.)?(\w+)(?:=(\w+))?$/;

/** @param {string} id */
function parse_route_id(id) {
	/** @type {string[]} */
	const names = [];

	/** @type {string[]} */
	const types = [];

	// `/foo` should get an optional trailing slash, `/foo.json` should not
	// const add_trailing_slash = !/\.[a-z]+$/.test(key);
	let add_trailing_slash = true;

	const pattern =
		id === ''
			? /^\/$/
			: new RegExp(
					`^${decodeURIComponent(id)
						.split(/(?:@[a-zA-Z0-9_-]+)?(?:\/|$)/)
						.map((segment, i, segments) => {
							// special case — /[...rest]/ could contain zero segments
							const match = /^\[\.\.\.(\w+)(?:=(\w+))?\]$/.exec(segment);
							if (match) {
								names.push(match[1]);
								types.push(match[2]);
								return '(?:/(.*))?';
							}

							const is_last = i === segments.length - 1;

							return (
								segment &&
								'/' +
									segment
										.split(/\[(.+?)\]/)
										.map((content, i) => {
											if (i % 2) {
												const [, rest, name, type] = /** @type {RegExpMatchArray} */ (
													param_pattern.exec(content)
												);
												names.push(name);
												types.push(type);
												return rest ? '(.*?)' : '([^/]+?)';
											}

											if (is_last && content.includes('.')) add_trailing_slash = false;

											return (
												content // allow users to specify characters on the file system in an encoded manner
													.normalize()
													// We use [ and ] to denote parameters, so users must encode these on the file
													// system to match against them. We don't decode all characters since others
													// can already be epressed and so that '%' can be easily used directly in filenames
													.replace(/%5[Bb]/g, '[')
													.replace(/%5[Dd]/g, ']')
													// '#', '/', and '?' can only appear in URL path segments in an encoded manner.
													// They will not be touched by decodeURI so need to be encoded here, so
													// that we can match against them.
													// We skip '/' since you can't create a file with it on any OS
													.replace(/#/g, '%23')
													.replace(/\?/g, '%3F')
													// escape characters that have special meaning in regex
													.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
											); // TODO handle encoding
										})
										.join('')
							);
						})
						.join('')}${add_trailing_slash ? '/?' : ''}$`
			  );

	return { pattern, names, types };
}

/**
 * @param {RegExpMatchArray} match
 * @param {string[]} names
 * @param {string[]} types
 * @param {Record<string, import('types').ParamMatcher>} matchers
 */
function exec(match, names, types, matchers) {
	/** @type {Record<string, string>} */
	const params = {};

	for (let i = 0; i < names.length; i += 1) {
		const name = names[i];
		const type = types[i];
		const value = match[i + 1] || '';

		if (type) {
			const matcher = matchers[type];
			if (!matcher) throw new Error(`Missing "${type}" param matcher`); // TODO do this ahead of time?

			if (!matcher(value)) return;
		}

		params[name] = value;
	}

	return params;
}

/**
 * @param {import('types').CSRComponentLoader[]} components
 * @param {Record<string, [number[], number[], 1?]>} dictionary
 * @param {Record<string, (param: string) => boolean>} matchers
 * @returns {import('types').CSRRoute[]}
 */
function parse(components, dictionary, matchers) {
	const routes = Object.entries(dictionary).map(([id, [a, b, has_shadow]]) => {
		const { pattern, names, types } = parse_route_id(id);

		return {
			id,
			/** @param {string} path */
			exec: (path) => {
				const match = pattern.exec(path);
				if (match) return exec(match, names, types, matchers);
			},
			a: a.map((n) => components[n]),
			b: b.map((n) => components[n]),
			has_shadow: !!has_shadow
		};
	});

	return routes;
}

const SCROLL_KEY = 'sveltekit:scroll';
const INDEX_KEY = 'sveltekit:index';

const routes = parse(components, dictionary, matchers);

// we import the root layout/error components eagerly, so that
// connectivity errors after initialisation don't nuke the app
const default_layout = components[0]();
const default_error = components[1]();

const root_stuff = {};

// We track the scroll position associated with each history entry in sessionStorage,
// rather than on history.state itself, because when navigation is driven by
// popstate it's too late to update the scroll position associated with the
// state we're navigating from

/** @typedef {{ x: number, y: number }} ScrollPosition */
/** @type {Record<number, ScrollPosition>} */
let scroll_positions = {};
try {
	scroll_positions = JSON.parse(sessionStorage[SCROLL_KEY]);
} catch {
	// do nothing
}

/** @param {number} index */
function update_scroll_positions(index) {
	scroll_positions[index] = scroll_state();
}

/**
 * @param {{
 *   target: Element;
 *   session: App.Session;
 *   base: string;
 *   trailing_slash: import('types').TrailingSlash;
 * }} opts
 * @returns {import('./types').Client}
 */
function create_client({ target, session, base, trailing_slash }) {
	/** @type {Map<string, import('./types').NavigationResult>} */
	const cache = new Map();

	/** @type {Array<((href: string) => boolean)>} */
	const invalidated = [];

	const stores = {
		url: notifiable_store({}),
		page: notifiable_store({}),
		navigating: writable(/** @type {import('types').Navigation | null} */ (null)),
		session: writable(session),
		updated: create_updated_store()
	};

	/** @type {{id: string | null, promise: Promise<import('./types').NavigationResult | undefined> | null}} */
	const load_cache = {
		id: null,
		promise: null
	};

	const callbacks = {
		/** @type {Array<(opts: { from: URL, to: URL | null, cancel: () => void }) => void>} */
		before_navigate: [],

		/** @type {Array<(opts: { from: URL | null, to: URL }) => void>} */
		after_navigate: []
	};

	/** @type {import('./types').NavigationState} */
	let current = {
		branch: [],
		error: null,
		session_id: 0,
		stuff: root_stuff,
		// @ts-ignore - we need the initial value to be null
		url: null
	};

	let started = false;
	let autoscroll = true;
	let updating = false;
	let session_id = 1;

	/** @type {Promise<void> | null} */
	let invalidating = null;

	/** @type {import('svelte').SvelteComponent} */
	let root;

	/** @type {App.Session} */
	let $session;

	let ready = false;
	stores.session.subscribe(async (value) => {
		$session = value;

		if (!ready) return;
		session_id += 1;

		update(new URL(location.href), [], true);
	});
	ready = true;

	let router_enabled = true;

	// keeping track of the history index in order to prevent popstate navigation events if needed
	let current_history_index = history.state?.[INDEX_KEY];

	if (!current_history_index) {
		// we use Date.now() as an offset so that cross-document navigations
		// within the app don't result in data loss
		current_history_index = Date.now();

		// create initial history entry, so we can return here
		history.replaceState(
			{ ...history.state, [INDEX_KEY]: current_history_index },
			'',
			location.href
		);
	}

	// if we reload the page, or Cmd-Shift-T back to it,
	// recover scroll position
	const scroll = scroll_positions[current_history_index];
	if (scroll) {
		history.scrollRestoration = 'manual';
		scrollTo(scroll.x, scroll.y);
	}

	let hash_navigating = false;

	/** @type {import('types').Page} */
	let page;

	/** @type {{}} */
	let token;

	/**
	 * @param {string | URL} url
	 * @param {{ noscroll?: boolean; replaceState?: boolean; keepfocus?: boolean; state?: any }} opts
	 * @param {string[]} redirect_chain
	 */
	async function goto(
		url,
		{ noscroll = false, replaceState = false, keepfocus = false, state = {} },
		redirect_chain
	) {
		if (typeof url === 'string') {
			url = new URL(url, get_base_uri(document));
		}

		if (router_enabled) {
			return navigate({
				url,
				scroll: noscroll ? scroll_state() : null,
				keepfocus,
				redirect_chain,
				details: {
					state,
					replaceState
				},
				accepted: () => {},
				blocked: () => {}
			});
		}

		await native_navigation(url);
	}

	/** @param {URL} url */
	async function prefetch(url) {
		const intent = get_navigation_intent(url);

		if (!intent) {
			throw new Error('Attempted to prefetch a URL that does not belong to this app');
		}

		load_cache.promise = load_route(intent, false);
		load_cache.id = intent.id;

		return load_cache.promise;
	}

	/**
	 * Returns `true` if update completes, `false` if it is aborted
	 * @param {URL} url
	 * @param {string[]} redirect_chain
	 * @param {boolean} no_cache
	 * @param {{hash?: string, scroll: { x: number, y: number } | null, keepfocus: boolean, details: { replaceState: boolean, state: any } | null}} [opts]
	 * @param {() => void} [callback]
	 */
	async function update(url, redirect_chain, no_cache, opts, callback) {
		const intent = get_navigation_intent(url);

		const current_token = (token = {});
		let navigation_result = intent && (await load_route(intent, no_cache));

		if (
			!navigation_result &&
			url.origin === location.origin &&
			url.pathname === location.pathname
		) {
			// this could happen in SPA fallback mode if the user navigated to
			// `/non-existent-page`. if we fall back to reloading the page, it
			// will create an infinite loop. so whereas we normally handle
			// unknown routes by going to the server, in this special case
			// we render a client-side error page instead
			navigation_result = await load_root_error_page({
				status: 404,
				error: new Error(`Not found: ${url.pathname}`),
				url,
				routeId: null
			});
		}

		if (!navigation_result) {
			await native_navigation(url);
			return false; // unnecessary, but TypeScript prefers it this way
		}

		// abort if user navigated during update
		if (token !== current_token) return false;

		invalidated.length = 0;

		if (navigation_result.redirect) {
			if (redirect_chain.length > 10 || redirect_chain.includes(url.pathname)) {
				navigation_result = await load_root_error_page({
					status: 500,
					error: new Error('Redirect loop'),
					url,
					routeId: null
				});
			} else {
				if (router_enabled) {
					goto(new URL(navigation_result.redirect, url).href, {}, [
						...redirect_chain,
						url.pathname
					]);
				} else {
					await native_navigation(new URL(navigation_result.redirect, location.href));
				}

				return false;
			}
		} else if (navigation_result.props?.page?.status >= 400) {
			const updated = await stores.updated.check();
			if (updated) {
				await native_navigation(url);
			}
		}

		updating = true;

		if (opts && opts.details) {
			const { details } = opts;
			const change = details.replaceState ? 0 : 1;
			details.state[INDEX_KEY] = current_history_index += change;
			history[details.replaceState ? 'replaceState' : 'pushState'](details.state, '', url);
		}

		if (started) {
			current = navigation_result.state;

			if (navigation_result.props.page) {
				navigation_result.props.page.url = url;
			}

			root.$set(navigation_result.props);
		} else {
			initialize(navigation_result);
		}

		// opts must be passed if we're navigating
		if (opts) {
			const { scroll, keepfocus } = opts;

			if (!keepfocus) {
				// Reset page selection and focus
				// We try to mimic browsers' behaviour as closely as possible by targeting the
				// first scrollable region, but unfortunately it's not a perfect match — e.g.
				// shift-tabbing won't immediately cycle up from the end of the page on Chromium
				// See https://html.spec.whatwg.org/multipage/interaction.html#get-the-focusable-area
				const root = document.body;
				const tabindex = root.getAttribute('tabindex');

				getSelection()?.removeAllRanges();
				root.tabIndex = -1;
				root.focus({ preventScroll: true });

				// restore `tabindex` as to prevent `root` from stealing input from elements
				if (tabindex !== null) {
					root.setAttribute('tabindex', tabindex);
				} else {
					root.removeAttribute('tabindex');
				}
			}

			// need to render the DOM before we can scroll to the rendered elements
			await tick();

			if (autoscroll) {
				const deep_linked = url.hash && document.getElementById(url.hash.slice(1));
				if (scroll) {
					scrollTo(scroll.x, scroll.y);
				} else if (deep_linked) {
					// Here we use `scrollIntoView` on the element instead of `scrollTo`
					// because it natively supports the `scroll-margin` and `scroll-behavior`
					// CSS properties.
					deep_linked.scrollIntoView();
				} else {
					scrollTo(0, 0);
				}
			}
		} else {
			// in this case we're simply invalidating
			await tick();
		}

		load_cache.promise = null;
		load_cache.id = null;
		autoscroll = true;

		if (navigation_result.props.page) {
			page = navigation_result.props.page;
		}

		const leaf_node = navigation_result.state.branch[navigation_result.state.branch.length - 1];
		router_enabled = leaf_node?.module.router !== false;

		if (callback) callback();

		updating = false;
	}

	/** @param {import('./types').NavigationResult} result */
	function initialize(result) {
		current = result.state;

		const style = document.querySelector('style[data-sveltekit]');
		if (style) style.remove();

		page = result.props.page;

		root = new Root({
			target,
			props: { ...result.props, stores },
			hydrate: true
		});

		if (router_enabled) {
			const navigation = { from: null, to: new URL(location.href) };
			callbacks.after_navigate.forEach((fn) => fn(navigation));
		}

		started = true;
	}

	/**
	 *
	 * @param {{
	 *   url: URL;
	 *   params: Record<string, string>;
	 *   stuff: Record<string, any>;
	 *   branch: Array<import('./types').BranchNode | undefined>;
	 *   status: number;
	 *   error: Error | null;
	 *   routeId: string | null;
	 * }} opts
	 */
	async function get_navigation_result_from_branch({
		url,
		params,
		stuff,
		branch,
		status,
		error,
		routeId
	}) {
		const filtered = /** @type {import('./types').BranchNode[] } */ (branch.filter(Boolean));
		const redirect = filtered.find((f) => f.loaded?.redirect);

		/** @type {import('./types').NavigationResult} */
		const result = {
			redirect: redirect?.loaded?.redirect,
			state: {
				url,
				params,
				branch,
				error,
				stuff,
				session_id
			},
			props: {
				components: filtered.map((node) => node.module.default)
			}
		};

		for (let i = 0; i < filtered.length; i += 1) {
			const loaded = filtered[i].loaded;
			result.props[`props_${i}`] = loaded ? await loaded.props : null;
		}

		const page_changed =
			!current.url ||
			url.href !== current.url.href ||
			current.error !== error ||
			current.stuff !== stuff;

		if (page_changed) {
			result.props.page = { error, params, routeId, status, stuff, url };

			// TODO remove this for 1.0
			/**
			 * @param {string} property
			 * @param {string} replacement
			 */
			const print_error = (property, replacement) => {
				Object.defineProperty(result.props.page, property, {
					get: () => {
						throw new Error(`$page.${property} has been replaced by $page.url.${replacement}`);
					}
				});
			};

			print_error('origin', 'origin');
			print_error('path', 'pathname');
			print_error('query', 'searchParams');
		}

		const leaf = filtered[filtered.length - 1];
		const load_cache = leaf?.loaded?.cache;

		if (load_cache) {
			const key = url.pathname + url.search; // omit hash
			let ready = false;

			const clear = () => {
				if (cache.get(key) === result) {
					cache.delete(key);
				}

				unsubscribe();
				clearTimeout(timeout);
			};

			const timeout = setTimeout(clear, load_cache.maxage * 1000);

			const unsubscribe = stores.session.subscribe(() => {
				if (ready) clear();
			});

			ready = true;

			cache.set(key, result);
		}

		return result;
	}

	/**
	 * @param {{
	 *   status?: number;
	 *   error?: Error;
	 *   module: import('types').CSRComponent;
	 *   url: URL;
	 *   params: Record<string, string>;
	 *   stuff: Record<string, any>;
	 *   props?: Record<string, any>;
	 *   routeId: string | null;
	 * }} options
	 */
	async function load_node({ status, error, module, url, params, stuff, props, routeId }) {
		/** @type {import('./types').BranchNode} */
		const node = {
			module,
			uses: {
				params: new Set(),
				url: false,
				session: false,
				stuff: false,
				dependencies: new Set()
			},
			loaded: null,
			stuff
		};

		/** @param dep {string} */
		function add_dependency(dep) {
			const { href } = new URL(dep, url);
			node.uses.dependencies.add(href);
		}

		if (props) {
			// shadow endpoint props means we need to mark this URL as a dependency of itself
			node.uses.dependencies.add(url.href);
		}

		/** @type {Record<string, string>} */
		const uses_params = {};
		for (const key in params) {
			Object.defineProperty(uses_params, key, {
				get() {
					node.uses.params.add(key);
					return params[key];
				},
				enumerable: true
			});
		}

		const session = $session;
		const load_url = new LoadURL(url);

		if (module.load) {
			/** @type {import('types').LoadEvent} */
			const load_input = {
				routeId,
				params: uses_params,
				props: props || {},
				get url() {
					node.uses.url = true;
					return load_url;
				},
				get session() {
					node.uses.session = true;
					return session;
				},
				get stuff() {
					node.uses.stuff = true;
					return { ...stuff };
				},
				async fetch(resource, init) {
					let requested;

					if (typeof resource === 'string') {
						requested = resource;
					} else {
						requested = resource.url;

						// we're not allowed to modify the received `Request` object, so in order
						// to fixup relative urls we create a new equivalent `init` object instead
						init = {
							// the request body must be consumed in memory until browsers
							// implement streaming request bodies and/or the body getter
							body:
								resource.method === 'GET' || resource.method === 'HEAD'
									? undefined
									: await resource.blob(),
							cache: resource.cache,
							credentials: resource.credentials,
							headers: resource.headers,
							integrity: resource.integrity,
							keepalive: resource.keepalive,
							method: resource.method,
							mode: resource.mode,
							redirect: resource.redirect,
							referrer: resource.referrer,
							referrerPolicy: resource.referrerPolicy,
							signal: resource.signal,
							...init
						};
					}

					// we must fixup relative urls so they are resolved from the target page
					const normalized = new URL(requested, url).href;
					add_dependency(normalized);

					// prerendered pages may be served from any origin, so `initial_fetch` urls shouldn't be normalized
					return started ? native_fetch(normalized, init) : initial_fetch(requested, init);
				},
				status: status ?? null,
				error: error ?? null
			};

			if (import.meta.env.DEV) {
				// TODO remove this for 1.0
				Object.defineProperty(load_input, 'page', {
					get: () => {
						throw new Error('`page` in `load` functions has been replaced by `url` and `params`');
					}
				});
			}

			let loaded;

			if (import.meta.env.DEV) {
				try {
					lock_fetch();
					loaded = await module.load.call(null, load_input);
				} finally {
					unlock_fetch();
				}
			} else {
				loaded = await module.load.call(null, load_input);
			}

			if (!loaded) {
				throw new Error('load function must return a value');
			}

			node.loaded = normalize(loaded);
			if (node.loaded.stuff) node.stuff = node.loaded.stuff;
			if (node.loaded.dependencies) {
				node.loaded.dependencies.forEach(add_dependency);
			}
		} else if (props) {
			node.loaded = normalize({ props });
		}

		return node;
	}

	/**
	 * @param {import('./types').NavigationIntent} intent
	 * @param {boolean} no_cache
	 */
	async function load_route({ id, url, params, route }, no_cache) {
		if (load_cache.id === id && load_cache.promise) {
			return load_cache.promise;
		}

		if (!no_cache) {
			const cached = cache.get(id);
			if (cached) return cached;
		}

		const { a, b, has_shadow } = route;

		const changed = current.url && {
			url: id !== current.url.pathname + current.url.search,
			params: Object.keys(params).filter((key) => current.params[key] !== params[key]),
			session: session_id !== current.session_id
		};

		/** @type {Array<import('./types').BranchNode | undefined>} */
		let branch = [];

		/** @type {Record<string, any>} */
		let stuff = root_stuff;
		let stuff_changed = false;

		/** @type {number | undefined} */
		let status = 200;

		/** @type {Error | null} */
		let error = null;

		// preload modules to avoid waterfall, but handle rejections
		// so they don't get reported to Sentry et al (we don't need
		// to act on the failures at this point)
		a.forEach((loader) => loader().catch(() => {}));

		load: for (let i = 0; i < a.length; i += 1) {
			/** @type {import('./types').BranchNode | undefined} */
			let node;

			try {
				if (!a[i]) continue;

				const module = await a[i]();
				const previous = current.branch[i];

				const changed_since_last_render =
					!previous ||
					module !== previous.module ||
					(changed.url && previous.uses.url) ||
					changed.params.some((param) => previous.uses.params.has(param)) ||
					(changed.session && previous.uses.session) ||
					Array.from(previous.uses.dependencies).some((dep) => invalidated.some((fn) => fn(dep))) ||
					(stuff_changed && previous.uses.stuff);

				if (changed_since_last_render) {
					/** @type {Record<string, any>} */
					let props = {};

					const is_shadow_page = has_shadow && i === a.length - 1;

					if (is_shadow_page) {
						const res = await native_fetch(
							`${url.pathname}${url.pathname.endsWith('/') ? '' : '/'}__data.json${url.search}`,
							{
								headers: {
									'x-sveltekit-load': 'true'
								}
							}
						);

						if (res.ok) {
							const redirect = res.headers.get('x-sveltekit-location');

							if (redirect) {
								return {
									redirect,
									props: {},
									state: current
								};
							}

							props = res.status === 204 ? {} : await res.json();
						} else {
							status = res.status;
							error = new Error('Failed to load data');
						}
					}

					if (!error) {
						node = await load_node({
							module,
							url,
							params,
							props,
							stuff,
							routeId: route.id
						});
					}

					if (node) {
						if (is_shadow_page) {
							node.uses.url = true;
						}

						if (node.loaded) {
							if (node.loaded.error) {
								status = node.loaded.status;
								error = node.loaded.error;
							}

							if (node.loaded.redirect) {
								return {
									redirect: node.loaded.redirect,
									props: {},
									state: current
								};
							}

							if (node.loaded.stuff) {
								stuff_changed = true;
							}
						}
					}
				} else {
					node = previous;
				}
			} catch (e) {
				status = 500;
				error = coalesce_to_error(e);
			}

			if (error) {
				while (i--) {
					if (b[i]) {
						let error_loaded;

						/** @type {import('./types').BranchNode | undefined} */
						let node_loaded;
						let j = i;
						while (!(node_loaded = branch[j])) {
							j -= 1;
						}

						try {
							error_loaded = await load_node({
								status,
								error,
								module: await b[i](),
								url,
								params,
								stuff: node_loaded.stuff,
								routeId: route.id
							});

							if (error_loaded?.loaded?.error) {
								continue;
							}

							if (error_loaded?.loaded?.stuff) {
								stuff = {
									...stuff,
									...error_loaded.loaded.stuff
								};
							}

							branch = branch.slice(0, j + 1).concat(error_loaded);
							break load;
						} catch (e) {
							continue;
						}
					}
				}

				return await load_root_error_page({
					status,
					error,
					url,
					routeId: route.id
				});
			} else {
				if (node?.loaded?.stuff) {
					stuff = {
						...stuff,
						...node.loaded.stuff
					};
				}

				branch.push(node);
			}
		}

		return await get_navigation_result_from_branch({
			url,
			params,
			stuff,
			branch,
			status,
			error,
			routeId: route.id
		});
	}

	/**
	 * @param {{
	 *   status: number;
	 *   error: Error;
	 *   url: URL;
	 *   routeId: string | null
	 * }} opts
	 */
	async function load_root_error_page({ status, error, url, routeId }) {
		/** @type {Record<string, string>} */
		const params = {}; // error page does not have params

		const root_layout = await load_node({
			module: await default_layout,
			url,
			params,
			stuff: {},
			routeId
		});

		const root_error = await load_node({
			status,
			error,
			module: await default_error,
			url,
			params,
			stuff: (root_layout && root_layout.loaded && root_layout.loaded.stuff) || {},
			routeId
		});

		return await get_navigation_result_from_branch({
			url,
			params,
			stuff: {
				...root_layout?.loaded?.stuff,
				...root_error?.loaded?.stuff
			},
			branch: [root_layout, root_error],
			status,
			error,
			routeId
		});
	}

	/** @param {URL} url */
	function get_navigation_intent(url) {
		if (url.origin !== location.origin || !url.pathname.startsWith(base)) return;

		const path = decodeURI(url.pathname.slice(base.length) || '/');

		for (const route of routes) {
			const params = route.exec(path);

			if (params) {
				/** @type {import('./types').NavigationIntent} */
				const intent = {
					id: url.pathname + url.search,
					route,
					params,
					url
				};

				return intent;
			}
		}
	}

	/**
	 * @param {{
	 *   url: URL;
	 *   scroll: { x: number, y: number } | null;
	 *   keepfocus: boolean;
	 *   redirect_chain: string[];
	 *   details: {
	 *     replaceState: boolean;
	 *     state: any;
	 *   } | null;
	 *   accepted: () => void;
	 *   blocked: () => void;
	 * }} opts
	 */
	async function navigate({ url, scroll, keepfocus, redirect_chain, details, accepted, blocked }) {
		const from = current.url;
		let should_block = false;

		const navigation = {
			from,
			to: url,
			cancel: () => (should_block = true)
		};

		callbacks.before_navigate.forEach((fn) => fn(navigation));

		if (should_block) {
			blocked();
			return;
		}

		const pathname = normalize_path(url.pathname, trailing_slash);
		const normalized = new URL(url.origin + pathname + url.search + url.hash);

		update_scroll_positions(current_history_index);

		accepted();

		if (started) {
			stores.navigating.set({
				from: current.url,
				to: normalized
			});
		}

		await update(
			normalized,
			redirect_chain,
			false,
			{
				scroll,
				keepfocus,
				details
			},
			() => {
				const navigation = { from, to: normalized };
				callbacks.after_navigate.forEach((fn) => fn(navigation));

				stores.navigating.set(null);
			}
		);
	}

	/**
	 * Loads `href` the old-fashioned way, with a full page reload.
	 * Returns a `Promise` that never resolves (to prevent any
	 * subsequent work, e.g. history manipulation, from happening)
	 * @param {URL} url
	 */
	function native_navigation(url) {
		location.href = url.href;
		return new Promise(() => {});
	}

	if (import.meta.hot) {
		import.meta.hot.on('vite:beforeUpdate', () => {
			if (current.error) location.reload();
		});
	}

	return {
		after_navigate: (fn) => {
			onMount(() => {
				callbacks.after_navigate.push(fn);

				return () => {
					const i = callbacks.after_navigate.indexOf(fn);
					callbacks.after_navigate.splice(i, 1);
				};
			});
		},

		before_navigate: (fn) => {
			onMount(() => {
				callbacks.before_navigate.push(fn);

				return () => {
					const i = callbacks.before_navigate.indexOf(fn);
					callbacks.before_navigate.splice(i, 1);
				};
			});
		},

		disable_scroll_handling: () => {
			if (import.meta.env.DEV && started && !updating) {
				throw new Error('Can only disable scroll handling during navigation');
			}

			if (updating || !started) {
				autoscroll = false;
			}
		},

		goto: (href, opts = {}) => goto(href, opts, []),

		invalidate: (resource) => {
			if (typeof resource === 'function') {
				invalidated.push(resource);
			} else {
				const { href } = new URL(resource, location.href);
				invalidated.push((dep) => dep === href);
			}

			if (!invalidating) {
				invalidating = Promise.resolve().then(async () => {
					await update(new URL(location.href), [], true);

					invalidating = null;
				});
			}

			return invalidating;
		},

		prefetch: async (href) => {
			const url = new URL(href, get_base_uri(document));
			await prefetch(url);
		},

		// TODO rethink this API
		prefetch_routes: async (pathnames) => {
			const matching = pathnames
				? routes.filter((route) => pathnames.some((pathname) => route.exec(pathname)))
				: routes;

			const promises = matching.map((r) => Promise.all(r.a.map((load) => load())));

			await Promise.all(promises);
		},

		_start_router: () => {
			history.scrollRestoration = 'manual';

			// Adopted from Nuxt.js
			// Reset scrollRestoration to auto when leaving page, allowing page reload
			// and back-navigation from other pages to use the browser to restore the
			// scrolling position.
			addEventListener('beforeunload', (e) => {
				let should_block = false;

				const navigation = {
					from: current.url,
					to: null,
					cancel: () => (should_block = true)
				};

				callbacks.before_navigate.forEach((fn) => fn(navigation));

				if (should_block) {
					e.preventDefault();
					e.returnValue = '';
				} else {
					history.scrollRestoration = 'auto';
				}
			});

			addEventListener('visibilitychange', () => {
				if (document.visibilityState === 'hidden') {
					update_scroll_positions(current_history_index);

					try {
						sessionStorage[SCROLL_KEY] = JSON.stringify(scroll_positions);
					} catch {
						// do nothing
					}
				}
			});

			/** @param {Event} event */
			const trigger_prefetch = (event) => {
				const a = find_anchor(event);
				if (a && a.href && a.hasAttribute('sveltekit:prefetch')) {
					prefetch(get_href(a));
				}
			};

			/** @type {NodeJS.Timeout} */
			let mousemove_timeout;

			/** @param {MouseEvent|TouchEvent} event */
			const handle_mousemove = (event) => {
				clearTimeout(mousemove_timeout);
				mousemove_timeout = setTimeout(() => {
					// event.composedPath(), which is used in find_anchor, will be empty if the event is read in a timeout
					// add a layer of indirection to address that
					event.target?.dispatchEvent(
						new CustomEvent('sveltekit:trigger_prefetch', { bubbles: true })
					);
				}, 20);
			};

			addEventListener('touchstart', trigger_prefetch);
			addEventListener('mousemove', handle_mousemove);
			addEventListener('sveltekit:trigger_prefetch', trigger_prefetch);

			/** @param {MouseEvent} event */
			addEventListener('click', (event) => {
				if (!router_enabled) return;

				// Adapted from https://github.com/visionmedia/page.js
				// MIT license https://github.com/visionmedia/page.js#license
				if (event.button || event.which !== 1) return;
				if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
				if (event.defaultPrevented) return;

				const a = find_anchor(event);
				if (!a) return;

				if (!a.href) return;

				const is_svg_a_element = a instanceof SVGAElement;
				const url = get_href(a);

				// Ignore if url does not have origin (e.g. `mailto:`, `tel:`.)
				// MEMO: Without this condition, firefox will open mailer twice.
				// See: https://github.com/sveltejs/kit/issues/4045
				if (!is_svg_a_element && url.origin === 'null') return;

				// Ignore if tag has
				// 1. 'download' attribute
				// 2. 'rel' attribute includes external
				const rel = (a.getAttribute('rel') || '').split(/\s+/);

				if (
					a.hasAttribute('download') ||
					rel.includes('external') ||
					a.hasAttribute('sveltekit:reload')
				) {
					return;
				}

				// Ignore if <a> has a target
				if (is_svg_a_element ? a.target.baseVal : a.target) return;

				// Check if new url only differs by hash and use the browser default behavior in that case
				// This will ensure the `hashchange` event is fired
				// Removing the hash does a full page navigation in the browser, so make sure a hash is present
				const [base, hash] = url.href.split('#');
				if (hash !== undefined && base === location.href.split('#')[0]) {
					// set this flag to distinguish between navigations triggered by
					// clicking a hash link and those triggered by popstate
					hash_navigating = true;

					update_scroll_positions(current_history_index);

					stores.page.set({ ...page, url });
					stores.page.notify();

					return;
				}

				navigate({
					url,
					scroll: a.hasAttribute('sveltekit:noscroll') ? scroll_state() : null,
					keepfocus: false,
					redirect_chain: [],
					details: {
						state: {},
						replaceState: url.href === location.href
					},
					accepted: () => event.preventDefault(),
					blocked: () => event.preventDefault()
				});
			});

			addEventListener('popstate', (event) => {
				if (event.state && router_enabled) {
					// if a popstate-driven navigation is cancelled, we need to counteract it
					// with history.go, which means we end up back here, hence this check
					if (event.state[INDEX_KEY] === current_history_index) return;

					navigate({
						url: new URL(location.href),
						scroll: scroll_positions[event.state[INDEX_KEY]],
						keepfocus: false,
						redirect_chain: [],
						details: null,
						accepted: () => {
							current_history_index = event.state[INDEX_KEY];
						},
						blocked: () => {
							const delta = current_history_index - event.state[INDEX_KEY];
							history.go(delta);
						}
					});
				}
			});

			addEventListener('hashchange', () => {
				// if the hashchange happened as a result of clicking on a link,
				// we need to update history, otherwise we have to leave it alone
				if (hash_navigating) {
					hash_navigating = false;
					history.replaceState(
						{ ...history.state, [INDEX_KEY]: ++current_history_index },
						'',
						location.href
					);
				}
			});
		},

		_hydrate: async ({ status, error, nodes, params, routeId }) => {
			const url = new URL(location.href);

			/** @type {Array<import('./types').BranchNode | undefined>} */
			const branch = [];

			/** @type {Record<string, any>} */
			let stuff = {};

			/** @type {import('./types').NavigationResult | undefined} */
			let result;

			let error_args;

			try {
				for (let i = 0; i < nodes.length; i += 1) {
					const is_leaf = i === nodes.length - 1;

					let props;

					if (is_leaf) {
						const serialized = document.querySelector('script[sveltekit\\:data-type="props"]');
						if (serialized) {
							props = JSON.parse(/** @type {string} */ (serialized.textContent));
						}
					}

					const node = await load_node({
						module: await components[nodes[i]](),
						url,
						params,
						stuff,
						status: is_leaf ? status : undefined,
						error: is_leaf ? error : undefined,
						props,
						routeId
					});

					if (props) {
						node.uses.dependencies.add(url.href);
						node.uses.url = true;
					}

					branch.push(node);

					if (node && node.loaded) {
						if (node.loaded.error) {
							if (error) throw node.loaded.error;
							error_args = {
								status: node.loaded.status,
								error: node.loaded.error,
								url,
								routeId
							};
						} else if (node.loaded.stuff) {
							stuff = {
								...stuff,
								...node.loaded.stuff
							};
						}
					}
				}

				result = error_args
					? await load_root_error_page(error_args)
					: await get_navigation_result_from_branch({
							url,
							params,
							stuff,
							branch,
							status,
							error,
							routeId
					  });
			} catch (e) {
				if (error) throw e;

				result = await load_root_error_page({
					status: 500,
					error: coalesce_to_error(e),
					url,
					routeId
				});
			}

			if (result.redirect) {
				// this is a real edge case — `load` would need to return
				// a redirect but only in the browser
				await native_navigation(new URL(result.redirect, location.href));
			}

			initialize(result);
		}
	};
}

/**
 * @param {{
 *   paths: {
 *     assets: string;
 *     base: string;
 *   },
 *   target: Element;
 *   session: any;
 *   route: boolean;
 *   spa: boolean;
 *   trailing_slash: import('types').TrailingSlash;
 *   hydrate: {
 *     status: number;
 *     error: Error;
 *     nodes: number[];
 *     params: Record<string, string>;
 *     routeId: string | null;
 *   };
 * }} opts
 */
async function start({ paths, target, session, route, spa, trailing_slash, hydrate }) {
	const client = create_client({
		target,
		session,
		base: paths.base,
		trailing_slash
	});

	init({ client });
	set_paths(paths);

	if (hydrate) {
		await client._hydrate(hydrate);
	}

	if (route) {
		if (spa) client.goto(location.href, { replaceState: true });
		client._start_router();
	}

	dispatchEvent(new CustomEvent('sveltekit:start'));
}

export { start };
