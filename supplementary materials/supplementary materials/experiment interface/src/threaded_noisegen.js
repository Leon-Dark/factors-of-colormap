/*
 * A speed-improved perlin and simplex noise algorithms for 2D.
 *
 * Based on example code by Stefan Gustavson (stegu@itn.liu.se).
 * Optimisations by Peter Eastman (peastman@drizzle.stanford.edu).
 * Better rank ordering method by Stefan Gustavson in 2012.
 * Converted to Javascript by Joseph Gentle.
 *
 * Version 2012-03-09
 *
 * This code was placed in the public domain by its original author,
 * Stefan Gustavson. You may use it as you see fit, but
 * attribution is appreciated.
 *
 */

(function(global){
  var module = global.noise = {};

  function Grad(x, y, z) {
    this.x = x; this.y = y; this.z = z;
  }
  
  Grad.prototype.dot2 = function(x, y) {
    return this.x*x + this.y*y;
  };

  Grad.prototype.dot3 = function(x, y, z) {
    return this.x*x + this.y*y + this.z*z;
  };

  var grad3 = [new Grad(1,1,0),new Grad(-1,1,0),new Grad(1,-1,0),new Grad(-1,-1,0),
               new Grad(1,0,1),new Grad(-1,0,1),new Grad(1,0,-1),new Grad(-1,0,-1),
               new Grad(0,1,1),new Grad(0,-1,1),new Grad(0,1,-1),new Grad(0,-1,-1)];

  var p = [151,160,137,91,90,15,
  131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,8,99,37,240,21,10,23,
  190, 6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,57,177,33,
  88,237,149,56,87,174,20,125,136,171,168, 68,175,74,165,71,134,139,48,27,166,
  77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,55,46,245,40,244,
  102,143,54, 65,25,63,161, 1,216,80,73,209,76,132,187,208, 89,18,169,200,196,
  135,130,116,188,159,86,164,100,109,198,173,186, 3,64,52,217,226,250,124,123,
  5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,189,28,42,
  223,183,170,213,119,248,152, 2,44,154,163, 70,221,153,101,155,167, 43,172,9,
  129,22,39,253, 19,98,108,110,79,113,224,232,178,185, 112,104,218,246,97,228,
  251,34,242,193,238,210,144,12,191,179,162,241, 81,51,145,235,249,14,239,107,
  49,192,214, 31,181,199,106,157,184, 84,204,176,115,121,50,45,127, 4,150,254,
  138,236,205,93,222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180];
  // To remove the need for index wrapping, double the permutation table length
  var perm = new Array(512);
  var gradP = new Array(512);

  // This isn't a very good seeding function, but it works ok. It supports 2^16
  // different seed values. Write something better if you need more seeds.
  module.seed = function(seed) {
    if(seed > 0 && seed < 1) {
      // Scale the seed out
      seed *= 65536;
    }

    seed = Math.floor(seed);
    if(seed < 256) {
      seed |= seed << 8;
    }

    for(var i = 0; i < 256; i++) {
      var v;
      if (i & 1) {
        v = p[i] ^ (seed & 255);
      } else {
        v = p[i] ^ ((seed>>8) & 255);
      }

      perm[i] = perm[i + 256] = v;
      gradP[i] = gradP[i + 256] = grad3[v % 12];
    }
  };

  module.seed(0);

  /*
  for(var i=0; i<256; i++) {
    perm[i] = perm[i + 256] = p[i];
    gradP[i] = gradP[i + 256] = grad3[perm[i] % 12];
  }*/

  // Skewing and unskewing factors for 2, 3, and 4 dimensions
  var F2 = 0.5*(Math.sqrt(3)-1);
  var G2 = (3-Math.sqrt(3))/6;

  var F3 = 1/3;
  var G3 = 1/6;

  // 2D simplex noise
  module.simplex2 = function(xin, yin) {
    var n0, n1, n2; // Noise contributions from the three corners
    // Skew the input space to determine which simplex cell we're in
    var s = (xin+yin)*F2; // Hairy factor for 2D
    var i = Math.floor(xin+s);
    var j = Math.floor(yin+s);
    var t = (i+j)*G2;
    var x0 = xin-i+t; // The x,y distances from the cell origin, unskewed.
    var y0 = yin-j+t;
    // For the 2D case, the simplex shape is an equilateral triangle.
    // Determine which simplex we are in.
    var i1, j1; // Offsets for second (middle) corner of simplex in (i,j) coords
    if(x0>y0) { // lower triangle, XY order: (0,0)->(1,0)->(1,1)
      i1=1; j1=0;
    } else {    // upper triangle, YX order: (0,0)->(0,1)->(1,1)
      i1=0; j1=1;
    }
    // A step of (1,0) in (i,j) means a step of (1-c,-c) in (x,y), and
    // a step of (0,1) in (i,j) means a step of (-c,1-c) in (x,y), where
    // c = (3-sqrt(3))/6
    var x1 = x0 - i1 + G2; // Offsets for middle corner in (x,y) unskewed coords
    var y1 = y0 - j1 + G2;
    var x2 = x0 - 1 + 2 * G2; // Offsets for last corner in (x,y) unskewed coords
    var y2 = y0 - 1 + 2 * G2;
    // Work out the hashed gradient indices of the three simplex corners
    i &= 255;
    j &= 255;
    var gi0 = gradP[i+perm[j]];
    var gi1 = gradP[i+i1+perm[j+j1]];
    var gi2 = gradP[i+1+perm[j+1]];
    // Calculate the contribution from the three corners
    var t0 = 0.5 - x0*x0-y0*y0;
    if(t0<0) {
      n0 = 0;
    } else {
      t0 *= t0;
      n0 = t0 * t0 * gi0.dot2(x0, y0);  // (x,y) of grad3 used for 2D gradient
    }
    var t1 = 0.5 - x1*x1-y1*y1;
    if(t1<0) {
      n1 = 0;
    } else {
      t1 *= t1;
      n1 = t1 * t1 * gi1.dot2(x1, y1);
    }
    var t2 = 0.5 - x2*x2-y2*y2;
    if(t2<0) {
      n2 = 0;
    } else {
      t2 *= t2;
      n2 = t2 * t2 * gi2.dot2(x2, y2);
    }
    // Add contributions from each corner to get the final noise value.
    // The result is scaled to return values in the interval [-1,1].
    return 70 * (n0 + n1 + n2);
  };

  // 3D simplex noise
  module.simplex3 = function(xin, yin, zin) {
    var n0, n1, n2, n3; // Noise contributions from the four corners

    // Skew the input space to determine which simplex cell we're in
    var s = (xin+yin+zin)*F3; // Hairy factor for 2D
    var i = Math.floor(xin+s);
    var j = Math.floor(yin+s);
    var k = Math.floor(zin+s);

    var t = (i+j+k)*G3;
    var x0 = xin-i+t; // The x,y distances from the cell origin, unskewed.
    var y0 = yin-j+t;
    var z0 = zin-k+t;

    // For the 3D case, the simplex shape is a slightly irregular tetrahedron.
    // Determine which simplex we are in.
    var i1, j1, k1; // Offsets for second corner of simplex in (i,j,k) coords
    var i2, j2, k2; // Offsets for third corner of simplex in (i,j,k) coords
    if(x0 >= y0) {
      if(y0 >= z0)      { i1=1; j1=0; k1=0; i2=1; j2=1; k2=0; }
      else if(x0 >= z0) { i1=1; j1=0; k1=0; i2=1; j2=0; k2=1; }
      else              { i1=0; j1=0; k1=1; i2=1; j2=0; k2=1; }
    } else {
      if(y0 < z0)      { i1=0; j1=0; k1=1; i2=0; j2=1; k2=1; }
      else if(x0 < z0) { i1=0; j1=1; k1=0; i2=0; j2=1; k2=1; }
      else             { i1=0; j1=1; k1=0; i2=1; j2=1; k2=0; }
    }
    // A step of (1,0,0) in (i,j,k) means a step of (1-c,-c,-c) in (x,y,z),
    // a step of (0,1,0) in (i,j,k) means a step of (-c,1-c,-c) in (x,y,z), and
    // a step of (0,0,1) in (i,j,k) means a step of (-c,-c,1-c) in (x,y,z), where
    // c = 1/6.
    var x1 = x0 - i1 + G3; // Offsets for second corner
    var y1 = y0 - j1 + G3;
    var z1 = z0 - k1 + G3;

    var x2 = x0 - i2 + 2 * G3; // Offsets for third corner
    var y2 = y0 - j2 + 2 * G3;
    var z2 = z0 - k2 + 2 * G3;

    var x3 = x0 - 1 + 3 * G3; // Offsets for fourth corner
    var y3 = y0 - 1 + 3 * G3;
    var z3 = z0 - 1 + 3 * G3;

    // Work out the hashed gradient indices of the four simplex corners
    i &= 255;
    j &= 255;
    k &= 255;
    var gi0 = gradP[i+   perm[j+   perm[k   ]]];
    var gi1 = gradP[i+i1+perm[j+j1+perm[k+k1]]];
    var gi2 = gradP[i+i2+perm[j+j2+perm[k+k2]]];
    var gi3 = gradP[i+ 1+perm[j+ 1+perm[k+ 1]]];

    // Calculate the contribution from the four corners
    var t0 = 0.6 - x0*x0 - y0*y0 - z0*z0;
    if(t0<0) {
      n0 = 0;
    } else {
      t0 *= t0;
      n0 = t0 * t0 * gi0.dot3(x0, y0, z0);  // (x,y) of grad3 used for 2D gradient
    }
    var t1 = 0.6 - x1*x1 - y1*y1 - z1*z1;
    if(t1<0) {
      n1 = 0;
    } else {
      t1 *= t1;
      n1 = t1 * t1 * gi1.dot3(x1, y1, z1);
    }
    var t2 = 0.6 - x2*x2 - y2*y2 - z2*z2;
    if(t2<0) {
      n2 = 0;
    } else {
      t2 *= t2;
      n2 = t2 * t2 * gi2.dot3(x2, y2, z2);
    }
    var t3 = 0.6 - x3*x3 - y3*y3 - z3*z3;
    if(t3<0) {
      n3 = 0;
    } else {
      t3 *= t3;
      n3 = t3 * t3 * gi3.dot3(x3, y3, z3);
    }
    // Add contributions from each corner to get the final noise value.
    // The result is scaled to return values in the interval [-1,1].
    return 32 * (n0 + n1 + n2 + n3);

  };

  // ##### Perlin noise stuff

  function fade(t) {
    return t*t*t*(t*(t*6-15)+10);
  }

  function lerp(a, b, t) {
    return (1-t)*a + t*b;
  }

  // 2D Perlin Noise
  module.perlin2 = function(x, y) {
    // Find unit grid cell containing point
    var X = Math.floor(x), Y = Math.floor(y);
    // Get relative xy coordinates of point within that cell
    x = x - X; y = y - Y;
    // Wrap the integer cells at 255 (smaller integer period can be introduced here)
    X = X & 255; Y = Y & 255;

    // Calculate noise contributions from each of the four corners
    var n00 = gradP[X+perm[Y]].dot2(x, y);
    var n01 = gradP[X+perm[Y+1]].dot2(x, y-1);
    var n10 = gradP[X+1+perm[Y]].dot2(x-1, y);
    var n11 = gradP[X+1+perm[Y+1]].dot2(x-1, y-1);

    // Compute the fade curve value for x
    var u = fade(x);

    // Interpolate the four results
    return lerp(
        lerp(n00, n10, u),
        lerp(n01, n11, u),
       fade(y));
  };

  // 3D Perlin Noise
  module.perlin3 = function(x, y, z) {
    // Find unit grid cell containing point
    var X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z);
    // Get relative xyz coordinates of point within that cell
    x = x - X; y = y - Y; z = z - Z;
    // Wrap the integer cells at 255 (smaller integer period can be introduced here)
    X = X & 255; Y = Y & 255; Z = Z & 255;

    // Calculate noise contributions from each of the eight corners
    var n000 = gradP[X+  perm[Y+  perm[Z  ]]].dot3(x,   y,     z);
    var n001 = gradP[X+  perm[Y+  perm[Z+1]]].dot3(x,   y,   z-1);
    var n010 = gradP[X+  perm[Y+1+perm[Z  ]]].dot3(x,   y-1,   z);
    var n011 = gradP[X+  perm[Y+1+perm[Z+1]]].dot3(x,   y-1, z-1);
    var n100 = gradP[X+1+perm[Y+  perm[Z  ]]].dot3(x-1,   y,   z);
    var n101 = gradP[X+1+perm[Y+  perm[Z+1]]].dot3(x-1,   y, z-1);
    var n110 = gradP[X+1+perm[Y+1+perm[Z  ]]].dot3(x-1, y-1,   z);
    var n111 = gradP[X+1+perm[Y+1+perm[Z+1]]].dot3(x-1, y-1, z-1);

    // Compute the fade curve value for x, y, z
    var u = fade(x);
    var v = fade(y);
    var w = fade(z);

    // Interpolate
    return lerp(
        lerp(
          lerp(n000, n100, u),
          lerp(n001, n101, u), w),
        lerp(
          lerp(n010, n110, u),
          lerp(n011, n111, u), w),
       v);
  };

})(this);



/* ============================================================================= */

if (!ArrayBuffer.prototype.slice)
	ArrayBuffer.prototype.slice = function (start, end) {
	var that = new Uint8Array(this);
	if (end == undefined) end = that.length;
	var result = new ArrayBuffer(end - start);
	var resultArray = new Uint8Array(result);
	for (var i = 0; i < resultArray.length; i++) {
		resultArray[i] = that[i + start];
	}
	return result;
}

var noiseOffset = [0, 0];
var noiseZoom = 1;
var noiseSimplex = false;
var inversion = false;

var exponentWeight = 2.0;
var noiseScale = 4;
var noiseWeights = [1, 0.75, 0.3/2]; //, 0.1/3, 0.05/5];
var noiseOctaves = [1, 2, 4]; //, 8, 16];

function setNoiseOffset(x, y) {
	noiseOffset[0] = x;
	noiseOffset[1] = y;
}
function setExponentWeight(e) {
	exponentWeight = e;
}

function normalize(view) 
{
	var len = view.length;
		
	if (len > 0)
	{
		var m0 = Number.MAX_VALUE;
		var m1 = Number.MIN_VALUE;

		for (var i=0; i<len; i++) 
		{
			var v = view[i];
			if (m0 > v) {
				m0 = v;
			}
			else if (m1 < v) {
				m1 = v;
			}
		}
		var _range = 1.0 / (m1-m0);

		for (var i=0; i<len; i++) 
		{
			view[i] = (view[i]-m0) * _range;
		}
	}
}

function makeNoise(data, w, h, _noiseScale)
{
	var I = 0;

	/*
	if (_noiseScale && !isNaN(_noiseScale)) {
		noiseScale = _noiseScale;
	}

	noiseOffset[0] /= noiseScale / noiseZoom;
	noiseOffset[1] /= noiseScale / noiseZoom;
	noiseZoom = noiseScale;
	*/

	for (var y=0; y<h; y++)
	{
		for (var x=0; x<w; x++) 
		{
			var nx = _noiseScale*((x + noiseOffset[0])/(w-1) - 0.5);
			var ny = _noiseScale*((y + noiseOffset[1])/(h-1) - 0.5);
			var e = 
				noiseWeights[0] * (.5 + .5*noise.simplex2(noiseOctaves[0] * nx, noiseOctaves[0] * ny)) +
				noiseWeights[1] * (.5 + .5*noise.simplex2(noiseOctaves[1] * nx, noiseOctaves[1] * ny)) +
				noiseWeights[2] * (.5 + .5*noise.simplex2(noiseOctaves[2] * nx, noiseOctaves[2] * ny));
				//noiseWeights[3] * (.5 + .5*noise.simplex2(noiseOctaves[3] * nx, noiseOctaves[3] * ny));
				//noiseWeights[4] * (.5 + .5*noise.simplex2(noiseOctaves[4] * nx, noiseOctaves[4] * ny)) ;
			data[I++] = Math.pow(e, exponentWeight);
		}
	}
	normalize(data);
}

function seedNoise() {
	var theSeed = Math.random()
	noise.seed(theSeed);
	return theSeed;
}


function KS_test(field1, field2)
{
	var o1 = field1.sort();
	var o2 = field2.sort();
	if (o1.length != o2.length) {
		console.error("can't compute KS test. Datasets not identical in length")
		return null;
	}
	else
	{
		KS_lookup_i = 0;
		KS_field = o2;

		function lookup(x) 
		{
			var len   = KS_field.length;
			var first = KS_field[0];
			var last  = KS_field[len-1];

			if (x < first) {
				return 0;
			}
			else if (x >= last) {
				return 1;
			}
			else 
			{
				// find next X
				while (!(KS_field[KS_lookup_i] <= x && x <= KS_field[KS_lookup_i+1]))
				{
					KS_lookup_i++;
				}
				return (KS_lookup_i+1) / len;
			}
		}

		var maxD = 0;
		var maxIndex = 0;
		var maxValue = 0;

		for (var i=0, len=o1.length; i<len; i++) 
		{
			var l = lookup(o1[i]);
			var p = Math.abs((i+1)/len - l);
			if (p > maxD) 
			{
				maxD = p;
				maxIndex = i;
				maxValue = o1[i];
			}
		}
		var critical = 1.627 * Math.sqrt( (o1.length + o2.length) / (o2.length * o1.length) );
		
		return {
			maxD: maxD, valueAtMax: maxValue,
			field1: o1, field2: o2
		};
	}
}

function getSubregionStats(data, x, y, w, h)
{
	var view = data;
	var minmax = [Number.MAX_VALUE, Number.MIN_VALUE];
	var sW = w;
	var mean = 0;
	var count = 0;
	var w_1 = w-1;
	var h_1 = h-1;

	// min/max and mean
	for (var r=y, rr=y+h; r<rr; r++) 
	{
		for (var c=x, cc=x+w; c<cc; c++, count++) 
		{
			var v = view[ r*sW + c ];
			minmax[0] = Math.min(minmax[0], v);
			minmax[1] = Math.max(minmax[1], v);

			mean += v;
		}
	}
	mean /= count;

	// standard deviation
	var std = 0;
	var steepness = 0;
	var steepnessCount = 0, maxSteepness = 0;

	for (var r=y, rr=y+h; r<rr; r++) 
	{
		for (var c=x, cc=x+w; c<cc; c++) 
		{
			std += Math.pow(view[ r*sW + c ]-mean, 2);
			
			if (c > 0 && c < w_1 && r > 0 && r < h_1) 
			{
				// kernel components
				var aaa  = view[r    *sW+c-1];
				var ddd  = view[r    *sW+c+1];
				var www  = view[(r-1)*sW+c  ];
				var xxx  = view[(r+1)*sW+c  ];
				var eee  = view[(r-1)*sW+c+1];
				var ccc  = view[(r+1)*sW+c+1];				
				var qqq  = view[(r-1)*sW+c-1];
				var zzz  = view[(r+1)*sW+c-1];

				// sobel kernels
				var gx = -qqq - 2*aaa -zzz +eee +2*ddd +ccc;
				var gy =  qqq + 2*www +eee -zzz -2*xxx -ccc;
				var g = Math.abs(gx) + Math.abs(gy);
				steepness += 100 * g;
				steepnessCount++;
				maxSteepness = Math.max(g, maxSteepness);
			}
		}
	}
	std = Math.sqrt( std / count );

	return {
		minmax: minmax,
		mean: mean,
		std: std,
		steepness: steepness / steepnessCount,
		steepnessCount: steepnessCount,
		maxSteepness: maxSteepness,
	};
}

function calcAvgGradient(data, w, h)
{
	var stats = getSubregionStats(data, 0, 0, w, h);
	return stats.steepness;
}

function randomStimulus(w, h, targetScale, diff, ksThreshold)
{

	function sign(x) { if (x >= 0) return 1; else return -1; }


	// create two arrays
	var stim1Buffer = new ArrayBuffer(w*h*4);
	var stim2Buffer = new ArrayBuffer(w*h*4);
	var stim1 = new Float32Array(stim1Buffer);
	var stim2 = new Float32Array(stim2Buffer);

	// keep track of time
	var timeStart = Date.now();

	var done = false;
	var minDiff = Number.MAX_VALUE;
	var maxDiff = Number.MIN_VALUE;
	
	var actualDiff;
	var tolerance = Math.abs(diff * TOLERANCE) + TOLERANCE_INTERCEPT;
	var g1, g2;

	var seed1, seed2;
	var offset1, offset2;
	var K;
	var ksRes = null;

	var iterations = 0;
	for (var longIt=0; longIt<TRIALS0 && !done; longIt++)
	{
		seed1 = seedNoise();
		offset1 = [Math.random() * 10000, Math.random() * 10000];
		setNoiseOffset(offset1[0], offset1[1]);
		makeNoise(stim1, w, h, targetScale);

		g1 = calcAvgGradient(stim1, w, h);

		for (var shortIt=0; shortIt<TRIALS && !done; shortIt++, iterations++)
		{
			seed2 = seedNoise();
			offset2 = [Math.random() * 10000, Math.random() * 10000];
			setNoiseOffset(offset2[0], offset2[1]);

			var K_RANGE = [.1,.1];
			K = Math.random() * (K_RANGE[1]-K_RANGE[0]) + K_RANGE[1];
			makeNoise(stim2, w, h, targetScale+diff*K);

			// compute difference between the two stimuli
			g2 = calcAvgGradient(stim2, w, h);

			actualDiff = g2-g1;

			minDiff = Math.min(actualDiff, minDiff);
			maxDiff = Math.max(actualDiff, maxDiff);

			var delta = actualDiff-diff
			if (Math.abs(delta) <= tolerance && sign(actualDiff) == sign(diff))
			{
				done = true;
				if (sign(actualDiff) != sign(diff)) 
				{
					// flip
					var temp = stim1;
					stim1 = stim2;
					stim2 = temp;

					temp = g1;
					g1 = g2;
					g2 = temp;
				}
			}

			if (done && ksThreshold !== undefined && ksThreshold != 0.0) 
			{
				// copy views
				var view1 = new Float32Array(stim1Buffer.slice(0));
				var view2 = new Float32Array(stim2Buffer.slice(0));

				ksRes = KS_test(view1, view2);
				if (ksRes.maxD > ksThreshold) {
					done = false;
				}
			}
		}
	}

	//printTimeDiff(timeStart, Date.now(), "gen time");

	if (done) 
	{
		//console.log('** base: ' + g1.toFixed(2) + ', actualDiff: ' + actualDiff.toFixed(3) + ", req: " + diff.toFixed(3) + ", converged: " + iterations);
	}
	else {
		console.warn("could not converge. min Diff reached: " + minDiff);
	}

	return {
		// the actual stimuli
		stim1Buffer: stim1Buffer,
		stim2Buffer: stim2Buffer,

		// difference paramters
		actualDiff: actualDiff,
		requestedDiff: diff,
		magnitude: targetScale,
		ksThreshold: ksThreshold,
		ksMaxD: ksRes ? ksRes.maxD : null,

		// number of iterations and whether we've converged
		iterations: iterations,
		converged: done,

		// parameters
		seed1: seed1,
		seed2: seed2,
		offset1: offset1,
		offset2: offset2,
		K: K,
		g1: g1,
		g2: g2,
		w: w,
		h: h,
		exponentWeight: exponentWeight
	};
}
var TRIALS0 = null;
var TRIALS = null;
var TOLERANCE = null;
var TOLERANCE_INTERCEPT = 0.0;

// start the generation
onmessage = function(msg)
{
	var e = msg.data;
	TRIALS  = e.TRIALS;
	TRIALS0 = e.TRIALS0;
	TOLERANCE = e.TOLERANCE;
	TOLERANCE_INTERCEPT = e.TOLERANCE_INTERCEPT;
	
	var attempts = e.ATTEMPTS;

	setExponentWeight(e.exponentWeight);
	var results = null;
	var startTime = Date.now();
	for (var i=0; (!results || !results.converged) && i<attempts; i++)
	{
		results = randomStimulus(
			e.w,
			e.h,
			e.targetScale,
			e.diff,
			e.ksThreshold,
		);
		results.iterations += i*(TRIALS*TRIALS0);
	}
	results.generationTime = Date.now() - startTime;

	postMessage(results);
}
