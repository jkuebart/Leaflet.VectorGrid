

let dimensionMap = {
	Point: 0,
	MultiPoint: 0,
	LineString: 1,
	MultiLineString: 1,
	Polygon: 2,
	MultiPolygon: 2
}


// Returns the dimension of a GeoJSON feature: 0 for points, 1 for linestrings, 2 for (multi)polygons
export default function featureDimension(geojson) {
	return geojson.type || dimensionMap[geojson.geometry.type];
}



