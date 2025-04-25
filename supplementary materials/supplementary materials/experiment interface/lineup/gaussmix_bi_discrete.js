var globalMapData = null;
var USE_GLOBAL_MAP_DATA = true;
var ENABLE_SPLAT = true;
var HIST_EQUALIZE = true;

function matrixFromArray(arr)
{
	var matrixSize = arr.length * Int32Array.BYTES_PER_ELEMENT;
	var matrix = new Int32Array(new ArrayBuffer(matrixSize));
	for (var i=0, len=arr.length; i<len; i++) {
		matrix[i] = arr[i];
	}
	return matrix;
}

function mapFromArray(arr)
{
	var aMap = {};
	for (var i=0, len=arr.length; i<len; i++) {
		aMap[i] = arr[i];
	}
	return aMap;
}

function loadGlobalMapData(mapData)
{
	globalMapData = 
	{
		pixelMap: mapData.pixelMap,
		listOfBins: mapData.listOfBins,
		areas: mapData.areas,
		minArea: mapData.minArea,
		maxArea: mapData.maxArea,
		width: mapData.width,
		height: mapData.height,

		// bin size (for heatmaps)
		binSize: mapData.binSize
	}
}

function DiscreteMap(mapData)
{
	if (USE_GLOBAL_MAP_DATA && globalMapData)
	{
		this.width = globalMapData.width;
		this.height = globalMapData.height;

		this.pixelMap = globalMapData.pixelMap;
		this.listOfBins = globalMapData.listOfBins;
		this.areas = globalMapData.areas;
		this.minArea = globalMapData.minArea;
		this.maxArea = globalMapData.maxArea;
	}
	else if (mapData)
	{
		this.width = mapData.width;
		this.height = mapData.height;

		this.pixelMap = mapFromArray(mapData.pixelMap);
		this.listOfBins = mapData.listOfBins;
		this.areas = mapData.areas;

		// scan to determine mim/max area
		this.minArea = Number.MAX_VALUE;
		this.maxArea = Number.MIN_VALUE;

		for (var i=0; i< this.listOfBins.length; i++)
		{
			var bin = this.listOfBins[i]
			var a = this.areas[bin];
			if (a > 0) 
			{
				this.minArea = Math.min(a, this.minArea);
				this.maxArea = Math.max(a, this.maxArea);
			}
		}

		if (USE_GLOBAL_MAP_DATA) 
		{
			loadGlobalMapData(mapData);
		}
	}
	else
	{
		console.log("error: no map data provided");
	}
	
	this.binMap = {};
	this.zeroBinMap();
}

DiscreteMap.prototype.zeroBinMap = function() 
{
	var listOfBins = this.listOfBins;
	var totalBins = this.totalBins || listOfBins.length;
	var binMap = this.binMap;

	for (var i=0, len=totalBins; i<len; i++) 
	{
		var I = listOfBins ? listOfBins[i] : i;
		binMap[I] = 0.0;
	}
}

DiscreteMap.prototype.normalize = function()
{
	this.lowCutoff = 0.0;
	this.highCutoff = 1.0;

	var listOfBins = this.listOfBins;
	var totalBins = this.totalBins || listOfBins.length;
	var binMap = this.binMap;
	var maxDensity = 0.0;
	var areas = this.areas;

	for (var i=0, len=totalBins; i<len; i++) 
	{
		var I = listOfBins ? listOfBins[i] : i;

		//binMap[I] *= 1/Math.pow(this.areas[I], 1);
		if (areas) {
			binMap[I] *= 1/areas[I];
		}
		maxDensity = Math.max(maxDensity, binMap[I]);
	}

	if (maxDensity > 0) 
	{
		var k = 1 / maxDensity;
		for (var i=0, len=totalBins; i<len; i++) 
		{
			var I = listOfBins ? listOfBins[i] : i;
			binMap[I] *= k;
		}
	}

	if (HIST_EQUALIZE) {
		this.percentileCutoff();
	}
}

DiscreteMap.prototype.computeValueHistogram = function(_bins)
{
	var low = this.lowCutoff;
	var high = this.highCutoff;
	var lowHighLen = 1/(high-low);

	var BINS = _bins || 30;
	var hist = [];
	for (var b=0; b<BINS; b++) {
		hist.push(0);
	}

	var listOfBins = this.listOfBins;
	var values = this.binMap;
	var areas = this.areas;

	for (var i=0, len=listOfBins.length; i<len; i++) 
	{
		var I = listOfBins ? listOfBins[i] : I;
		var v = values[I];
		
		if (v > high) 
		{
			v = 1;
		} else if (v < low) {
			v = 0;
		}
		else
		{
			v = (v-low) * lowHighLen;
		}
		var b = Math.min(BINS-1, Math.floor(v*(BINS-1)));
		hist[b] += areas ? areas[I] : 1;
	}
	return hist;
}

DiscreteMap.prototype.percentileCutoff = function()
{
	var CUTOFF_PERCENT_LOW = .01/4;
	var CUTOFF_PERCENT_HIGH = 1-0.01/4;

	var histogram = [];
	var listOfBins = this.listOfBins;
	var totalBins = this.totalBins || listOfBins.length;
	var binMap = this.binMap;

	for (var i=0, len=totalBins; i<len; i++) 
	{
		var bin = listOfBins ? listOfBins[i] : i;
		histogram.push({bin: bin, v: binMap[bin]});
	}

	histogram.sort(function(a, b) { return a.v-b.v; });
	
	var L = Math.max(
		0, 
		Math.ceil(histogram.length * CUTOFF_PERCENT_LOW)
	);

	var H = Math.min(
		histogram.length-1, 
		Math.floor(histogram.length * CUTOFF_PERCENT_HIGH)
	);

	//this.histogram = histogram;
	this.lowCutoff = histogram[L].v;
	this.highCutoff = histogram[H].v;
}

DiscreteMap.prototype.visTheMap = function(_svg, colormap, selection)
{
	return (function(svg, binMap, L, H) 
	{
		if (svg.selectAll === undefined) {
			svg = d3.select(svg);
		}
		
		if (!selection) {
			selection = svg.selectAll('.choroplethBin');
		}
		
		selection
			.style('fill', function(d)
			{
				var me = d3.select(this);
				var id = d.id;
				var value = binMap[id];
				if (value === null || value === undefined) {
					value = binMap[+id];
				}

				if (value != null && value != undefined) 
				{
					value = Math.max(Math.min(H, value), L);
					var nValue = (value-L) / (H-L);
					var color = colormap.mapValue(nValue);
					return color;
				}
				else 
				{
					return null;
				}
			});
		
		return selection;

	})(_svg, this.binMap, this.lowCutoff, this.highCutoff)
}

DiscreteMap.prototype.mapPixel = function(i, r, c)
{
	return this.pixelMap[i];
}

DiscreteMap.prototype.hasPixel = function(i, r, c)
{
	return this.pixelMap[i] > 0;
}


DiscreteMap.prototype.mapAndIncrementPixel = function(i, r, c, value)
{
	var bin = this.mapPixel(i, r, c);
	if (bin > 0) 
	{
		this.binMap[bin] += value;
		return true;
	}
	else
	{
		return false;
	}
}

function HeatMap(d)
{
	if (USE_GLOBAL_MAP_DATA) {
		this.width = globalMapData.width;
		this.height = globalMapData.height;
		this.binSize = globalMapData.binSize;
	}
	else
	{
		this.width = d.width;
		this.height = d.height;
		this.binSize = d.binSize;
	}

	this.binCount = [
		Math.floor(.5 + this.width  / this.binSize[0]),
		Math.floor(.5 + this.height / this.binSize[1])
	];

	// reconfig binSize
	this.binSize = [
		this.width / this.binCount[0],
		this.height / this.binCount[1]
	];
	this.totalBins = this.binCount[0] * this.binCount[1];
	this.binMap = []; 
	
	for (var i=0; i<this.totalBins; i++) {
		this.binMap.push(0);
	}
	
	this.rectSelections = {};

}

HeatMap.prototype = Object.create(DiscreteMap.prototype);

HeatMap.prototype.mapPixel = function(i, r, c)
{
	var binSize = this.binSize;
	var binCount = this.binCount;
	
	var R = Math.floor(r/binSize[1]); //Math.floor(i / w);

	var C = Math.floor(c/binSize[0]);   //Math.floor((i-r*w) / binSize[0]);

	return R*binCount[0] + C;
}

HeatMap.prototype.hasPixel = function(i, r, c)
{
	// by definition, a heat map encompases the entire domain
	return true;
}

HeatMap.prototype.mapAndIncrementPixel = function(i, r, c, value)
{
	var bin = this.mapPixel(i, r, c);
	this.binMap[bin] += value;
	return true;
}

HeatMap.prototype.visTheMap = function(svg, colormap, selection)
{
	return (function(heatmap, binMap, L, H) 
	{
		if (!svg.selectAll) {
			svg = d3.select(svg);
		}
		
		// check if there's an existing selection
		if (!selection) 
		{
			var rects = svg.selectAll('rect.heatmap')
				.data(binMap)
			
			// create rectangles
			var newrects = rects.enter().append('rect');
			newrects.each(function(d, i) 
			{
				var y = Math.floor(i/heatmap.binCount[0]);
				var x = i-y*heatmap.binCount[0];

				d3.select(this)
					.attr('x', x*heatmap.binSize[0])
					.attr('y', y*heatmap.binSize[1])
					.attr('width', heatmap.binSize[0])
					.attr('height', heatmap.binSize[1])
					.style('stroke', 'none');
			});

			// create a new selection and use it
			selection = newrects;
		}

		selection
			.style('fill', function(d, i) 
			{
				// d should be equal to heatmap.binMap[i]
				value = Math.max(Math.min(H, binMap[i]), L);
				
				var nValue = (value-L) / (H-L);
				var color = colormap.mapValue(nValue);
				return color;
			});
		return selection;

	})(this, this.binMap, this.lowCutoff, this.highCutoff);

	return outSelection;
}


function GaussMixBiDiscrete(w, h, svg, dMapData)
{
	var mapType = DiscreteMap;
	if (typeof DISCRETE_TYPE !== 'undefined')
	{
		mapType = DISCRETE_TYPE;
	}
	this.discreteMap = new mapType(dMapData);

	GaussMixBivariate.call(this, w, h, svg)

	// make sure the size of the discreteMap matches up
	// with <w, h>
	if (w != this.discreteMap.width || h != this.discreteMap.height) {
		console.error("Error: sizes of discreteMap and GuassMixDiscrete are not the same.")
	}
}

GaussMixBiDiscrete.prototype = Object.create(GaussMixBivariate.prototype);


GaussMixBiDiscrete.prototype.computeCDFs = function()
{
    var w = this.w;
    var h = this.h;
    var models = this.models;
    var mCount = models.length;
    var discreteMap = this.discreteMap;
    var pixelMap = this.discreteMap.pixelMap;


    // compute PDF / CDF
    var cummDensity = 0, maxDensity = 0, minDensity=Number.MAX_VALUE;

    // clear out
    this.pdf.zero();
    this.cdf.zero();

    var pdf = this.pdf.view;
    var cdf = this.cdf.view;

    // loop through all rows / columns
    for (var r=0, I=0; r<h; r++)
    {
        for (var c=0; c<w; c++, I++)
        {

            // evaluate density of all models
            var P=0;
            if (discreteMap.hasPixel(I, r, c)) {

	            for (var m=0; m<mCount; m++)
	            {
	                var model = models[m];
	                P += model.eval(c, r);
	            }
	            // To force a uniform distribution (for testing):
	            //P = Math.random();//1/(w*h);

	            if (P > maxDensity) {
	                maxDensity = P;
	            }
	            if (P < minDensity) {
	                minDensity = P;
	            }
	        }

            cummDensity += P;
            pdf[I] = P;
            cdf[I] = cummDensity;
        }
    }

    this.maxDensity = maxDensity;
    this.minDensity = minDensity;
    this.cummDensity = cummDensity;

    // construct map
    this.updateCDFMap = true;
}

GaussMixBiDiscrete.prototype.sampleModel = function(iterations, _field, fieldUpperPercentile)
{
	var discreteMap = this.discreteMap;
    var pdf = this.pdf.view;

    if (this.updateCDFMap) {
        /*
        (function(model, _discreteMap) 
        {
        	model.computeCDFMap(function(I) { return _discreteMap.mapPixel(I); });
        })(this, this.discreteMap);
        */
        this.computeCDFMap();
    }

    var SPLAT_AREA=(SPLAT_SIZE*2+1)*(SPLAT_SIZE*2+1);
    var splat = [];
    for (var j=0;j<SPLAT_AREA; j++) {
        splat.push(0);
    }

    var w = this.w;
    var h = this.h;
    var w_1 = w-1;
    var h_1 = h-1;

    var cdf = this.cdf.view;
    var cdfMap = this.cdfMap;
    var cdfLen = cdfMap.length;

    // reset the discrete map
    var discreteMap = this.discreteMap;
    discreteMap.zeroBinMap();


    // reset scalar field with zeros
    //_field.zeroLeaveEmpty();
    var view = _field ? _field.view : null;
    
    if (_field)
    {
    	// clear out unused pixels in the scalar field
    	// (i.e., areas that lie outside the discrete map boundaries)
	    if (!_field.emptyMarked) 
	    {
	    	var empty = SCALAR_EMPTY;
		    for (var r=0, c=0, i=0, len=view.length; i<len; i++, c++) 
		    {
		    	if (!discreteMap.hasPixel(i, r, c))
		    	{
		    		view[i] = empty;
		    	}
		    	else
		    	{
		    		view[i] = 0.0;
		    	}

		    	if (c==w) {
		    		c=0;
		    		r++;
		    	}
		    }
		    _field.emptyMarked = true;
		}
		else
		{
			_field.zeroLeaveEmpty();
		}
	}

    // iterate
    for (var i=0; i<iterations; i++)
    {
        // find center of splat
        var I = cdfMap[ Math.floor(Math.random() * cdfLen) ];

        // convert to row, column coordinate
        //var C = I % w;
        var R = Math.floor(I/w);
        var C = I- R*w;

        
        // SPLAT
        // =====
	    // find splat boundary
        var R0 = Math.max(0, R-SPLAT_SIZE), R1 = Math.min(h_1, R+SPLAT_SIZE);
        var C0 = Math.max(0, C-SPLAT_SIZE), C1 = Math.min(w_1, C+SPLAT_SIZE);
        var cummP=0;

        // compute total density at this splat
        for (var k=0, r=R0; r<=R1; r++)
        {
            for (var c=C0; c<=C1; c++, k++)
            {
                var p = cdf[r*w + c];
                splat[k] = p;
                cummP += p;
            }
        }
        cummP = 1/cummP;

        // distribute density throughout the splat according to the PDF
        for (var k=0, r=R0; r<=R1; r++)
        {
            for (var c=C0; c<=C1; c++, k++)
            {
            	var pixel = r*w + c;
            	
            	var s = splat[k] * cummP;
            	var updated = discreteMap.mapAndIncrementPixel(pixel, r, c, s);
            	if (updated && view) {
            		view[ pixel ] += s;
            	}
            }
        }
        

        /*
        // OR a single hit, as opposed to a splat
        // ======================================
        var pixel = R*w + C;
        var updated = discreteMap.mapAndIncrementPixel( pixel, R, C, 1 );
        if (updated && view) 
        {
        	view[pixel] += 1;
        }
        */

        
    }

    // normalize discrete map / field
    discreteMap.normalize();

    if (_field) 
    {
    	if (fieldUpperPercentile) {
    		_field.normalizeToPercentile(fieldUpperPercentile)
    	}
    	else
    	{
    		_field.normalize();
    	}
    }
}



