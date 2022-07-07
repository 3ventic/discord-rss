export const manifest = {
	appDir: "_app",
	assets: new Set(["favicon.png","global.css","logo-192.png","logo-512.png","manifest.json"]),
	mimeTypes: {".png":"image/png",".css":"text/css",".json":"application/json"},
	_: {
		entry: {"file":"start-2ac98959.js","imports":["start-2ac98959.js","chunks/index-165902b6.js","chunks/index-1dacbe9f.js"],"stylesheets":[]},
		nodes: [
			() => import('./nodes/0.js'),
			() => import('./nodes/1.js'),
			() => import('./nodes/2.js')
		],
		routes: [
			{
				type: 'page',
				id: "",
				pattern: /^\/$/,
				names: [],
				types: [],
				path: "/",
				shadow: null,
				a: [0,2],
				b: [1]
			},
			{
				type: 'endpoint',
				id: ".json",
				pattern: /^\/\.json$/,
				names: [],
				types: [],
				load: () => import('./entries/endpoints/index.json.ts.js')
			}
		],
		matchers: async () => {
			
			return {  };
		}
	}
};
