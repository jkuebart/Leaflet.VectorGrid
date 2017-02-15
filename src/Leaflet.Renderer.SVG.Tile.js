
L.SVG.Tile = L.Class.extend({

	initialize: function (tileCoord, tileSize, options) {
		L.setOptions(this, options);
		this._tileCoord = tileCoord;
		this._size = tileSize;

		this._service = new SVGRenderService(options.interactive);
		this._service.setSize(tileSize);
		this._service.setViewport(L.bounds([0, 0], tileSize));
	},

	getCoord: function() {
		return this._tileCoord;
	},

	getContainer: function() {
		return this._service.getElement();
	},

	addTo: function(map) {
		this._service.addTo(map);
	},

	removeFrom: function (map) {
		this._service.removeFrom(map);
	},

	/// TODO: Modify _initPath to include an extra parameter, a group name
	/// to order symbolizers by z-index
	_initPath: function (layer) {
		return this._service.initPath(layer);
	},

	_addPath: function (layer) {
		return this._service.addPath(layer);
	},

	_updateStyle: function (layer) {
		return this._service.updateStyle(layer);
	},

	_updatePoly: function (layer, closed) {
		return this._service.updatePoly(layer, closed);
	},

	_updateIcon: function (layer) {
		var path = layer._path = L.SVG.create('image'),
		    icon = layer.options.icon,
		    options = icon.options,
		    size = L.point(options.iconSize),
		    anchor = options.iconAnchor ||
		        	 size && size.divideBy(2, true),
		    p = layer._point.subtract(anchor);
		path.setAttribute('x', p.x);
		path.setAttribute('y', p.y);
		path.setAttribute('width', size.x + 'px');
		path.setAttribute('height', size.y + 'px');
		path.setAttribute('href', options.iconUrl);
	}
});


L.svg.tile = function(tileCoord, tileSize, opts){
	return new L.SVG.Tile(tileCoord, tileSize, opts);
}

const SVGRenderService = L.Class.extend({
	initialize(interactive) {
		this._interactive = interactive;

		this._container = L.SVG.create('svg');
		this._container.style.pointerEvents = 'none';
		this._rootGroup = L.SVG.create('g');
		this._container.appendChild(this._rootGroup);

		this._layers = {};
	},

	addTo(map) {
		if (this._interactive) {
			for (let i in this._layers) {
				const layer = this._layers[i];
				// By default, Leaflet tiles do not have pointer events.
				layer._path.style.pointerEvents = 'auto';
				map._targets[L.stamp(layer._path)] = layer;
			}
		}
	},

	removeFrom(map) {
		if (this._interactive) {
			for (let i in this._layers) {
				const layer = this._layers[i];
				delete map._targets[L.stamp(layer._path)];
			}
		}
	},

	getElement() {
		return this._container;
	},

	setSize(size) {
		this._container.setAttribute('width', size.x);
		this._container.setAttribute('height', size.y);
		return this;
	},

	setViewport(bounds) {
		this._container.setAttribute('viewBox', [bounds.min.x, bounds.min.y, bounds.max.x, bounds.max.y].join(' '));
		return this;
	},

	initPath(layer) {
		var path = layer._path = L.SVG.create('path');

		this._layers[L.stamp(layer)] = layer;

		// @namespace Path
		// @option className: String = null
		// Custom class name set on an element. Only for SVG renderer.
		if (layer.options.className) {
			L.DomUtil.addClass(path, layer.options.className);
		}

		if (layer.options.interactive) {
			L.DomUtil.addClass(path, 'leaflet-interactive');
		}

		this.updateStyle(layer);
	},

	addPath(layer) {
		this._rootGroup.appendChild(layer._path);
	},

	updateStyle(layer) {
		if (!layer._path) { return }

		L.SVG.updatePathStyle(layer._path, layer.options);
	},

	updatePoly(layer, closed) {
		var path = L.SVG.pointsToPath(layer._parts, closed);
		layer._path.setAttribute('d', path);
	},
});

