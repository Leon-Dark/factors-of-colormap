
var ATTEMPTS = 8;
var TRIALS0 = 15;
var TRIALS = 15;

var TOLERANCE = .07;
var TOLERANCE_INTERCEPT = 0.035;
var HIST_BIN = 10;

// different types of noise functions to choose from
var NOISE_TYPE_PERLIN = 1;
var NOISE_TYPE_SIMPLEX = 2;
var NOISE_TYPE_TERRAIN = 3;
var NOISE_TYPE_SIGMOID = 4;
var NOISE_TYPE_DISPLACEMENT = 5;

var LOW_GRADIENT = 1.5;
var MED_GRADIENT = 2.5;
var HI_GRADIENT = 5.0;
var DIFF = [0.1, 14.0];

var noiseType = NOISE_TYPE_SIMPLEX;

// terrain noise generator
var terrain = null;

function printTimeDiff(timeStart, timeEnd, label)
{
	var elapsed = timeEnd - timeStart;
	var sec=0, milli=0;
	if (elapsed > 1000) {
		sec = Math.floor(elapsed / 1000); 
		milli = elapsed % 1000;
	} else {
		sec = 0;
		milli = elapsed;
	}
	console.log( (label ? label+": " : "time: ") + sec + " sec, " + milli + " milli");
}


function genericNoiseFunction(_scalarField, targetScale)
{
	switch (noiseType)
	{
	case NOISE_TYPE_SIMPLEX:
		makeNoise(_scalarField, targetScale);
		break;

	case NOISE_TYPE_TERRAIN:
		terrain = new Terrain(Math.log2(_scalarField.w-1), _scalarField.view);
		terrain.generate(targetScale*100);
		_scalarField.normalize();
		break;

	case NOISE_TYPE_DISPLACEMENT:


	}
}

function TAFC(width, height)
{
	this.width = width;
	this.height = height;

	this.stim1 = new ScalarField(width, height);
	this.stim2 = new ScalarField(width, height);

	this.stim1.setMask([width, height]);
	this.stim2.setMask([width, height]);

	// shuffle image position?
	this.shuffle = false;
	this.swaped = false;
}

TAFC.prototype.shuffleImagePosition = function() {
	this.shuffle = true;
}

TAFC.prototype.isSwaped = function() {
	return this.swaped;
}

TAFC.prototype.randomStimulusThreaded = function(targetScale, diff, ksThreshold, callback)
{
	(function(tafc, _targetScale, _diff, _ksThreshold, _callback) 
	{
		var w = tafc.stim1.w;
		var h = tafc.stim1.h;
		tafc.swaped = false;

		var worker = new Worker('src/threaded_noisegen.js');
		worker.onmessage = function(msg) 
		{
			var results = msg.data;

			if (tafc.shuffle && Math.random() > .5)
			{
				tafc.stim1.buffer = results.stim2Buffer;
				tafc.stim1.view = new Float32Array(results.stim2Buffer);
				tafc.stim2.buffer = results.stim1Buffer;
				tafc.stim2.view = new Float32Array(results.stim1Buffer);

				tafc.swaped = true;
			}
			else
			{
				tafc.stim1.buffer = results.stim1Buffer;
				tafc.stim1.view = new Float32Array(results.stim1Buffer);
				tafc.stim2.buffer = results.stim2Buffer;
				tafc.stim2.view = new Float32Array(results.stim2Buffer);
			}

			tafc.stim1.generated = true;
			tafc.stim2.generated = true;
			
			tafc.stim1.updated();
			tafc.stim2.updated();

			// clear out references to buffers (not needed)
			results.stim1Buffer = undefined;
			results.stim2Buffer = undefined;
			
			callback(results);
		}

		
		worker.postMessage({
			w: w,
			h: h,
			exponentWeight: getExponentWeight(),
			targetScale: _targetScale,
			diff: _diff,
			ksThreshold: _ksThreshold,

			// iteration parameters
			TRIALS: TRIALS,
			TRIALS0: TRIALS0,
			TOLERANCE: TOLERANCE,
			TOLERANCE_INTERCEPT: TOLERANCE_INTERCEPT,
			ATTEMPTS: ATTEMPTS
		});
		

	})(this, targetScale, diff, ksThreshold, callback);
}

TAFC.prototype.randomStimulus = function(targetScale, diff, ksThreshold)
{
	var timeStart = Date.now();
	function sign(x) { if (x >= 0) return 1; else return -1; }

	this.swaped = false;
	var done = false;
	var minDiff = Number.MAX_VALUE;
	var maxDiff = Number.MIN_VALUE;
	
	var actualDiff;
	var tolerance = Math.abs(diff * TOLERANCE) + TOLERANCE_INTERCEPT;
	var g1, g2;

	// TODO: randomize the position of the target
	var iterations = 0;
	for (var longIt=0; longIt<TRIALS0 && !done; longIt++)
	{
		seedNoise();
		setNoiseOffset(Math.random() * 10000, Math.random() * 10000);
		genericNoiseFunction(this.stim1, targetScale);

		g1 = calcAvgGradient(this.stim1);

		for (var shortIt=0; shortIt<TRIALS && !done; shortIt++, iterations++)
		{
			seedNoise();
			setNoiseOffset(Math.random() * 10000, Math.random() * 10000);

			var K_RANGE = [.1,.1];
			var k = Math.random() * (K_RANGE[1]-K_RANGE[0]) + K_RANGE[1];
			genericNoiseFunction(this.stim2, targetScale+diff*k);

			// compute difference between the two stimuli
			g2 = calcAvgGradient(this.stim2);

			actualDiff = g2-g1;

			minDiff = Math.min(actualDiff, minDiff);
			maxDiff = Math.max(actualDiff, maxDiff);

			var delta = actualDiff-diff
			if (Math.abs(delta) <= tolerance && sign(actualDiff) == sign(diff))
			{
				done = true;
				/*
				if (sign(actualDiff) != sign(diff)) 
				{
					// flip
					console.log("flip!!!!!");
					var temp = this.stim1;
					this.stim1 = this.stim2;
					this.stim2 = temp;

					temp = g1;
					g1 = g2;
					g2 = temp;
				}
				*/
			}

			if (done && ksThreshold !== undefined && ksThreshold != 0.0) 
			{
				// copy views
				var view1 = this.stim1.copyView();
				var view2 = this.stim2.copyView();

				var ksRes = KS_test(view1, view2);
				if (ksRes.maxD > ksThreshold) {
					done = false;
				}
			}
		}
	}
	//printTimeDiff(timeStart, Date.now(), "gen time");


	// calculate amplitudes
	timeStart = Date.now();
	this.stim1Dist = this.stim1.calcAmplitudeFrequency(HIST_BIN);
	this.stim2Dist = this.stim2.calcAmplitudeFrequency(HIST_BIN);

	//chiSqured(this.stim1Dist, this.stim2Dist, this.width * this.height);

	if (done) 
	{
		console.log('** base: ' + g1.toFixed(2) + ', actualDiff: ' + actualDiff.toFixed(3) + ", req: " + diff.toFixed(3) + ", converged: " + iterations);
		return {
			actualDiff: actualDiff,
			requestedDiff: diff,
			iterations: iterations,
			success: true
		};
	
	}
	else
	{
		console.warn("could not converge. min Diff rached: " + minDiff);
		return {
			requestedDiff: diff,
			minDiff: diff,
			iterations: iterations,
			success: false
		};
	}
}

TAFC.prototype.getFirst = function() {
	return this.stim1;
};


TAFC.prototype.getSecond = function() {
	return this.stim2;
};

TAFC.prototype.getFirstDist = function() {
	return this.stim1Dist;
}

TAFC.prototype.getSecondDist = function() {
	return this.stim2Dist;
}

var KS_lookup_i = 0;
var KS_field = null;

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
		console.log("maxD: " + maxD + ", critical: " + critical);
		
		return {
			maxD: maxD, valueAtMax: maxValue,
			field1: o1, field2: o2
		};

	}
}

var cummP = 0;
function plotQQ(svg, w, h, field1, field2, index)
{
	var W = w;
	var H = h;

	var lineGenerator = d3.line()
		.x(function(d, i) { return d*W; })
		.y(function(d, i) { 
			var out = cummP;
			cummP += 1/field1.length; 
			return (1-out)*H;
		});

	svg.selectAll('path').remove();

	var xScale = d3.scaleLinear().domain([0,1]).range([0, W]);
	var yScale = d3.scaleLinear().domain([0, 100]).range([H, 0]);
	var xAxis = d3.axisBottom(xScale); svg.append('g')
		.style('font-size', 8)
		.attr('transform', 'translate(0,' + H + ')').call(xAxis);
		
	var yAxis = d3.axisLeft(yScale); svg.append('g')
		.style('font-size', 8)
		.call(yAxis);

	cummP = 0;
	svg.append('path')
		.attr('d', lineGenerator(field1))
		.attr('class', 'red')
		.style('fill', 'none').style('stroke', 'red')
		.style('stroke-width', '1px')

	
	cummP = 0;
	svg.append('path')
		.attr('d', lineGenerator(field2))
		.attr('class', 'blue')
		.style('fill', 'none').style('stroke', 'blue')
		.style('stroke-width', '1px')
	
	if (index)
	{
		svg.append('line')
			.style('stroke-width', '0.5px').style('stroke', '#888888')
			.attr('y1', 0).attr('y2', H)
			.attr('x1', index*W).attr('x2', index*W);
	}
}


function chiSqured(d1, d2, stimSize)
{
	var CHI_CRITICAL_95 =  [3.841,  5.991,  7.815,  9.488, 1.070,  12.592,  14.067,  15.507,  16.919,  18.307,  19.675,  21.026,  22.362,  23.685,  24.996,  26.296,  27.587,  28.869,  30.144,  31.410,  32.671,  33.924,  35.172,  36.415,  37.652,  38.885,  40.113,  41.337,  42.557,  43.773,  44.985,  46.194,  47.400,  48.602,  49.802,  50.998,  52.192,  53.384,  54.572,  55.758,  56.942,  58.124,  59.304,  60.481,  61.656,  62.830,  64.001,  65.171,  66.339,  67.505,  68.669,  69.832,  70.993,  72.153,  73.311,  74.468,  75.624,  76.778,  77.931,  79.082,  80.232,  81.381,  82.529,  83.675,  84.821,  85.965,  87.108,  88.250,  89.391,  90.531,  91.670,  92.808,  93.945,  95.081,  96.217,  97.351,  98.484,  99.617, 100.749, 101.879, 103.010, 104.139, 105.267, 106.395, 107.522, 108.648, 109.773, 110.898, 112.022, 113.145, 114.268, 115.390, 116.511, 117.632, 118.752, 119.871, 120.990, 122.108, 123.225, 124.342, 124.342
	];

	var dTotal = [], pTable = [];
	var bins = d1.length;

	for (var i=0; i<bins; i++) 
	{
		dTotal.push(d1[i] + d2[i]);

		//pTable.push(dTotal[i] / (stimSize*2));
		pTable.push(d1[i] / stimSize)
	}
	var table = [ d1, d2 ];

	var chiStat = 0;
	for (var i=0; i < bins; i++)
	{
		var p = pTable[i];
		for (var s=1; s<2; s++)
		{
			var observed = table[s][i];
			var e = stimSize * p;

			var k = Math.pow(observed - e, 2) / e;
			chiStat += k;
		}
	}

	var dof = bins-1;
	//console.log("$ chiStat: " + chiStat + ", critical[" + dof + "]: CHI_CRITICAL_95[dof-1]");

	if (CHI_CRITICAL_95[dof-1] < chiStat) {
		console.log("chiStat: " + chiStat + ", critical[" + dof + "]: " + CHI_CRITICAL_95[dof-1]);
		return true;
	}
	else {
		return false;
	}
}

function calcAvgGradient(field)
{
	var stats = field.getSubregionStats(0, 0, STIM_W, STIM_H);
	return stats.steepness;
}

