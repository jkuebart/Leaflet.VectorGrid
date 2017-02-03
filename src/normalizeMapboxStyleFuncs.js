
/// FIXME: Should be just ../ instead of ../../../, but Gobble symlinks are playing up.



import mapboxFilterToFunc from '../../../node_modules/mapbox-gl/js/style-spec/feature_filter/index.js';
// let mapboxFilterToFunc = mapboxFilter.createFilter;

import {
	interpolated as interpolateValue,
	isFunctionDefinition
	/*, `piecewise-constant` as piecewiseValue*/
} from '../../../node_modules/mapbox-gl/js/style-spec/function/index.js';


// Given a set of options, of which any can be either:
// - a value
// - an object with intervals or stops
// - a "filter" option which has different meaning
// or a array of sets of options like above,
// return a function that given a feature returns
// the style for that feature.
export default function normalize(opts) {
	if (Array.isArray(opts)) {
		return normalizeArray(opts);
	}

	let filter = false;
	let funcs = false;

// 	hasFilter = isFunctionDefinition(opts[])
	if ('filter' in opts) {
		filter = mapboxFilterToFunc(opts.filter);
		delete opts.filter;
	}

	for (let i in opts) {
// 		let type = typeof opts[i];
// 		if (type !== 'string' && type !== 'number') {
		if (isFunctionDefinition(opts[i])) {
			funcs = funcs || {};
			funcs[i] = interpolateValue(opts[i]);
			delete opts[i];
		}
	}

// 	console.log('normalized funcs: ', opts, filter, funcs);

	if (!filter && !funcs) {
		return opts;
	}

	if (!funcs) {
		return (function(fil) {
			return function(props, zoom, dimension){
// 				return opts;
				return filter({type: dimension, properties: props}) && opts;
			}
		})(filter);
	}

	if (!filter) {
		return (function(funs) {
			return function(props, zoom){
				var res = opts;
				for (let i in funs) {
					res[i] = funs[i](zoom);
				}
// 				res.stroke = !!((res.color !== undefined) && res.opacity && res.weight);
// 				res.fill   = !!((res.fillColor !== undefined) && res.fillOpacity);
				return (res.stroke || res.fill) && res;
			}
		})(funcs);
	}

// 	console.log('normalized both filter and funcs: ', opts, filter, funcs);

	return (function(filt, funs) {
		return function(props, zoom, dimension){
			if (!filter({type: dimension, properties: props})) { return; }
			var res = opts;
			for (let i in funcs) {
				res[i] = funcs[i](zoom);
			}
// 			res.stroke = (res.color !== undefined) && res.opacity && res.weight;
// 			res.fill   = (res.fillColor !== undefined) && res.fillOpacity;
			return (res.stroke || res.fill) && res;
		}
	})(filter, funcs);

}


function normalizeArray(opts) {
	if (opts.length === 1) {
		return normalize(opts[0]);
	}

	var norms = [];
	for (let i in opts) {
		norms.push(normalize(opts[i]));
	}

	return function(props, zoom, dimension) {
		return norms.map(f=>{
			return f(props, zoom, dimension)
		}).filter(v=>!!v);
	}
}













