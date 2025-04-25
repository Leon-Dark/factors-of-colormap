

function ColorMap(colorset, interpType)
{
	if (isFunction(colorset))
	{
		this.colormapFunc = colorset;
	}
	else if (colorset) {
		this.setMap(colorset, interpType)
	}
}

ColorMap.prototype.setMap = function(colorMap, interpType)
{
	// force interpolation in the CIELAB color space?
	// interpType = 'lab';

	this.colorMap = colorMap || this.colorMap;
	this.colorInterpolator = [];
	this.interpType = interpType;

	if (colorMap.length > 1)
	{
		for (var i=0, len=colorMap.length; i<len-1; i++)
		{
			var range = [
				colorMap[i].value,
				colorMap[i+1].value
			];

			var interpolator = null;
			if (colorMap[i].lab && colorMap[i+1].lab)
			{
				var lab1 = colorMap[i].lab;
				var lab2 = colorMap[i+1].lab;

				if (interpType == 'lab')
				{
					interpolator = d3.interpolateLab(
						d3.lab(lab1[0], lab1[1], lab1[2]),
						d3.lab(lab2[0], lab2[1], lab2[2])
					);
				}
				else if (interpType == 'hsl')
				{
					interpolator = d3.interpolateHsl(
						d3.lab(lab1[0], lab1[1], lab1[2]),
						d3.lab(lab2[0], lab2[1], lab2[2])
					);
				}
				else
				{
					interpolator = d3.interpolateRgb(
						d3.lab(lab1[0], lab1[1], lab1[2]),
						d3.lab(lab2[0], lab2[1], lab2[2])
					);
				}
			}
			else
			{
				var hcl1 = colorMap[i].rgb;
				var hcl2 = colorMap[i+1].rgb;

				if (interpType == 'lab')
				{
					interpolator = d3.interpolateLab(
						d3.rgb(hcl1[0], hcl1[1], hcl1[2]),
						d3.rgb(hcl2[0], hcl2[1], hcl2[2])
					);
				}
				else if (interpType == 'hsl')
				{
					interpolator = d3.interpolateHsl(
						d3.rgb(hcl1[0], hcl1[1], hcl1[2]),
						d3.rgb(hcl2[0], hcl2[1], hcl2[2])
					);
				}

				else
				{
					interpolator = d3.interpolateRgb(
						d3.rgb(hcl1[0], hcl1[1], hcl1[2]),
						d3.rgb(hcl2[0], hcl2[1], hcl2[2])
					);
				}
			}

			this.colorInterpolator.push(
			{
				// interpolator
				interpType: interpType == 'lab' ? 1 : 0,
				interpolator: interpolator,

				// the data range
				range: range,
				_len: 1 / (range[1]-range[0]),
			});
		}
	}
}

ColorMap.prototype.getMinMax = function()
{
	if (this.colormapFunc) {
		return [0, 1];
	}
	else if (this.colorMap.length == 0) {
		return null;
	}
	else
	{
		return [
			this.colorMap[0].value,
			this.colorMap[this.colorMap.length-1].value
		];
	}
}

ColorMap.prototype.addColor = function()
{
	var minmax = this.getMinMax();
	var newCount = this.colorMap.length+1;

	var newSet = [];
	for (var i=0; i<newCount; i++)
	{
		var v = i/(newCount-1) * (minmax[1] - minmax[0]) + minmax[0];
		var c = this.mapValue(v);
		newSet.push({
			value: v,
			rgb: [c.r, c.g, c.b]
		});
	}
	this.setMap(newSet, this.interpType);
}

ColorMap.prototype.removeColor = function() {
	if (this.colorMap.length <= 2) {
		// do nothing
		return;
	}

	var minmax = this.getMinMax();
	var newCount = this.colorMap.length-1;

	var newSet = [];
	for (var i=0; i<newCount; i++)
	{
		var v = i/(newCount-1) * (minmax[1] - minmax[0]) + minmax[0];
		var c = this.mapValue(v);
		newSet.push({
			value: v,
			rgb: [c.r, c.g, c.b]
		});
	}

	this.setMap(newSet, this.interpType);
}

ColorMap.prototype.visualize = function(svg)
{
	/*
	var colorset = this.colorMap.slice(0);
	colorset.reverse();
	*/

	var gColors = svg.select('g.colorRectGroup');
	if (gColors.size() == 0) {
		gColors = svg.append('g').attr('class', 'colorRectGroup').attr('transform', 'translate(15,15)');
	}

	var gLightness = svg.select('g.colorLightnessCurve');
	if (gLightness.size() == 0) {
		gLightness = svg.append('g').attr('class', 'colorLightnessCurve').attr('transform', 'translate(45,15)');
	}
	gLightness.selectAll('*').remove();

	var gColorScale = svg.select('g.colorScale');
	if (gColorScale.size() == 0) {
		gColorScale = svg.append('g').attr('class', 'colorScale').attr('transform', 'translate(80,15)');
	}
	gColorScale.selectAll('*').remove();

	var COLOR_RECT_H = 12;
	var COLOR_RECT_W = 25;
	var COLOR_RECT_OFFSET = 3;

	// make the color
	/*
	var update = gColors.selectAll('rect').data(colorset);
	update.enter().append('rect')
		.attr('x', 0)
		.attr('y', function(d, i) { return i*(COLOR_RECT_H+COLOR_RECT_OFFSET)})
		.attr('width', COLOR_RECT_W).attr('height', COLOR_RECT_H)
		.style('stroke', 'black').style('stroke-width', '1px');

	update
		.style('fill', function(d) { return d3.rgb(d.rgb[0], d.rgb[1], d.rgb[2]).toString() });

	update.exit().remove();
	*/


	var COLOR_LIGHTNESS_W = 40;
	var COLOR_LIGHTNESS_H = 210; //COLOR_RECT_H * colorset.length + Math.max(0, colorset.length-1) * COLOR_RECT_OFFSET;

	var internalCanvas = document.createElement('canvas');
		internalCanvas.width = COLOR_RECT_W;
		internalCanvas.height = COLOR_LIGHTNESS_H;

	this.drawColorScale(
		internalCanvas.width,
		internalCanvas.height,
		COLOR_LIGHTNESS_H/2,
		'vertical',
		internalCanvas);

	gColorScale.append('image')
		.attr('width', COLOR_LIGHTNESS_W)
		.attr('height', COLOR_LIGHTNESS_H)
		.attr('x', -COLOR_LIGHTNESS_W-30)
		.attr('y', 0)
		.attr('xlink:href', internalCanvas.toDataURL());

	// make lightness curve
	var lightnessValues = [], diffValues = [];
	var minmax = this.getMinMax();

	for (var i=0, len=50; i<len; i++)
	{
		var v = (minmax[1]-minmax[0]) * (i/(len-1)) + minmax[0];
		var vv = this.mapValue(v);
		var cLab = d3.lab( d3.rgb(vv.r, vv.g, vv.b) );
		lightnessValues.push({
			x: COLOR_LIGHTNESS_W * cLab.l/100,
			y: COLOR_LIGHTNESS_H - COLOR_LIGHTNESS_H * i/(len-1)
		});


	}


	for (var i=0, len=this.colorDiffs.length; i<len; i++) {
		var d = this.colorDiffs[i];
		diffValues[i] = {
			x: COLOR_LIGHTNESS_W * d,
			y: COLOR_LIGHTNESS_H - COLOR_LIGHTNESS_H * i/(len-1)
		};
	}


	gLightness.append('rect')
		.style('fill', 'none')
		.style('stroke', '#444444').style('stroke-width', '0.5px')
		.attr('width', COLOR_LIGHTNESS_W).attr('height', COLOR_LIGHTNESS_H);

	var pathGenerator = d3.svg.line()
		.x(function(d) { return d.x; }).y(function(d) { return d.y; });

	gLightness.append('path')
		.attr('d', pathGenerator(lightnessValues))
		.style('stroke', '#af010a').style('stroke-width', '1px').style('fill', 'none')

	gLightness.append('path')
		.attr('d', pathGenerator(diffValues))
		.style('stroke', 'black').style('stroke-width', '1px').style('fill', 'none');

}

ColorMap.prototype.computeColorDiff = function(m0, m1)
{
	var SAMPLES = 50;
	var minmax = (m0 === undefined || m1 === undefined) ? [0, 1] : [m0, m1];
	var lastCLab = null;
	var diffValues = [];
	var maxDiff = -Number.MAX_VALUE;
	var avgDiff = 0, N=0;

	for (var i=0, len=SAMPLES; i<len; i++)
	{
		var v = (minmax[1]-minmax[0]) * (i/(len-1)) + minmax[0];
		var vv = this.mapValue(v);
		var cLab = d3.lab( d3.rgb(vv.r, vv.g, vv.b) );

		if (lastCLab) {

			var d = cie76Diff(lastCLab, cLab);
			diffValues.push(d);
			maxDiff = Math.max(d, maxDiff);
			avgDiff += d;
			N++;
		}
		else {
			diffValues.push(0);
		}
		lastCLab = cLab;
	}

	this.avgDiff = avgDiff / N;
	this.colorDiffs = diffValues;
	this.maxColorDiff = maxDiff;
}

ColorMap.prototype.computeColorDiffAroundValue = function(value)
{
	var SAMPLES = 1;		// each direction
	var THRESHOLD = 0.025;	// in data space

	var samplesTaken = 0;
	var maxDiff = -Number.MAX_VALUE;
	var cummDiff = 0;

	// loop through two directions
	for (var d=0; d<2; d++) {
		var direction = (d == 0 ? 1 : -1);
		var v1 = value;
		var v2 = value + direction * (THRESHOLD / SAMPLES);

		var c1 = this.mapValue(v1);
		c1 = d3.lab( d3.rgb(c1.r, c1.g, c1.b) );

		for (var i=0; i<SAMPLES && v1>=0 && v1<=1.0 && v2>=0 && v2<=1.0; i++)
		{
			var c2 = this.mapValue(v2);
			c2 = d3.lab( d3.rgb(c2.r, c2.g, c2.b) );

			// compute color difference
			var colorDiff = cie2000Diff(c1, c2);
			cummDiff += colorDiff;
			maxDiff = Math.max(maxDiff, colorDiff);

			c1 = c2;
			v1 = v2;
			v2 += direction * (THRESHOLD / SAMPLES);

			samplesTaken++;
		}
	}

	if (samplesTaken == 0) {
		console.error("Couldn't take any color differential samples.");
		return null;
	}
	else
	{
		return {
			avgColorDiff: cummDiff / samplesTaken,
			maxColorDiff: maxDiff
		};
	}
}

ColorMap.prototype.scaleColorDiff = function(s)
{
	console.log("scale color diff: " + s);
	var diffValues = this.colorDiffs;
	for (var i=0, len=diffValues.length; i<len; i++) {
		diffValues[i] /= s;
	}
}

ColorMap.prototype.mapValue = function(v)
{
	if (this.colormapFunc)
	{
		return this.colormapFunc(v);
	}
	else
	{
		var interpolators = this.colorInterpolator;

		for (var i=0, len=interpolators.length; i < len; i++)
		{
			var interpolator = interpolators[i];
			var range = interpolator.range;

			if (range[0] <= v && range[1] >= v)
			{
				var n = (v - range[0]) * interpolator._len
				var c = interpolator.interpolator(n);
				return d3.rgb(c);
			}
		}
		return null;
	}
}

ColorMap.prototype.createGPUColormap = function(colorMap)
{
	// create an internal canvas and draw the colorscale onto it
	var internalCanvas = document.createElement('canvas');
	internalCanvas.width = 1024;
	internalCanvas.height = 1;

	// draw color scale
	if (!colorMap) {
		colorMap = this;
	}

	colorMap.drawColorScale(
		internalCanvas.width,
		internalCanvas.height,
		1024,
		'horizontal',
		internalCanvas
	);

	var texture = new THREE.CanvasTexture(
		internalCanvas,
		THREE.UVMapping,
		THREE.ClampToEdgeWrapping,
		THREE.ClampToEdgeWrapping,
		THREE.LinearFilter,
		THREE.LinearFilter,
		THREE.RGBFormat,
		THREE.UnsignedByteType
	);
	texture.needsUpdate = true;
	return texture;
}

ColorMap.prototype.drawColorScale = function(w, h, steps, orientation, canvas, invert)
{
	var minmax = this.getMinMax();
	var internalCanvas = canvas || document.createElement('canvas');
	if (!canvas)
	{
		internalCanvas.width = w;
		internalCanvas.height = h;
	}

	var context = internalCanvas.getContext('2d');
	var pixelStep = orientation == 'vertical' ? h / steps : w / steps;

	var x, y, dX, dY, ww, hh;
	if (orientation == 'vertical') {
		dX = 0;
		dY = -pixelStep;
		ww = w;
		hh = pixelStep;
		x = 0;
		y = h-pixelStep;
	}
	else
	{
		dX = pixelStep;
		dY = 0;
		ww = pixelStep;
		hh = h;
		x = 0;
		y = 0;
	}

	for (var i=0; i<steps; i++, x += dX, y += dY)
	{
		var v = (minmax[1]-minmax[0]) * ( (invert ? steps-1-i : i )/(steps-1)) + minmax[0];
		var c = this.mapValue(v);

		context.fillStyle = c.toString();
		context.fillRect(x, y, ww, hh);
	}

	return internalCanvas;
}

var COLOR_PRESETS = {

		greyscale: [
			[0, 0, 0],
			[255, 255, 255]
		],

		rainbow: [
			[0, 0, 255],
			[0, 255, 255],
			[0, 255, 0],
			[255, 255, 0],
			[255, 0, 0],
		],

		rainbowcie: [
			[0, 0, 255],
			[0, 255, 255],
			[0, 255, 0],
			[255, 255, 0],
			[255, 0, 0],
		],

		// a rainbow without greens
		rainbowcustomcie: [
			[0, 0, 255],
			[0, 255, 255],
			//[0, 255, 0],
			[255, 255, 0],
			[255, 0, 0],
		],

		cubehelix: [
			[0.000, 0.000, 0.000],
			[0.017, 0.006, 0.016],
			[0.032, 0.011, 0.033],
			[0.046, 0.018, 0.051],
			[0.059, 0.025, 0.070],
			[0.070, 0.032, 0.089],
			[0.080, 0.041, 0.109],
			[0.087, 0.050, 0.129],
			[0.094, 0.060, 0.150],
			[0.098, 0.071, 0.169],
			[0.102, 0.083, 0.188],
			[0.104, 0.095, 0.207],
			[0.104, 0.109, 0.224],
			[0.104, 0.123, 0.240],
			[0.103, 0.138, 0.254],
			[0.100, 0.153, 0.267],
			[0.098, 0.169, 0.279],
			[0.095, 0.186, 0.288],
			[0.092, 0.203, 0.296],
			[0.089, 0.221, 0.302],
			[0.086, 0.238, 0.306],
			[0.084, 0.256, 0.308],
			[0.083, 0.274, 0.308],
			[0.082, 0.291, 0.306],
			[0.083, 0.308, 0.303],
			[0.085, 0.325, 0.298],
			[0.089, 0.341, 0.292],
			[0.094, 0.357, 0.284],
			[0.101, 0.372, 0.276],
			[0.109, 0.386, 0.267],
			[0.120, 0.399, 0.257],
			[0.133, 0.412, 0.247],
			[0.147, 0.423, 0.237],
			[0.164, 0.434, 0.227],
			[0.183, 0.443, 0.217],
			[0.203, 0.451, 0.209],
			[0.225, 0.458, 0.201],
			[0.249, 0.464, 0.194],
			[0.275, 0.469, 0.189],
			[0.301, 0.473, 0.186],
			[0.329, 0.476, 0.184],
			[0.358, 0.478, 0.184],
			[0.388, 0.480, 0.186],
			[0.418, 0.481, 0.190],
			[0.449, 0.481, 0.197],
			[0.480, 0.480, 0.206],
			[0.511, 0.479, 0.218],
			[0.541, 0.478, 0.231],
			[0.571, 0.477, 0.247],
			[0.600, 0.476, 0.266],
			[0.628, 0.475, 0.286],
			[0.654, 0.474, 0.309],
			[0.679, 0.474, 0.334],
			[0.703, 0.474, 0.360],
			[0.725, 0.474, 0.388],
			[0.745, 0.476, 0.417],
			[0.763, 0.478, 0.447],
			[0.779, 0.481, 0.479],
			[0.793, 0.485, 0.511],
			[0.805, 0.490, 0.543],
			[0.815, 0.495, 0.575],
			[0.822, 0.503, 0.608],
			[0.828, 0.511, 0.639],
			[0.831, 0.520, 0.671],
			[0.833, 0.530, 0.701],
			[0.833, 0.542, 0.730],
			[0.832, 0.554, 0.758],
			[0.829, 0.568, 0.785],
			[0.825, 0.582, 0.810],
			[0.820, 0.597, 0.833],
			[0.814, 0.614, 0.854],
			[0.807, 0.630, 0.873],
			[0.800, 0.647, 0.890],
			[0.793, 0.665, 0.905],
			[0.786, 0.683, 0.918],
			[0.780, 0.702, 0.929],
			[0.774, 0.720, 0.937],
			[0.768, 0.738, 0.944],
			[0.764, 0.757, 0.949],
			[0.761, 0.775, 0.953],
			[0.759, 0.792, 0.954],
			[0.758, 0.809, 0.955],
			[0.759, 0.826, 0.954],
			[0.761, 0.842, 0.953],
			[0.765, 0.857, 0.950],
			[0.771, 0.872, 0.948],
			[0.779, 0.886, 0.945],
			[0.788, 0.898, 0.942],
			[0.798, 0.910, 0.939],
			[0.810, 0.922, 0.937],
			[0.824, 0.932, 0.936],
			[0.839, 0.941, 0.936],
			[0.855, 0.950, 0.937],
			[0.872, 0.958, 0.939],
			[0.890, 0.965, 0.942],
			[0.908, 0.972, 0.948],
			[0.927, 0.978, 0.954],
			[0.945, 0.984, 0.963],
			[0.964, 0.989, 0.974],
			[0.982, 0.995, 0.986],
			[0.9999, 0.9999, 0.9999]
		],


		singlehue: [
			[247,251,255],
			[222,235,247],
			[198,219,239],
			[158,202,225],
			[107,174,214],
			[66,146,198],
			[33,113,181],
			[8,81,156],
			[8,48,107]
		].reverse(),


		multihue: [
			[255,255,217],
			[237,248,177],
			[199,233,180],
			[127,205,187],
			[65,182,196],
			[29,145,192],
			[34,94,168],
			[37,52,148],
			[8,29,88],
		].reverse(),

		bodyheat: [
			[0, 0, 0, 0],
			[178, 34, 34, 0.39],
			[227, 105, 5, 0.58],
			[238, 210, 20, 0.84],
			[255, 255, 255, 1.0]
		],
		extendedBlackBody: [
			[0, 0, 0, 0],
			[0, 24, 168, 0.22],
			[99, 0, 228, 0.35],
			[220, 20, 60, 0.47],
			[255, 117, 56, 0.65],
			[238, 210, 20, 0.84],
			[255, 255, 255, 1.0]
		],


		// via G. Kindlemann
		kindlmann: [
			[0, 0, 0],
			[46, 4, 76],
			[63, 7, 145],
			[8, 66, 165],
			[5, 106, 106],
			[7, 137, 69],
			[8, 168, 26],
			[84, 194, 9],
			[196, 206, 10],
			[252, 220, 197],
			[255, 255, 255]
		],

		// via Color Brewer
		spectral: [
			[158,1,66],
			[213,62,79],
			[244,109,67],
			[253,174,97],
			[254,224,139],
			[255,255,191],
			[230,245,152],
			[171,221,164],
			[102,194,165],
			[50,136,189],
			[94,79,162]
		].reverse(),

		// via Moreland
		coolwarm: [
			[59	,	76	,	192],
			[68	,	90	,	204],
			[77	,	104	,	215],
			[87	,	117	,	225],
			[98	,	130	,	234],
			[108,	142	,	241],
			[119,	154	,	247],
			[130,	165	,	251],
			[141,	176	,	254],
			[152,	185	,	255],
			[163,	194	,	255],
			[174,	201	,	253],
			[184,	208	,	249],
			[194,	213	,	244],
			[204,	217	,	238],
			[213,	219	,	230],
			[221,	221	,	221],
			[229,	216	,	209],
			[236,	211	,	197],
			[241,	204	,	185],
			[245,	196	,	173],
			[247,	187	,	160],
			[247,	177	,	148],
			[247,	166	,	135],
			[244,	154	,	123],
			[241,	141	,	111],
			[236,	127	,	99],
			[229,	112	,	88],
			[222,	96	,	77],
			[213,	80	,	66],
			[203,	62	,	56],
			[192,	40	,	47],
			[180,	4	,	38]
		],

		puke: [

			[17.473974227905277, 48.686130586331785, -78.06569343065692, 0, 'lab'],
			[55.00000000000001, 54.562042995090906, -20.985401459854018, 0.16666666666666666, 'lab'],
			[71.99242609197442, -24.343066493960194, -31.897810218978123, 0.3333333333333333, 'lab'],
			[97.08333518288353, -15.948905910018581, 88.97810218978103, 0.5, 'lab'],
			[57.49999999999999, 71.35036416297413, 66.31386861313868, 0.6666666666666666, 'lab'],
			[47.47396945953369, 44.489050294360965, 52.88321167883212, 0.8333333333333334, 'lab'],
			[2.4739742279052734, 1.678831316258794, -5.875912408759135, 1, 'lab']
		],

		blueyellow: [
			[13, 0, 252],
			[190, 190, 190],
			[252, 252, 0]
		],

		viridis:
		[
			[72,		0,		84],
			[74,		1,		91],
			[76,		7,		96],
			[77,		14,		102],
			[78,		20,		107],
			[79,		26,		112],
			[80,		32,		116],
			[80,		37,		120],
			[80,		42,		124],
			[79,		48,		127],
			[79,		53,		130],
			[78,		58,		132],
			[77, 	63,		134],
			[75,		68,		136],
			[74,		72,		138],
			[72,		77,		139],
			[71,		82,		140],
			[69, 	86,		140],
			[67,		91,		141],
			[65,		95,		141],
			[64,		99,		142],
			[62,		103,	142],
			[60,		107,	142],
			[59,		111,	142],
			[57,		115,	142],
			[55,		119,	142],
			[54,		123,	142],
			[52,		127,	142],
			[50,		131,	142],
			[48, 	135,	142],
			[46,		138,	141],
			[44,		142,	141],
			[42,		146,	140],
			[39,		150,	139],
			[37, 	154,	138],
			[35,		158,	137],
			[34,		162,	135],
			[32,		166,	133],
			[32,		169,	131],
			[33,		173,	129],
			[35,		177,	126],
			[38,		181,	123],
			[42,		184,	120],
			[48,		188,	116],
			[54,		191,	112],
			[61,		195,	108],
			[69, 	198,	103],
			[78,		201,	98],
			[86,		204,	93],
			[96,		207,	87],
			[105,	210,	81],
			[115,	212,	74],
			[126,	215,	68],
			[136,	217,	60],
			[147,	219,	53],
			[158,	221,	45],
			[169,	223,	37],
			[180,	225,	28],
			[191,	226,	20],
			[202,	228,	12],
			[212,	229,	9],
			[223,	230,	11],
			[233,	231,	19],
			[243,	233,	28]
	
],

turbo: [[48,18,59],[50,21,67],[51,24,74],[52,27,81],[53,30,88],[54,33,95],[55,36,102],[56,39,109],[57,42,115],[58,45,121],[59,47,128],[60,50,134],[61,53,139],[62,56,145],[63,59,151],[63,62,156],[64,64,162],[65,67,167],[65,70,172],[66,73,177],[66,75,181],[67,78,186],[68,81,191],[68,84,195],[68,86,199],[69,89,203],[69,92,207],[69,94,211],[70,97,214],[70,100,218],[70,102,221],[70,105,224],[70,107,227],[71,110,230],[71,113,233],[71,115,235],[71,118,238],[71,120,240],[71,123,242],[70,125,244],[70,128,246],[70,130,248],[70,133,250],[70,135,251],[69,138,252],[69,140,253],[68,143,254],[67,145,254],[66,148,255],[65,150,255],[64,153,255],[62,155,254],[61,158,254],[59,160,253],[58,163,252],[56,165,251],[55,168,250],[53,171,248],[51,173,247],[49,175,245],[47,178,244],[46,180,242],[44,183,240],[42,185,238],[40,188,235],[39,190,233],[37,192,231],[35,195,228],[34,197,226],[32,199,223],[31,201,221],[30,203,218],[28,205,216],[27,208,213],[26,210,210],[26,212,208],[25,213,205],[24,215,202],[24,217,200],[24,219,197],[24,221,194],[24,222,192],[24,224,189],[25,226,187],[25,227,185],[26,228,182],[28,230,180],[29,231,178],[31,233,175],[32,234,172],[34,235,170],[37,236,167],[39,238,164],[42,239,161],[44,240,158],[47,241,155],[50,242,152],[53,243,148],[56,244,145],[60,245,142],[63,246,138],[67,247,135],[70,248,132],[74,248,128],[78,249,125],[82,250,122],[85,250,118],[89,251,115],[93,252,111],[97,252,108],[101,253,105],[105,253,102],[109,254,98],[113,254,95],[117,254,92],[121,254,89],[125,255,86],[128,255,83],[132,255,81],[136,255,78],[139,255,75],[143,255,73],[146,255,71],[150,254,68],[153,254,66],[156,254,64],[159,253,63],[161,253,61],[164,252,60],[167,252,58],[169,251,57],[172,251,56],[175,250,55],[177,249,54],[180,248,54],[183,247,53],[185,246,53],[188,245,52],[190,244,52],[193,243,52],[195,241,52],[198,240,52],[200,239,52],[203,237,52],[205,236,52],[208,234,52],[210,233,53],[212,231,53],[215,229,53],[217,228,54],[219,226,54],[221,224,55],[223,223,55],[225,221,55],[227,219,56],[229,217,56],[231,215,57],[233,213,57],[235,211,57],[236,209,58],[238,207,58],[239,205,58],[241,203,58],[242,201,58],[244,199,58],[245,197,58],[246,195,58],[247,193,58],[248,190,57],[249,188,57],[250,186,57],[251,184,56],[251,182,55],[252,179,54],[252,177,54],[253,174,53],[253,172,52],[254,169,51],[254,167,50],[254,164,49],[254,161,48],[254,158,47],[254,155,45],[254,153,44],[254,150,43],[254,147,42],[254,144,41],[253,141,39],[253,138,38],[252,135,37],[252,132,35],[251,129,34],[251,126,33],[250,123,31],[249,120,30],[249,117,29],[248,114,28],[247,111,26],[246,108,25],[245,105,24],[244,102,23],[243,99,21],[242,96,20],[241,93,19],[240,91,18],[239,88,17],[237,85,16],[236,83,15],[235,80,14],[234,78,13],[232,75,12],[231,73,12],[229,71,11],[228,69,10],[226,67,10],[225,65,9],[223,63,8],[221,61,8],[220,59,7],[218,57,7],[216,55,6],[214,53,6],[212,51,5],[210,49,5],[208,47,5],[206,45,4],[204,43,4],[202,42,4],[200,40,3],[197,38,3],[195,37,3],[193,35,2],[190,33,2],[188,32,2],[185,30,2],[183,29,2],[180,27,1],[178,26,1],[175,24,1],[172,23,1],[169,22,1],[167,20,1],[164,19,1],[161,18,1],[158,16,1],[155,15,1],[152,14,1],[149,13,1],[146,11,1],[142,10,1],[139,9,2],[136,8,2],[133,7,2],[129,6,2],[126,5,2],[122,4,3]],

		rainbowjet: [
			[  0,   0, 143],
			[  0,   0, 159],
			[  0,   0, 175],
			[  0,   0, 191],
			[  0,   0, 207],
			[  0,   0, 223],
			[  0,   0, 239],
			[  0,   0, 255],
			[  0,  15, 255],
			[  0,  31, 255],
			[  0,  47, 255],
			[  0,  63, 255],
			[  0,  79, 255],
			[  0,  95, 255],
			[  0, 111, 255],
			[  0, 127, 255],
			[  0, 143, 255],
			[  0, 159, 255],
			[  0, 175, 255],
			[  0, 191, 255],
			[  0, 207, 255],
			[  0, 223, 255],
			[  0, 239, 255],
			[  0, 255, 255],
			[ 15, 255, 239],
			[ 31, 255, 223],
			[ 47, 255, 207],
			[ 63, 255, 191],
			[ 79, 255, 175],
			[ 95, 255, 159],
			[111, 255, 143],
			[127, 255, 127],
			[143, 255, 111],
			[159, 255,  95],
			[175, 255,  79],
			[191, 255,  63],
			[207, 255,  47],
			[223, 255,  31],
			[239, 255,  15],
			[255, 255,   0],
			[255, 239,   0],
			[255, 223,   0],
			[255, 207,   0],
			[255, 191,   0],
			[255, 175,   0],
			[255, 159,   0],
			[255, 143,   0],
			[255, 127,   0],
			[255, 111,   0],
			[255,  95,   0],
			[255,  79,   0],
			[255,  63,   0],
			[255,  47,   0],
			[255,  31,   0],
			[255,  15,   0],
			[255,   0,   0],
			[239,   0,   0],
			[223,   0,   0],
			[207,   0,   0],
			[191,   0,   0],
			[175,   0,   0],
			[159,   0,   0],
			[143,   0,   0],
			[127,   0,   0]
		],
/*
		rainbowhcl: function(t) {
			return d3.rgb(d3.hcl(t * 360, 1, .5));
		}
*/
};
function isFunction(obj) {
	return !!(obj && obj.constructor && obj.call && obj.apply);
}



var loaded_colormaps = {};
function getColorPreset(preset, m0, m1)
{
	if (m0 === undefined || m0 === null || m1 === undefined || m1 === null) {
		m0 = 0;
		m1 = 1;
	}
	var len = m1-m0;

	var colorsets = COLOR_PRESETS;
	var colorScheme = colorsets[preset];
	var specialInterpolation = null;
	if (preset.indexOf('cie') > 0 || preset == 'greyscale') {
		specialInterpolation = 'lab';
	}
	else if (preset == 'blueyellow') {
		specialInterpolation = 'hsl';
	}


	if (!colorScheme)
	{
		console.error("Could not find preset: " + preset);
		return null;
	}
	else
	{
		var colorset;
		if (!isFunction(colorScheme))
		{
			colorset = [];
			for (var i=0, cLen = colorScheme.length; i<cLen; i++)
			{
				var v = len*(i/(cLen-1));
				var c = colorScheme[i];
				var scheme = null;

				if (c[3] === 'lab' || c[4] === 'lab')
				{
					scheme = {
						value: c.length > 3 && !isNaN(c[3]) ? c[3] : v,
						lab: [c[0], c[1], c[2]]
					};
				}
				else
				{
					// if fractional numbers, multiply by 255
					if (c[0] % 1 != 0) c[0] = Math.min(255, Math.floor(.5 + c[0] * 255));
					if (c[1] % 1 != 0) c[1] = Math.min(255, Math.floor(.5 + c[1] * 255));
					if (c[2] % 1 != 0) c[2] = Math.min(255, Math.floor(.5 + c[2] * 255));

					scheme = {
						value: c.length > 3 ? c[3] : v,
						rgb: [c[0], c[1], c[2]]
					};
				}

				colorset.push(scheme);
			}
		}
		else
		{
			colorset = colorScheme;
		}

		var preloaded = loaded_colormaps[preset];
		if (preloaded/* && preloaded.m0 == m0 && preloaded.m1 == m1*/) {
			return preloaded.colormap;
		}
		else
		{
			var newMap = new ColorMap(colorset, specialInterpolation);
			loaded_colormaps[preset] = {
				colormap: newMap,
				m0: m0,
				m1: m1
			};
			return newMap;
		}
	}
}

function drawColorPresets(svg, callback)
{
	var maxColorDiff = -Number.MAX_VALUE;
	var presets = [];
	for (var preset in COLOR_PRESETS)
	{
		if (COLOR_PRESETS.hasOwnProperty(preset))
		{
			var p = {
				name: preset,
				colorSet: COLOR_PRESETS[preset],
				colorMap: getColorPreset(preset),
			};

			// compute color differentials
			p.colorMap.computeColorDiff();
			maxColorDiff = Math.max(maxColorDiff, p.colorMap.maxColorDiff);

			// add to presets
			presets.push(p);
		}
	}
	console.log("max E: " + maxColorDiff);

	// scale color diffrentials according to max
	for (var i=0; i<presets.length; i++) {
		presets[i].colorMap.scaleColorDiff(maxColorDiff);
	}

	var PRESET_H = 15;
	var PRESET_W = 120;
	var PRESET_OFFSET = 5;

	svg.selectAll('image').data(presets).enter().append('image')
		.attr('width', PRESET_W)
		.attr('height', PRESET_H)
		.attr('x', 0)
		.attr('y', function(d, i) { return i *(PRESET_OFFSET + PRESET_H) })
		.attr('xlink:href', function(d, i) {
			var canvas = d.colorMap.drawColorScale(PRESET_W, PRESET_H, Math.floor(.5+PRESET_W/2), 'horizontal');
			return canvas.toDataURL();
		})
		.on('click', function(d) {
			if (callback) {
				callback(getColorPreset(d.name));
			}
		});
}

var TWO_PI = 2*Math.PI;
var SIX = 6*Math.PI/180;
var TWENTY_FIVE = 25 * Math.PI/180;
var THIRTY = 30*Math.PI/180;
var SIXTY = 2 * THIRTY;
var SIXTY_THREE = SIXTY + SIX/2;
var TWO_SEVENTY_FIVE = 275 * Math.PI/180;

var C25 = Math.pow(25, 7);

function cie76Diff(c1, c2)
{
	return Math.sqrt(
		Math.pow(c1.l-c2.l, 2) + Math.pow(c1.a-c2.a, 2) + Math.pow(c1.b-c2.b, 2)
	);
}

function cie2000Diff(c1, c2)
{
	// lightness
	var L1 = c1.l;
	var L2 = c2.l;
	var dL = L2 - L1;

	var a1 = c1.a, a2 = c2.a;
	var b1 = c1.b, b2 = c2.b;

	var b1_2 = Math.pow(b1, 2);
	var b2_2 = Math.pow(b2, 2);

	// chroma
	var C1 = Math.sqrt(Math.pow(a1,2) + b1_2);
	var C2 = Math.sqrt(Math.pow(a2,2) + b2_2);


	var L = .5 * (L1 + L2); //if (L1>0 && L2>0) L /= 2;
	var C = .5 * (C1 + C2); //if (C1>0 && C2>0) C /= 2;
	var C7   = Math.pow(C , 7);

	// (delcared globally) var C25  = Math.pow(25, 7);
	var C725 = Math.sqrt(C7/(C7+C25));

	var a1_ = a1 + .5 * a1 * (1 - C725);
	var a2_ = a2 + .5 * a2 * (1 - C725);

	var C1_ = Math.sqrt(Math.pow(a1_, 2) + b1_2);
	var C2_ = Math.sqrt(Math.pow(a2_, 2) + b2_2);
	var C_  = .5 * (C1_ + C2_); //if (C1_>0 && C2_>0) C_ /= 2;
	var dC = C2_ - C1_;

	// compute hue angle diffrentials
	var dh, dH, H;

	var h1 = Math.atan2(b1, a1_) % TWO_PI;
	var h2 = Math.atan2(b2, a2_) % TWO_PI;

	// note: an indeterminate atan2 happens when both b and a are 0
	// In this case, the Math.atan2 returns 0, which is what is assumed in the following
	// calculations
	var h21 = h2 - h1;

	if (C1_ == 0 || C2_ == 0) {
		dh = 0;
		dH = 0;
		//console.log("dH is 0");
	}
	else
	{
		dh = (Math.abs(h21) <= Math.PI ? h21 : (h2<=h1 ? h21+TWO_PI : h21-TWO_PI));
		dH = 2 * Math.sqrt(C1_ * C2_) * Math.sin(.5 * dh);
	}

	if (Math.abs(h21) <= Math.PI) {
		H = h1 + h2;
	}
	else if (h1+h2 < TWO_PI)
	{
		H = h1 + h2 + TWO_PI;
	}
	else
	{
		H = h1 + h2 - TWO_PI;
	}

	if (C1_ != 0 || C2_ != 0) {
		H *= .5;
	}

	var T = 1 -
		0.17 * Math.cos(H - THIRTY) +
		0.24 * Math.cos(2*H) +
		0.32 * Math.cos(3*H + SIX) -
		0.20 * Math.cos(4*H - SIXTY_THREE);

	var L50 = Math.pow(L - 50, 2);
	var SL = 1 + 0.015 * L50 / (Math.sqrt(20 + L50));
	var SC = 1 + 0.045 * C_;
	var SH = 1 + 0.015 * C_ * T;

	var expH = Math.pow( (H - TWO_SEVENTY_FIVE) / TWENTY_FIVE, 2);
	var RT =
		-2 * C725 *
		Math.sin(SIXTY * Math.exp( -expH ));

	var dCSC = dC/SC;
	var dHSH = dH/SH;

	var deltaE00_2 =
		Math.pow(dL/SL,2) +
		Math.pow(dCSC, 2) +
		Math.pow(dHSH, 2) +
		RT * dCSC * dHSH;

	return Math.sqrt(deltaE00_2);
}
