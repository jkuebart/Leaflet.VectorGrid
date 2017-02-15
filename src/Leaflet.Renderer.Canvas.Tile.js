
L.Canvas.Tile = L.Class.extend({

	initialize: function (tileCoord, tileSize, options) {
		L.setOptions(this, options);
		this._tileCoord = tileCoord;
		this._size = tileSize;

		var mapOffset = this._tileCoord.scaleBy(this._size);
		this._service = new CanvasRenderService(mapOffset, options.interactive);
		this._service.setSize(tileSize);
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
		if (!this._service.isDrawing()) { return; }

		var icon = layer.options.icon,
		    options = icon.options,
		    size = L.point(options.iconSize),
		    anchor = options.iconAnchor ||
		        	 size && size.divideBy(2, true),
		    p = layer._point.subtract(anchor),
		    ctx = this._ctx,
		    img = layer._getImage();

		if (img.complete) {
			ctx.drawImage(img, p.x, p.y, size.x, size.y);
		} else {
			L.DomEvent.on(img, 'load', function() {
				ctx.drawImage(img, p.x, p.y, size.x, size.y);
			});
		}
	}
});


L.canvas.tile = function(tileCoord, tileSize, opts){
	return new L.Canvas.Tile(tileCoord, tileSize, opts);
}

const CanvasRenderService = L.Class.extend({
	initialize(mapOffset, interactive) {
		this._mapOffset = mapOffset;
		var container = this._container = L.DomUtil.create('canvas');

		L.DomEvent.on(container, 'mousemove', L.Util.throttle(this._onMouseMove, 32, this), this);
		L.DomEvent.on(container, 'click dblclick mousedown mouseup contextmenu', this._onClick, this);
		L.DomEvent.on(container, 'mouseout', this._handleMouseOut, this);

		if (interactive) {
			// By default, Leaflet tiles do not have pointer events
			container.style.pointerEvents = 'auto';
		}

		this._ctx = container.getContext('2d');
		this._drawing = true;
	},

	addTo(map) {
		this._map = map;
	},

	removeFrom(map) {
		delete this._map;
	},

	getElement() {
		return this._container;
	},

	setSize(size) {
		this._container.setAttribute('width', size.x);
		this._container.setAttribute('height', size.y);
		return this;
	},

	isDrawing() {
		return this._drawing;
	},

	initPath(layer) {
		this._updateDashArray(layer);

		var order = layer._order = {
			layer: layer,
			prev: this._drawLast,
			next: null
		};
		if (this._drawLast) { this._drawLast.next = order; }
		this._drawLast = order;
		this._drawFirst = this._drawFirst || this._drawLast;
	},

	addPath(layer) {
		this._requestRedraw(layer);
	},

	updateStyle(layer) {
		this._updateDashArray(layer);
		this._requestRedraw(layer);
	},

	updatePoly(layer, closed) {
		if (!this._drawing) { return; }

		var i, j, len2, p,
		    parts = layer._parts,
		    len = parts.length,
		    ctx = this._ctx;

		if (!len) { return; }

		ctx.beginPath();

		if (ctx.setLineDash) {
			ctx.setLineDash(layer.options && layer.options._dashArray || []);
		}

		for (i = 0; i < len; i++) {
			for (j = 0, len2 = parts[i].length; j < len2; j++) {
				p = parts[i][j];
				ctx[j ? 'lineTo' : 'moveTo'](p.x, p.y);
			}
			if (closed) {
				ctx.closePath();
			}
		}

		this._fillStroke(ctx, layer);

		// TODO optimization: 1 fill/stroke for all features with equal style instead of 1 for each feature
	},

	_updateDashArray(layer) {
		if (layer.options.dashArray) {
			var parts = layer.options.dashArray.split(','),
			    dashArray = [],
			    i;
			for (i = 0; i < parts.length; i++) {
				dashArray.push(Number(parts[i]));
			}
			layer.options._dashArray = dashArray;
		}
	},

	_requestRedraw(layer) {
		if (!this._map) { return; }

		this._extendRedrawBounds(layer);
		this._redrawRequest = this._redrawRequest || L.Util.requestAnimFrame(this._redraw, this);
	},

	_extendRedrawBounds(layer) {
		var padding = (layer.options.weight || 0) + 1;
		this._redrawBounds = this._redrawBounds || new L.Bounds();
		this._redrawBounds.extend(layer._pxBounds.min.subtract([padding, padding]));
		this._redrawBounds.extend(layer._pxBounds.max.add([padding, padding]));
	},

	_redraw() {
		this._redrawRequest = null;

		if (this._redrawBounds) {
			this._redrawBounds.min._floor();
			this._redrawBounds.max._ceil();
		}

		this._clear(); // clear layers in redraw bounds
		this._draw(); // draw layers

		this._redrawBounds = null;
	},

	_clear() {
		var bounds = this._redrawBounds;
		if (bounds) {
			var size = bounds.getSize();
			this._ctx.clearRect(bounds.min.x, bounds.min.y, size.x, size.y);
		} else {
			this._ctx.clearRect(0, 0, this._container.width, this._container.height);
		}
	},

	_draw() {
		var layer, bounds = this._redrawBounds;
		this._ctx.save();
		if (bounds) {
			var size = bounds.getSize();
			this._ctx.beginPath();
			this._ctx.rect(bounds.min.x, bounds.min.y, size.x, size.y);
			this._ctx.clip();
		}

		this._drawing = true;

		for (var order = this._drawFirst; order; order = order.next) {
			layer = order.layer;
			if (!bounds || (layer._pxBounds && layer._pxBounds.intersects(bounds))) {
				layer._updatePath();
			}
		}

		this._drawing = false;

		this._ctx.restore();  // Restore state before clipping.
	},

	_fillStroke(ctx, layer) {
		var options = layer.options;

		if (options.fill) {
			ctx.globalAlpha = options.fillOpacity;
			ctx.fillStyle = options.fillColor || options.color;
			ctx.fill(options.fillRule || 'evenodd');
		}

		if (options.stroke && options.weight !== 0) {
			ctx.globalAlpha = options.opacity;
			ctx.lineWidth = options.weight;
			ctx.strokeStyle = options.color;
			ctx.lineCap = options.lineCap;
			ctx.lineJoin = options.lineJoin;
			ctx.stroke();
		}
	},

	_layersAt(point) {
		const layers = [];

		for (let order = this._drawFirst; order; order = order.next) {
			const layer = order.layer;
			if (layer.options.interactive && layer._containsPoint(point)) {
				layers.push(layer);
			}
		}

		return layers;
	},

	_getOffset: function() {
		return this._mapOffset.subtract(this._map.getPixelOrigin());
	},

	_onClick(e) {
		const point = this._map.mouseEventToLayerPoint(e).subtract(this._getOffset());
		const layers = this._layersAt(point).filter(layer => !this._map._draggableMoved(layer));;

		if (layers.length) {
			L.DomEvent.fakeStop(e);
			this._fireEvent(layers.slice(-1), e);
		}
	},

	_onMouseMove(e) {
		if (!this._map || this._map.dragging.moving() || this._map._animatingZoom) { return; }

		var point = this._map.mouseEventToLayerPoint(e).subtract(this._getOffset());
		this._handleMouseHover(e, point);
	},

	_handleMouseOut(e) {
		const layer = this._hoveredLayer;

		if (!layer) {
			return;
		}

		// if we're leaving the layer, fire mouseout
		L.DomUtil.removeClass(this._container, 'leaflet-interactive');
		this._fireEvent([layer], e, 'mouseout');
		delete this._hoveredLayer;
	},

	_handleMouseHover(e, point) {
		const layers = this._layersAt(point);
		let candidateHoveredLayer;

		if (layers.length) {
			candidateHoveredLayer = layers[layers.length - 1];
		}

		if (candidateHoveredLayer !== this._hoveredLayer) {
			this._handleMouseOut(e);

			if (candidateHoveredLayer) {
				L.DomUtil.addClass(this._container, 'leaflet-interactive'); // change cursor
				this._fireEvent([candidateHoveredLayer], e, 'mouseover');
				this._hoveredLayer = candidateHoveredLayer;
			}
		}

		if (this._hoveredLayer) {
			this._fireEvent([this._hoveredLayer], e);
		}
	},

	_fireEvent(layers, e, type) {
		this._map._fireDOMEvent(e, type || e.type, layers);
	},
});

