// Due to: http://www.somethinghitme.com/2009/12/06/terrain-generation-with-canvas-and-javascript/
// reasonable defaults:
// mapDimension: 256 (power of two; although input array must be at least mapDimension+1)
// roughness: 8
// unitSize: 1 (size of pixels to operate on; also power of two)

function generateTerrainMap(mapDimension, unitSize, roughness, __map) 
{
	var map = __map || create2DArray(mapDimension+1, mapDimension+1);
	startDisplacement(map, mapDimension);
	return map;

	// Setup the map array for use
	function create2DArray(d1, d2) {
		var x = new Array(d1),
		i = 0,
		j = 0;

		for (i = 0; i < d1; i += 1) {
			x[i] = new Array(d2);
		}

		for (i=0; i < d1; i += 1) {
			for (j = 0; j < d2; j += 1) {
				x[i][j] = 0;
			}
		}

		return x;
	}

	// Starts off the map generation, seeds the first 4 corners
	function startDisplacement(map, mapDimension)
	{
		var tr, tl, t, br, bl, b, r, l, center, len=mapDimension+1;

		// top left
		map[0] = Math.random(1.0);
		tl = map[0];

		// bottom left
		var DL = mapDimension*len;

		map[0 + mapDimension] = Math.random(1.0);
		bl = map[0 + mapDimension];

		// top right
		map[DL + 0] = Math.random(1.0);
		tr = map[DL + 0];

		// bottom right
		map[DL + mapDimension] = Math.random(1.0);
		br = map[DL + mapDimension];

		// Center
		var D2L = mapDimension / 2 * len;
		var D2 =  mapDimension / 2

		map[D2L + D2] = map[0+0] + map[0 + mapDimension] + map[DL + 0] + map[DL + mapDimension] / 4;
		map[D2L + D2] = __normalize(map[D2L + DL]);
		center = map[D2L + D2];

		/* Non wrapping terrain */
		/*map[mapDimension / 2][mapDimension] = bl + br + center / 3;
		map[mapDimension / 2][0] = tl + tr + center / 3;
		map[mapDimension][mapDimension / 2] = tr + br + center / 3;
		map[0][mapDimension / 2] = tl + bl + center / 3;*/

		/*Wrapping terrain */

		map[D2L + mapDimension] = bl + br + center + center / 4;
		map[D2L + 0] = tl + tr + center + center / 4;
		map[D2L + D2] = tr + br + center + center / 4;
		map[0 + D2] = tl + bl + center + center / 4;


		// Call displacment
		midpointDisplacment(mapDimension);
	}

	// Workhorse of the terrain generation.
	function midpointDisplacment(dimension){
		var newDimension = dimension / 2,
			top, topRight, topLeft, bottom, bottomLeft, bottomRight, right, left, center,
			i, j;

		if (newDimension > unitSize)
		{
			for(i = newDimension; i <= mapDimension; i += newDimension){
				for(j = newDimension; j <= mapDimension; j += newDimension){
					x = i - (newDimension / 2);
					y = j - (newDimension / 2);

					topLeft = map[(i - newDimension)*len + j - newDimension];
					topRight = map[i*len + j - newDimension];
					bottomLeft = map[(i - newDimension)*len + j];
					bottomRight = map[i*len + j];

					// Center
					map[x*len + y] = (topLeft + topRight + bottomLeft + bottomRight) / 4 + displace(dimension);
					map[x*len + y] = __normalize(map[x*len + y]);
					center = map[x*len + y];

					// Top
					if(j - (newDimension * 2) + (newDimension / 2) > 0){
						map[x*len + j - newDimension] = (topLeft + topRight + center + map[x*len + j - dimension + (newDimension / 2)]) / 4 + displace(dimension);;
					}else{
						map[x*len + j - newDimension] = (topLeft + topRight + center) / 3+ displace(dimension);
					}

					map[x*len + j - newDimension] = __normalize(map[x*len + j - newDimension]);

					// Bottom
					if(j + (newDimension / 2) < mapDimension){
						map[x*len + j] = (bottomLeft + bottomRight + center + map[x*len + j + (newDimension / 2)]) / 4+ displace(dimension);
					}else{
						map[x*len + j] = (bottomLeft + bottomRight + center) / 3+ displace(dimension);
					}

					map[x*len + j] = __normalize(map[x*len + j]);


					//Right
					if(i + (newDimension / 2) < mapDimension){
						map[i*len + y] = (topRight + bottomRight + center + map[(i + (newDimension / 2))*len + y]) / 4 + displace(dimension);
					}else{
						map[i*len + y] = (topRight + bottomRight + center) / 3+ displace(dimension);
					}

					map[i*len + y] = __normalize(map[i*len + y]);

					// Left
					if(i - (newDimension * 2) + (newDimension / 2) > 0){
						map[(i - newDimension)*len + y] = (topLeft + bottomLeft + center + map[(i - dimension + (newDimension / 2))*len + y]) / 4 + displace(dimension);;
					}else{
						map[(i - newDimension)*len + y] = (topLeft + bottomLeft + center) / 3+ displace(dimension);
					}

					map[(i - newDimension)*len + y] = __normalize(map[(i - newDimension)*len + y]);
				}
			}
			midpointDisplacment(newDimension);
		}
	}

	// Random function to offset the center
	function displace(num){
		var max = num / (mapDimension + mapDimension) * roughness;
		return (Math.random(1.0)- 0.5) * max;
	}

	// Normalize the value to make sure its within bounds
	function __normalize(value){
		if( value > 1){
			value = 1;
		}else if(value < 0){
			value = 0;
		}
		return value;
	}
};