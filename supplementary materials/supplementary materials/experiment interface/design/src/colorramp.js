var RAMP_W = 230;
var RAMP_H = 30;
var RAMP_OFF_X = 80;
var RAMP_OFF_Y = 100;

var PATCH_W = 15;
var PATCH_H = 15;
var PATCH_GAP = 4;
var PATCH_OFF_X = -60
var PATCH_OFF_Y = 30;

var PLOT_H = 40;
var PLOT_OFFSET = 5;
var CONTROL_R = 4;

// number of samples to take in the computinglor ramp 
// when computing difference
var DIFF_SAMPLES = 50;

// size of local speed window and number of samples
var LOCAL_SPEED_W = .1;
var LOCAL_SPEED_S = 20*2;

// allow more leeway in tuning lightning
var PERMISSIVE_L_TUNING = false;

function ColorRamp(_colors, _svg, _colorPicker)
{
	this.colors = _colors || 
	[
		// default is black / white ramp interpolated in LAB space 
		{
			value: 0.0,
			lab: [15, 0, 0]
		}, 

		{
			value: 1.0,
			lab: [80, 0, 0] 
		}
	];

	this.colormap = null;
	this.svg = _svg;

	// create structure for the SVG
	var g = this.svg.append('g');
	g.attr('transform', 'translate(' + RAMP_OFF_X + ',' + RAMP_OFF_Y + ')');
	this.g = g;

	// create an image to be used to render the colormap onto
	(function(ramp) {
		ramp.colorRampImage = g.append('image')
			.attr('width', RAMP_W + "px").attr('height', RAMP_H + 'px')
			.on('mousemove', function() 
			{
				var m = d3.mouse(this);
				var t = m[0]/RAMP_W;
				var color = ramp.colormap.mapValue(t, true);
				if (color) {
					ramp.colorPicker.brushColor(color);
				}

				// callbacks
				for (var i=0, len=ramp.callbacks.length; i<len; i++) {
					var c = ramp.callbacks[i];
					if (c.type == 'brushRamp') {
						c.callback(t, color);
					}
				}
			})
			.on('mouseout', function() {
				ramp.colorPicker.brushColor(null);
				for (var i=0, len=ramp.callbacks.length; i<len; i++) {
					var c = ramp.callbacks[i];
					if (c.type == 'brushRamp') {
						c.callback(-1);
					}
				}
			})
	})(this)

	this.connectionLines = g.append('g');
	var controlPoints = g.append('g')
		.attr('transform', 'translate(0,' + RAMP_H + ')');

	// store a reference to the color picker tool
	this.colorPicker = _colorPicker;

	// luminance plot
	this.lPlot = g.append('g');
	this.lPlot.attr('transform', 'translate(0,' + (-PLOT_H-PLOT_OFFSET) + ')');
	this.lRect = this.lPlot.append('rect')
		.attr('width', RAMP_W).attr('height', PLOT_H)
		.style('fill', 'white').style('stroke', 'black')
	this.lPlot.append('path')
		.attr('class', 'luminancePlot');

	// color difference plot
	this.diffPlot = g.append('g');
	this.diffPlot.attr('transform', 'translate(0,' + 2*(-PLOT_H-PLOT_OFFSET) + ')');
	this.diffRect = this.diffPlot.append('rect')
		.attr('width', RAMP_W).attr('height', PLOT_H)
		.style('fill', 'white').style('stroke', 'black')
	this.diffPlot.append('path')
		.attr('class', 'diffPlot');

	this.gButtons = g.append('g');

	// keep track of history
	this.history = [];

	// create UI elements for the ramp (to add/remove colors)
	this.addUI();

	// initialize
	this.selectedControlPoint = null;
	this.controlPoints = controlPoints;
	this.updateRamp();

	// keep track of callbacks
	this.callbacks = [];
}

ColorRamp.prototype.changeLuminanceProfile = function(profile) 
{
	var MAX_L = MAX_LUMINANCE;
	var MIN_L = MIN_LUMINANCE;
	switch (profile)
	{
	case 'linear':
		for (var i=0, len=this.colors.length; i<len; i++) 
		{
			var color = this.colors[i];

			// look at the value of the color
			var v = color.value;
			var c = d3.lab(color.lab[0], color.lab[1], color.lab[2]);
			var L = v*(MAX_L-MIN_L) + MIN_L;

			// adjust luminacne accordingly
			if (picker.getColorSpace()==COLORSPACE_CAM02) {
				c = d3.jab(c);
				c = d3.lab(d3.jab(L, c.a, c.b));
			}
			else
			{
				c = d3.lab(L, c.a, c.b);
			}
			color.lab = [c.l, c.a, c.b];
		}
		break;

	case 'divergent':

		// see if there's a 0.5 point
		var hasMiddle = false;
		for (var i=0, len=this.colors.length; i<len; i++) {
			if (Math.abs(this.colors[i].v - 0.5) <= 0.01) {
				hasMiddle = true;
				break;
			}
		}
		if (!hasMiddle) {
			// insert a middle
			this.insertColor(d3.lab(100, 0, 0), 0.5);
		}

		for (var i=0, len=this.colors.length; i<len; i++) 
		{
			var color = this.colors[i];

			// look at the value of the color
			var v = color.value;
			var c = d3.lab(color.lab[0], color.lab[1], color.lab[2]);
			var L;
			if (v < 0.5) {
				L = MIN_L + 2*v*(MAX_L-MIN_L)
			}
			else if (v > 0.5)
			{
				L = MIN_L + 2*(1-v)*(MAX_L-MIN_L);
			}
			else {
				L = MAX_L;
			}
			if (picker.getColorSpace() == COLORSPACE_CAM02) {
				c = d3.jab(c);
				c = d3.lab(d3.jab(L, c.a, c.b));
			}
			else
			{
				c = d3.lab(L, c.a, c.b);				
			}
			color.lab = [c.l, c.a, c.b];
		}

		break;
	}
	this.updateRamp();
}

ColorRamp.prototype.registerCallback = function(_type, callback) {
	this.callbacks.push({
		type: _type,
		callback: callback
	});
}

ColorRamp.prototype.fireUpdate = function() 
{
	if (this.callbacks) 
	{
		for (var i=0; i<this.callbacks.length; i++) 
		{
			var c = this.callbacks[i];
			if (c.type == 'update')	 {
				c.callback(this);
			}
		}
	}
}

ColorRamp.prototype.getColorMap = function() {
	return this.colormap;
}

ColorRamp.prototype.addUI = function() 
{
	var g = this.svg.append('g');
	var add = g.append('image')
		.attr('xlink:href', 'img/plus.png')
		.attr('width', '20px').attr('height', '20px')
		.attr('x', 10).attr('y', RAMP_OFF_Y+7)

	var remove = g.append('image')
		.attr('xlink:href', 'img/minus.png')
		.attr('width', '20px').attr('height', '20px')
		.attr('x', 35).attr('y', RAMP_OFF_Y+7)

	g.selectAll('image')
		.on('mouseover', function() { 
			d3.select(this).style('background-color', 'red');
		})
		.on('mouseout', function() {
			d3.select(this).style('background-color', null);
		});

	(function(add, remove, ramp, svg) {
		add.on('click', function() {
			ramp.insertColor({r: 255, g: 255, b: 255});
		});

		remove.on('click', function() {
			ramp.removeColor();
		})

		svg.on('dblclick', function() {
			
			if (!isNaN(ramp.selectedControlPoint)) {
				ramp.unselectControlPoint();
			}
		
		})

		ramp.colorPicker.registerCallback('pick', function(c) {
			ramp.pickColor(c);
		});

		ramp.colorPicker.registerCallback('instantiateColormap', function(colormap, controlPoints) {
			ramp.setColorMap(colormap, controlPoints);
		})

		// ramp image double click adds a new colors
		ramp.lRect.on('dblclick', function() 
		{

			var m = d3.mouse(this);
			m[0] = m[0]/RAMP_W;
			m[1] = 1-m[1]/PLOT_H;


			// find an index where to insert the new control point
			var cs = ramp.colors;
			for (var i=0; i<cs.length-1; i++) {
				var j1=i, j2=i+1;

				if (cs[j1].value+0.03 < m[0] && cs[j2].value-0.03 > m[0]) 
				{
					// this is where we should be inserting (i.e., between i and i+1)
					var c = [m[1] * 100, 0, 0];
					ramp.colors.splice(i+1, 0, {
						value: m[0],
						lab: c
					});

					ramp.updateRamp();
					ramp.selectControlPoint(i+1);
					ramp.colorPicker.switchToColor(d3.lab(c[0], c[1], c[2]));
					break;
				}
			}
		});

		// create radio buttons to chooise mode of selection plot
		var g = ramp.g.append('g')
		g.attr('transform', 'translate(-30,' + 2*(-PLOT_H-PLOT_OFFSET) + ')');
		ramp.plotSelection = new SmallRadio(g, [ 
			{ choice: 'de2000', text: 'dE \'00', },
			{ choice: 'dejab',  text: 'dE Jab'},
			{ choice: 'localspeed',  text: 'speed'},
			{ choice: 'curve' , text: 'dCurve'   }
		], function(choice) {
			ramp.colormapDiffMode = choice;
			ramp.createDiffPlot();
		});

		// defaults to plotting CIE 2000 dE
		ramp.colormapDiffMode = 'de2000';

	})(add, remove, this, this.svg);
}

ColorRamp.prototype.unselectControlPoint = function() {
	this.g.selectAll('rect.selectedColorPatch')
		.attr('class', 'colorPatch');
	this.selectedControlPoint = null;
}

ColorRamp.prototype.selectControlPoint = function(i) 
{
	this.unselectControlPoint();
	this.selectedControlPoint=i;
	this.g.selectAll('.colorPatch').each(function(d, _i) 
	{ 
		if (i==_i) {
			d3.select(this)
				.attr('class', 'colorPatch selectedColorPatch');
		}
	});
	

	// get the color
	var theColor = this.colors[i].lab;
	var c = d3.lab(theColor[0], theColor[1], theColor[2]);

}

ColorRamp.prototype.undo = function() 
{
	fireUpdate();
}

ColorRamp.prototype.pickColor = function(color) 
{
	if (this.selectedControlPoint !== null)
	{
		// create a copy of the old color map
		var older = [];
		for (i=0; i<this.colors.length; i++) 
		{
			var oldControl = this.colors[i];
			older.push({
				value: oldControl.value,
				lab: oldControl.lab
			});
		}
		this.history.push(older);

		var control = this.colors[ this.selectedControlPoint ];
		control.lab = [ color.l, color.a, color.b ];
		this.updateRamp();
	}
}


ColorRamp.prototype.updateSVG = function() 
{
	// create control points onto the ramp
	var controlPoints = this.controlPoints;
	var u = controlPoints.selectAll('circle').data(this.colors);
	u.exit().remove();
	u = u.enter().append('circle')
		.attr('r', 0/*CONTROL_R*/)
		.attr('class', 'controlPoint')
		.merge(u);

	u
		.attr('cx', function(d) 
		{ 
			//console.log("d.value" + d.value);
			return d.value * RAMP_W;
		})
		.attr('cy', 0)



	// create color patches and connect them to control points on the ramp
	this.patches = (function(ramp) 
	{
		var uPatches = ramp.g.selectAll('rect.colorPatch').data(ramp.colors);
		uPatches.exit().remove();

		uPatches = uPatches.enter().append('rect')
			.attr('width', PATCH_W)
			.attr('height', PATCH_H)
			.attr('class', 'colorPatch')
			.merge(uPatches);

		uPatches
			.attr('x', PATCH_OFF_X)
			.attr('y', function(d, i) {
				return RAMP_H + PATCH_OFF_Y + i * (PATCH_H + PATCH_GAP);
			})
			.style('fill', function(d) {
				var c = d3.lab(d.lab[0], d.lab[1], d.lab[2]);
				var rgb = d3.rgb(c);
				return rgb.toString()
			})
			.each(function(d, i) { 
				if (i===ramp.selectedControlPoint) {
					d3.select(this)
						.attr('class', 'colorPatch selectedColorPatch');
				}
			});

		uPatches.on('click', function(d, i) 
		{
			ramp.selectControlPoint(i);
			var c = ramp.colors[i].lab;
			ramp.colorPicker.switchToColor( d3.lab( c[0], c[1], c[2]) );
			d3.event.stopPropagation();
		});

		if (ramp.selectedControlPoint >= ramp.colors.length) {
			ramp.selectedControlPoint = null;
		}
		return uPatches;
	})(this);



	// create connections between the control points and the patches
	this.connectionLines.selectAll('g.controlPointConnection').remove();
	
	var uConnect = this.connectionLines.selectAll('g.controlPointConnection').data(this.colors)
	uConnect = uConnect.enter().append('g')
		.attr('class', 'controlPointConnection')
		.merge(uConnect);
	uConnect
		.each(function(d, i) {
			var l1 = d3.select(this).append('line');
			var l2 = d3.select(this).append('line');

			var y1 = RAMP_H + PATCH_OFF_Y + i * (PATCH_H + PATCH_GAP) + PATCH_H/2;
			l1
				.attr('x1', PATCH_OFF_X+PATCH_W).attr('x2', RAMP_W * d.value)
				.attr('y1', y1).attr('y2', y1);

			l2
				.attr('x1', RAMP_W * d.value).attr('x2', RAMP_W * d.value)
				.attr('y1', y1).attr('y2', RAMP_H);


		});
	uConnect.exit().remove();

	// create luminance plot
	this.createLPlot();

	// create diff plot
	this.createDiffPlot();
}

ColorRamp.prototype.computeLocalDirection = function() {

}

ColorRamp.prototype.computeDivergence = function(t)
{
	// size of window (in t coordinates) to compute
	// local speed within
	var WINDOW = LOCAL_SPEED_W;
	var SAMPLES = LOCAL_SPEED_S/2;

	var STEP = WINDOW/SAMPLES;

	var d = 0.0, count = 0;
	for (var i=0; i<SAMPLES; i++) 
	{
		var t1 = t-i*STEP;
		var t2 = t+i*STEP;
		if (t1 < 0 || t2 > 1) {
			break;
		}
		else
		{
			var hcl1 = this.colormap.mapValue(t1);
			var c1 = d3.jab(hcl1);

			var hcl2 = this.colormap.mapValue(t2);
			var c2 = d3.jab(hcl2); 

			d += Math.sqrt(
				Math.pow(c1.J-c2.J, 2) +
				Math.pow(c1.a-c2.a, 2) +
				Math.pow(c1.b-c2.b, 2) 
			);
			count++;
		}
	}
	return count == 0 ? 0.0 : d/count;
}

ColorRamp.prototype.computeLocalSpeed = function(t)
{
	// size of window (in t coordinates) to compute
	// local speed within
	var WINDOW = LOCAL_SPEED_W;
	var SAMPLES = LOCAL_SPEED_S;

	var STEP = WINDOW/SAMPLES;
	var d = 0.0;

	var rgb0 = this.colormap.mapValue(t);
	var c0 = d3.jab(rgb0);

	for (var pass=0; pass<2; pass++) 
	{
		var dir = pass == 0 ? -1 : +1;
		var cur = t;
		var endReached = false;
		for (var i=0; i<SAMPLES/2 && !endReached; i++) 
		{
			var next = cur + dir * STEP;
			var next = Math.min(1, Math.max(0, next));
			if (next == cur) {
				// can't move anymore
				break;
			}
			else if ( Math.abs(next-cur) < STEP-0.0001 ) {
				endReached = true;
			}

			var rgb = this.colormap.mapValue(next);
			var c1 = d3.jab(rgb);

			d += Math.sqrt(
				Math.pow(c1.J-c0.J, 2) +
				Math.pow(c1.a-c0.a, 2) +
				Math.pow(c1.b-c0.b, 2) 
			) // / Math.abs(next-t);

			cur = next;
		}
	}
	return d;
}

ColorRamp.prototype.createDiffPlot = function()
{
	var SAMPLES = DIFF_SAMPLES;

	var lastColor = null;
	var diffValues = [], diffVectors = [];
	var maxDiff = -Number.MAX_VALUE;
	var avgDiff = 0, N=0;
	var colormap = this.colormap;

	function normalize(a) {
		var L = a[0]*a[0] + a[1]*a[1] + a[2]*a[2];
		if (L > 0) {
			L = 1.0 / Math.sqrt(L)
			return [L*a[0], L*a[1], L*a[2]];
		}
		else
		{
			return a;
		}
	}
	function dot(a, b) 
	{
		return a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
	}
	function angle(a, b) 
	{
		nA = normalize(a);
		nB = normalize(b);

		return dot(nA, nB);
	}

	for (var i=0, len=SAMPLES; i<len; i++) 
	{
		var v = i/(len-1);
		var vv = colormap.mapValue(v);
		var currColor = d3.lab( d3.rgb(vv.r, vv.g, vv.b) );

		if (lastColor) 
		{	
			var d, diffV = [0,0,0];
			switch (this.colormapDiffMode)
			{

			case 'de2000':
				d = ciede2000(
					currColor.l, currColor.a, currColor.b, 
					lastColor.l, lastColor.a, lastColor.b
				);
				break;

			case 'dejab':
				var x = d3.jab(currColor); 
				var y = d3.jab(lastColor);
				d = Math.sqrt(
					Math.pow(x.J-y.J, 2) +
					Math.pow(x.a-y.a, 2) +
					Math.pow(x.b-y.b, 2)
				);
				break;

			case 'localspeed':
				d = this.computeDivergence(v); //this.computeLocalSpeed(v);
				break;

			case 'curve':
				currColor = d3.jab(currColor);
				diffV = [
					currColor.J-lastColor.J,
					currColor.a-lastColor.a,
					currColor.b-lastColor.b,
				];

				d = Math.sqrt(
					Math.pow(diffV[0], 2) +
					Math.pow(diffV[1], 2) +
					Math.pow(diffV[2], 2)
				);
				break;
			}
			diffValues.push(d);
			diffVectors.push(diffV);

			maxDiff = Math.max(d, maxDiff);
			avgDiff += d;
			N++;
		}
		else {
			diffValues.push(0);
			diffVectors.push([0,0,0]);
		}
		lastColor = currColor;
		if (this.colormapDiffMode=='curve') {
			lastColor = d3.jab(lastColor);
		}
	}
	avgDiff /= N;

	if (this.colormapDiffMode == 'curve') 
	{

		// do another pass
		var secondOrder = [0];
		maxDiff = 0.0;
		avgDiff = 0.0;

		for (var i=1, len=diffVectors.length; i<len-1; i++) 
		{
			//var d = Math.abs(diffValues[i]-diffValues[i+1]);
			var d = angle(diffVectors[i], diffVectors[i+1]);
			d = d == 0 ? 0 : 1-d;
			secondOrder.push(d);

			maxDiff = Math.max(d, maxDiff);
			avgDiff += d;
		}
		avgDiff /= diffVectors.length-1;
		diffValues = secondOrder;
	}


	// round D to the next multiple of 10
	var TICKS = this.colormapDiffMode == 'curve' ? 2 : 5
	var scaleMax = Math.ceil(maxDiff / TICKS) * TICKS;

	// plot
	var points = [];
	for (var i=0, len=diffValues.length; i<len; i++) 
	{
		points.push({
			value: i/(len-1)*RAMP_W,
			diff: PLOT_H * (1.0 - diffValues[i] / scaleMax)
		});
	}

	var lineGen = d3.line()
		.x(function(d) { return d.value;})
		.y(function(d) { return d.diff;});

	var diffPath = this.diffPlot.select('path');
	diffPath.attr('d', lineGen(points));

	var diffText = this.diffPlot.select('text');
	if (diffText.size() == 0) {
		diffText = this.diffPlot.append('text');
	}
	diffText.html(scaleMax);
	diffText
		.style('font-size', '10px')
		.attr('text-anchor', 'end');

}

ColorRamp.prototype.createLPlot = function(skipControls) 
{
	// sample the color map
	var SAMPLES = 30, luminanceSamples = [];;
	
	for (var i=0; i<SAMPLES; i++) 
	{
		var t = i/(SAMPLES-1);
		var rgb = this.colormap.mapValue(t), L=0;
		if (rgb)
		{
			switch (picker.getColorSpace())
			{
			case COLORSPACE_CAM02:
				L = d3.jab(rgb).J;
				break;
			case COLORSPACE_LAB:
				L = d3.lab(rgb).l;
				break;
			}
		}
		else
		{
			L = 0;
		}
		luminanceSamples.push({value: t, L: L});

	}

	var lPath = this.lPlot.select('path');
	var lineGen = d3.line()
		.x(function(d) { return RAMP_W * d.value; })
		.y(function(d) { return PLOT_H * (1-d.L/100); });

	var pathD = lineGen(luminanceSamples);
	lPath.attr('d', pathD);
	if (skipControls) {
		return;
	}

	// add points to control luminance
	var lControls = this.lPlot.selectAll('circle.controlPoint').data(this.colors);
	lControls.exit().remove();
	lControls = lControls.enter()
		.append('circle')
		.attr('class', 'controlPoint')
		.merge(lControls);

	lControls
		.attr('r', CONTROL_R)
		.attr('cx', function(d, i) { return d.value * RAMP_W})
		.attr('cy', function(d, i) { return PLOT_H * (1-d.lab[0]/100); });

	(function(controls, ramp) 
	{


		controls
			.on('dblclick', function(d, i) {
				//if (i!=0 && i<ramp.colors.length-1) {
					ramp.removeColor(i);
				//}
				//else if (i==0 && ramp.colors.length >= 3) {

				//}
				d3.event.stopPropagation();
			})
			.on('mousedown', function(d, i) 
			{
				d3.select(this).style('stroke-width', '2px');
				var c = d.lab;
				ramp.selectControlPoint(i);
				ramp.colorPicker.switchToColor( d3.lab(c[0], c[1], c[2]) );

				ramp.lControl = { index: i, control: d, circle: d3.select(this), lastL: c[0] };

				// change interpolation type and luminance profile to 'manual'
				ramp.colorPicker.setInterpolationType('nonuniformLinear');
				setLuminanceProfile('manual');

				d3.select(document)
					.on('mousemove.lControl', function() 
					{
						var m = d3.mouse(ramp.lRect.node());
						m[1] = Math.min(Math.max(0, m[1]), PLOT_H)/PLOT_H;
						m[0] = Math.min(Math.max(0, m[0]), RAMP_W)/RAMP_W;

						var c = ramp.lControl.control.lab;
						var newL = 100*(1-m[1]);
						//console.log("newL: " + newL);

						// see if new L leads to a displayble color
						var redraw = false;
						var newLab = d3.lab(newL, c[1], c[2]);
						if (newLab.displayable() || PERMISSIVE_L_TUNING) 
						{
							if (!newLab.displayable()) {
								// convert to RGB and back to lab
								newLab = d3.lab(d3.rgb(newLab));
								newL = newLab.l;
							}

							// update
							ramp.lControl.control.lab[0] = newL;
							ramp.lControl.circle.attr('cy', m[1] * PLOT_H);

							var newC = ramp.lControl.control.lab;
						
							// redraw
							redraw = true;
							ramp.colorPicker.switchToColor( d3.lab(c[0], c[1], c[2]) );
						}

						// change horizontal position
						// don't allow this since we don't handle that with interpolation right now
						/*
						if (ramp.lControl.index > 0 && ramp.lControl.index < ramp.colors.length-1) {
							// allow horizontal movement
							var minV = ramp.colors[0].value+.03;
							var maxV = ramp.colors[ramp.colors.length-1].value-.03;
							var newV = Math.max(Math.min(maxV, m[0]), minV);
							ramp.colors[ramp.lControl.index].value = newV;
							ramp.lControl.circle.attr('cx', newV * RAMP_W);
							redraw = true;
						}
						*/

						if (redraw) {
							ramp.updateRamp();
						}

					})
					
					.on('mouseup.lControl', function() {
						ramp.lControl.circle.style('stroke-width', null);
						ramp.lControl = undefined;
						d3.select(document)
							.on('mousemove.lControl', null)
							.on('mouseup.lControl', null);
						//d3.event.stopPropagation();
					});
				d3.event.stopPropagation();
			})
	})(lControls, this);
}

ColorRamp.prototype.setColorMap = function(_colormap, controlPoints)
{
	// remove existing color map
	if (this.colormap) {
		this.colormap.dispose();
		this.colormap = null;
	}
	if (!this.lControl) 
	{
		// essentally update controlPoints only if user is not manipulating
		// the ramp
		this.colors = controlPoints;
	}
	this.updateColormap(_colormap, true);
	this.updateSVG();
}

ColorRamp.prototype.updateColormap = function(colormap, noUpdate) 
{
	var interpType;
	switch(picker.getColorSpace())
	{
	case COLORSPACE_CAM02:
		interpType = 'jab';
		break;
	case COLORSPACE_LAB:
		interpType = 'lab';
		break;
	default:
		interpType = undefined;
	}
	this.colormap = colormap || new ColorMap(this.colors, interpType);

	// render color ramp
	var colorScale = document.createElement('canvas');
	colorScale.width = RAMP_W; colorScale.height=RAMP_H;
	this.colormap.drawColorScale(RAMP_W, RAMP_H, Math.floor(RAMP_W/1), 'horizontal', colorScale);

	// update the color ramp image
	this.colorRampImage.attr('xlink:href', colorScale.toDataURL());

	// update the picker
	var SAMPLES = 50;
	var points = [];
	for (var i=0; i<SAMPLES; i++) 
	{
		var v = i/(SAMPLES-1);
		var c = this.colormap.mapValue(v);
		points.push({
			value: v,
			color: d3.lab(d3.rgb(c.r, c.g, c.b))
		});
	}

	// notify
	if (!noUpdate) {
		this.colorPicker.plotColormap(points);
	}
	this.fireUpdate();
}

ColorRamp.prototype.updateRamp = function() 
{
	picker.setControlPoints(this.colors);
	
	// don't update colormap from here; picker will call us back
	//this.updateColormap();

	this.updateSVG();
}

ColorRamp.prototype.removeColor = function(index) {
	if (this.colors.length == 2) {
		return;
	}
	else if (index !== null && index !== undefined)
	{
		this.colors.splice(index, 1);
		if (index == 0) {
			this.colors[0].value = 0;
		}
		else if (index == this.colors.length) {
			this.colors[index-1].value = 1;
		}
		this.updateRamp()

		if (this.selectedControlPoint === index) {
			this.unselectControlPoint();
		}
	}
	else
	{
		this.colors.pop();
		
		// move the last control point to the end of the ramp
		this.colors[ this.colors.length-1 ].value = 1;
		this.updateRamp();

		if (!isNaN(this.selectedControlPoint) && this.selectedControlPoint > this.colors.length-1) {
			this.unselectControlPoint();
		}
	}
}
ColorRamp.prototype.insertColor = function(newColor, value) 
{
	var labNewColor = null;
	if (newColor.r !== undefined && newColor.g !== undefined && newColor.b !== undefined) {
		labNewColor = d3.lab(d3.rgb(newColor.r, newColor.g, newColor.b));
	}
	else if (newColor.l !== undefined && newColor.a !== undefined && newColor.b !== undefined) {
		labNewColor = d3.lab(newColor.l, newColor.a, newColor.b);
	}

	// create a new entry
	var cPoint = {
		value: value,
		lab: [labNewColor.l, labNewColor.a, labNewColor.b] 
	}
	// if a value is given, insert the color in the right space
	if (value !== undefined && value !== null)
	{
		if (this.colors[0].value > value) 
		{
			this.colors.splice(0, 0, cPoint);
		}
		else if (this.colors[this.colors.length-1].value < value) 
		{
			this.colors.push(cPoint);
		}

		else
		{
			// find the correct place 
			for (var i=0; i<this.colors.length-1; i++) 
			{
				var c1 = this.colors[i];
				var c2 = this.colors[i+1];

				if (c1.value == value) {
					this.colors[i] = cPoint;
				}
				else if (c2.value == value) {
					this.colors[i+1] = cPoint;
				}
				else if (c1.value < value && c2.value > value) 
				{
					this.colors.splice(i+1, 0, cPoint);
					break;	
				}
			}
		}
	}
	else
	{
		// append to the end of the colormap, but rescale the rest of the colors
		cPoint.value = 1;
		this.colors.push(cPoint);
		var oldRange = d3.scaleLinear()
			.domain([0, this.colors.length-1])
			.range([ 0, 1 ]);

		for (var i=0; i<this.colors.length-1; i++) 
		{
			var c = this.colors[i];
			c.value = oldRange(i);
		}
	}

	this.updateRamp();
}

