/* -------------------------------------
 * Color Picker tool
 * -------------------------------------
 */

var BACKGROUND = [200, 200, 200];


var MAX_B_CONTROLS = 12;

var MIN_LUMINANCE = 15;
var MAX_LUMINANCE = 90;

// color spaces
var COLORSPACE_LAB = 1;
var COLORSPACE_CAM02 = 2;

// ranges for color spaces
var A_RANGE=[-112, 112];
var B_RANGE=[-112, 112];

var JAB_A_RANGE = [-45, 45];
var JAB_B_RANGE = [-45, 45];

var CHANNEL_RAMP_OFFSET = 10;

var PICKER_RENDER_GL = true;

function isArray (value) {
	return value && typeof value === 'object' && value.constructor === Array;
}

function ColorPicker(svg, mainCanvas, channelCanvas, threeDCanvas) 
{
	this.svg = svg;
	this.mainCanvas = mainCanvas;
	this.channelCanvas = channelCanvas;
	this.threeDCanvas = threeDCanvas;

	// default to using CIE LAB color space
	this.colorSpace = COLORSPACE_LAB;

	// location of current selection on the channel
	// this should be a normalized number between 0 and 1
	this.channelPos = 0.5;
	this.makeUI();

	// currently selected color
	this.currentColor = null;

	// callbacks, initially empty 
	this.callbacks = [];

	// shows color curve
	this.colorCurve = null;

	// create a 'path' to visualize the map's curve in the color space
	this.controlGroup = svg.append('g');
	this.colormapCurve = this.controlGroup.append('path').attr('class', 'colormapCurve');

	// control points to specify a color ramp within the picker
	this.bControls = [];
	this.luminanceProfile = 'linear';

	
	if (PICKER_RENDER_GL) 
	{	
		this.glCanvas = document.createElement('canvas');
		this.glCanvas.width = +mainCanvas.width;
		this.glCanvas.height = +mainCanvas.height;
		this.glCanvas.id = 'canvasPickerGL';

		// object to store shaders
		this.shaders = {};
		var q = d3.queue();
		q
			.defer( gLoadShader, this, 'design/src/shaders/vertex.vert', 'vertex' )
			.defer( gLoadShader, this, 'design/src/shaders/lab2rgb.frag', 'labslice')
			.defer( gLoadShader, this, 'design/src/shaders/cam022rgb.frag', 'cam02slice');

		(function(picker, _q) {
			_q.awaitAll(function(error) 
			{
				if (error) {
					throw error;
				}
				else {
					var bg = BACKGROUND;

					picker.jabPipeline = new GLPipeline(picker.glCanvas);
					picker.jabPipeline.addStage({
						uniforms: {
							J: {value: picker.getL()},
							background: {value: [bg[0]/255, bg[1]/255, bg[2]/255]},
							width: {value: +picker.glCanvas.width},
							height: {value: +picker.glCanvas.height}
						},
						fragment: picker.shaders['cam02slice'],
						vertex: picker.shaders['vertex']
					});

					picker.labPipeline = new GLPipeline(picker.glCanvas);
					picker.labPipeline.addStage({
						uniforms: {
							L: {value: picker.getL()},
							background: {value: [bg[0]/255, bg[1]/255, bg[2]/255]},
						},
						fragment: picker.shaders['labslice'],
						vertex: picker.shaders['vertex']
					});

					// render initial view
					picker.renderChannel();
					picker.renderPerceptual();
				}
			});
		})(this, q);
	}

}

ColorPicker.prototype.L = function() { 
	return (1-this.channelPos) * 100;
}
ColorPicker.prototype.setL = function(_L) 
{
	this.channelPos = 1 - _L/100
	this.drawChannelSelection();
	this.renderPerceptual();
}
ColorPicker.prototype.getL = function() {
	return 100 * (1-this.channelPos);
}


ColorPicker.prototype.getColorSpace = function() {
	return this.colorSpace;
}

ColorPicker.prototype.addBControl = function(color) 
{	
	if (this.bControls.length < MAX_B_CONTROLS) {
		this.bControls.push(color);
	}
	this.updateBControl();
}

ColorPicker.prototype.hasCurve = function() {
	return this.bControls.length >= 2;
}

ColorPicker.prototype.changeLuminanceProfile = function(profile)
{
	this.luminanceProfile = profile;
	if (this.bControls.length >= 2) {
		this.instantiateColorMap();
	}
}

ColorPicker.prototype.getLuminanceGivenProfile = function(t)
{
	var MAX_L = MAX_LUMINANCE;
	var MIN_L = MIN_LUMINANCE;


	// color map properties
	if (this.luminanceProfile == 'linear') {
		return MIN_L + t*(MAX_L-MIN_L);
	}
	else if (this.luminanceProfile == 'divergent')
	{
		if (t < 0.5) {
			return MIN_L + 2*t*(MAX_L-MIN_L)
		}
		else if (t > 0.5)
		{
			return MIN_L + 2*(1-t)*(MAX_L-MIN_L);
		}
		else {
			return MAX_L;
		}
	}
	else
	{
		return null;
	}
}

ColorPicker.prototype.instantiateColorMap = function()
{
	var SAMPLES = 100;

	if (this.bControls.length >= 2)
	{
		// convert control group to an Array format
		var controls = [], colors = [];
		for (var i=0; i < this.bControls.length; i++) 
		{
			var control = this.bControls[i];

			// translate to L, A, B
			var L = control.L;
			var AB = this.xy2ab([control.x, control.y]);
			var A = AB[0], B = AB[1];
			var color = [L, A, B];
			var colorLab = d3.lab(this.getColorFromAB(color));

			controls.push(
			{
				lab: [colorLab.l, colorLab.a, colorLab.b],
				value: control.value
			});
			colors.push(color)
		}

		// interpolate the curve
		this.colormapCoordinates = [];
		var colorset = [];
		var interpolation = null;

		switch (this.interpolationType) {
		case 'spline':
			interpolation = new CatmulRom(colors, true);
			break;
		case 'linear':
			interpolation = new LinearInterpolation(colors, LINEAR_UNIFORM);
			break;
		case 'nonuniformLinear':
			interpolation = new LinearInterpolation(colors, LINEAR_NON_UNIFORM);
			break;		
		}

		for (var i=0; i<SAMPLES; i++) 
		{
			var t = i/(SAMPLES-1);
			var c = interpolation.interpolate(t);
			
			// make sure we have a valid color
			if (isNaN(c[0]) || isNaN(c[1]) || isNaN(c[2])) {
				console.error('NaN in interpolation');
			}

			// adjust control point luminance according to profile
			var luminanceProfiled = this.getLuminanceGivenProfile(t)
			if (luminanceProfiled !== null) {
				c[0] = luminanceProfiled;
			}
			else
			{
				//console.log("non luminanceProfile")
			}
			
			var color;
			switch (this.colorSpace)
			{
			case COLORSPACE_LAB:
				color = d3.lab(c[0], c[1], c[2]);
				break;

			case COLORSPACE_CAM02:
				color = d3.jab(c[0], c[1], c[2]);
				break;
			}

			// add to the color map
			var cLab = d3.lab(color);
			colorset.push({
				value: t,
				lab: [cLab.l, cLab.a, cLab.b]
			});

			// now take that color and convert it coordinates
			var coord = this.coordFromColor(color);

			// add to coordinates
			this.colormapCoordinates.push(coord);
		}
		this.plotColormapCurve2D();
		this.plotColormapCurve3D();

		// instantiate a new color map
		var theColormap = new ColorMap(colorset, COLORSPACE_LAB ? 'lab' : 'jab');

		// re-distribute the value in original control points based on interpolation
		for (var i=0; i < controls.length; i++) 
		{
			var t = interpolation.getTFromIndex(i);
			controls[i].value = t;

			// re-adjust the color based on the interpolation
			var newColor = interpolation.interpolate(t);
			var luminanceProfiled = this.getLuminanceGivenProfile(t)
			if (luminanceProfiled !== null) {
				newColor[0] = luminanceProfiled;
			}

			var newColorLab = d3.lab(this.getColorFromAB(newColor));
			controls[i].lab = [
				newColorLab.l, newColorLab.a, newColorLab.b
			];
		}
		// sort controls
		controls.sort(function(a, b) { return a.value-b.value});

		for (var i=0; i<this.callbacks.length; i++) 
		{
			var callback = this.callbacks[i];
			if (callback.event == 'instantiateColormap') {
				callback.callback(theColormap, controls);
			}
		}
		return theColormap;
	}
	else
	{
		return null;
	}
}

ColorPicker.prototype.setInterpolationType = function(interpType)
{
	this.interpolationType = interpType;
	this.interpolationSelector.makeActive(interpType);
}

ColorPicker.prototype.setControlPoints = function(colors)
{
	var controls = [];
	for (var i=0; i<colors.length; i++) 
	{
		var c = colors[i];
		var lab = d3.lab(c.lab[0], c.lab[1], c.lab[2]);
		var xy, L;
		switch (this.colorSpace) {

		case COLORSPACE_LAB:
			xy = this.ab2xy([lab.a, lab.b], COLORSPACE_LAB);
			L = lab.l;
			break;
		case COLORSPACE_CAM02:
			var jab = d3.jab(lab);
			xy = this.ab2xy([jab.a, jab.b], COLORSPACE_CAM02);
			L = jab.J;
			break;
		}

		controls.push({
			x: xy[0],
			y: xy[1],
			L: L,
			colorSpace: this.colorSpace,
			value: c.value,
		});
	}
	this.bControls = controls;
	this.updateBControl();
}

ColorPicker.prototype.updateBControl = function() 
{
	var B_CONTROL_R = 5;
	this.colormapCurve.attr('d', null);
	//console.log("bCongtrols[1]: " + this.bControls[1].L);

	// show the curves
	var w = +this.mainCanvas.width;
	var h = +this.mainCanvas.height;
	
	var u = this.controlGroup.selectAll('g.bControlPoint').data(this.bControls);
	u.exit().remove();
	u = u.enter().append('g')
		.attr('class', 'bControlPoint')
		.each(function() {
			var g = d3.select(this)
			g.append('circle')
				.attr('r', B_CONTROL_R).attr('cx', 1).attr('cy', 1)
				.style('stroke', 'white');
			g.append('circle')
				.attr('r', B_CONTROL_R).attr('cx', 0).attr('cy', 0)
				.style('stroke', 'black');
		})
		.merge(u);
	
	// add circles
	(function(u, picker) 
	{
		u.each(function(d, i) 
		{
			d3.select(this)
				.attr('transform', 'translate(' + d.x + ',' + d.y + ')');
		})
		.on('mousedown', function(d, i) 
		{
			d3.select(this).style('stroke-width', '3px');
			picker.selectedBControl = i;
			picker.selectedCircle = d3.select(this);

			// mouse move
			d3.select(document).on('mousemove.bControl', function() 
			{
				var m = d3.mouse(picker.svg.node());
				var selected = picker.bControls[ picker.selectedBControl ];
				selected.x = m[0];
				selected.y = m[1];

				// update (which also updates on screen)
				picker.updateBControl();
			});
			
			// mouse up
			d3.select(document).on('mouseup.bControl', function() 
			{
				d3.select(document)
					.on('mousemove.bControl', null)
					.on('mouseup.bControl', null);
				
				picker.selectedCircle.style('stroke-width', null);
				picker.selectedBControl = undefined;
				picker.selectedCircle = undefined;
			})
			d3.event.stopPropagation();
		})
		.on('dblclick', function(d, i) 
		{
			if (!event.shiftKey) {
				// remove control point
				picker.bControls.splice(i, 1);
				picker.updateBControl();
				d3.event.stopPropagation();
			}
		})

	})(u, this);
	return this.instantiateColorMap();
}

ColorPicker.prototype.changeColorSpace = function(newSpace)
{
	this.colorSpace = newSpace;
	this.renderChannel();
	this.renderPerceptual();

	// remap position of contorl points
	var updateControls = false;
	for (var i=0, len=this.bControls.length; i<len; i++) 
	{
		var c = this.bControls[i];
		if (c.colorSpace != newSpace) 
		{
			// remap from XY to AB in original color space
			var AB = this.xy2ab([c.x, c.y], c.colorSpace);
			
			// remap from AB in original to new color space
			var color = c.colorSpace == COLORSPACE_CAM02 ? d3.jab(c.L, AB[0], AB[1]) : d3.lab(c.L, AB[0], AB[1]);
			var newColor = newSpace == COLORSPACE_CAM02 ? d3.jab(color) : d3.lab(color);
			var LL = newSpace == COLORSPACE_CAM02 ? newColor.J : newColor.l;

			if (isNaN(newColor.a) || isNaN(newColor.b)) {
				console.error("Error in convering color")
			}

			// remap from AB in new color space to new XY
			var xy = this.ab2xy([newColor.a, newColor.b], newSpace);
			c.x = xy[0];
			c.y = xy[1];
			c.L = LL;

			c.colorSpace = newSpace;
			updateControls = true;
		}
	}

	if (updateControls) {
		this.updateBControl();
	}
}

ColorPicker.prototype.registerCallback = function(event, callback, id) 
{
	// two events are supported: preview and pick
	this.callbacks.push({ event: event, callback: callback, id: id });
}
ColorPicker.prototype.unregisterCallback = function(id)
{
}

ColorPicker.prototype.renderChannel = function() {

	var canvas = this.channelCanvas;
	var context = canvas.getContext("2d");

	var width = canvas.width;
	var height = canvas.height;
	var image = context.createImageData(width, height);

	// what should the aux canvas be?
	switch (this.colorSpace) 
	{


	case COLORSPACE_CAM02:
	case COLORSPACE_LAB:

		// luminance interpolation
		for (var i=0; i<height; i++)
		{
			var cLAB = this.colorSpace == COLORSPACE_LAB 
				? d3.lab(100-100*i/(height-1), 0.0, 0.0)
				: d3.jab(100-100*i/(height-1), 0.0, 0.0);

			var cRGB = d3.rgb(cLAB);

			var I = i * width * 4;
			for (var j=0; j < width-CHANNEL_RAMP_OFFSET; j++) 
			{
				image.data[I+j*4  ] = cRGB.r;
				image.data[I+j*4+1] = cRGB.g;
				image.data[I+j*4+2] = cRGB.b;
				image.data[I+j*4+3] = 255;
			}

		}
		break;

	default:
		for (var i=0; i<height; i++) 
		{
			var cCAM = d3.jab(100-100*i/(height-1), 0.0, 0.0);

		}

		break;
	}

	// store the image data
	this.channelImage = image;

	// display it
	context.putImageData(image, 0, 0);

	// create a thing rectangle to indicate currently selected position along with channel
	this.drawChannelSelection();
}

ColorPicker.prototype.drawChannelSelection = function() 
{
	var context = this.channelCanvas.getContext("2d");
	var height = this.channelCanvas.height;
	var width = this.channelCanvas.width;

	context.fillStyle="#222222";
	context.strokeStyle="";
	context.putImageData(this.channelImage, 0, 0);

	var y = (height-1) * this.channelPos;

	
	var path=new Path2D();
	path.moveTo(width - CHANNEL_RAMP_OFFSET, y);
	path.lineTo(width-1, y-6);
	path.lineTo(width-1, y+6);
	context.fill(path);
	

	// draw two markers to show MIN/MAX_LUMINANCE
	//context.fillStyle="";
	context.strokeStyle="#ffff00";
	context.beginPath();
	context.moveTo(0, (height-1) * (1-MAX_LUMINANCE/100));
	context.lineTo(width-CHANNEL_RAMP_OFFSET, (height-1) * (1-MAX_LUMINANCE/100));

	context.stroke();

	context.strokeStyle="#ffff00";
	context.beginPath();
	context.moveTo(0, (height-1) * (1-MIN_LUMINANCE/100));
	context.lineTo(width-CHANNEL_RAMP_OFFSET, (height-1) * (1-MIN_LUMINANCE/100));

	context.stroke();

}

ColorPicker.prototype.plotColormap = function(colorPoints)
{
	var coordinates = [];
	for (var i=0; i<colorPoints.length; i++) 
	{
		var p = colorPoints[i];
		var c = this.coordFromColor(p.color);
		coordinates.push(c)
	}
	this.colormapCoordinates = coordinates;

	// plot the 2D color map curve
	this.plotColormapCurve2D();

	// plot the 3D color map curve
	if (this.threeDCanvas) {
		this.plotColormapCurve3D();
	}


}
ColorPicker.prototype.plotColormapCurve2D = function() 
{
	var w = +this.mainCanvas.width;
	var h = +this.mainCanvas.height;
	var lineGen = d3.line()
		.x(function(d) { return d.x * (w-1);})
		.y(function(d) { return d.y * (w-1);});


	var pathD = lineGen(this.colormapCoordinates);
	if (pathD.indexOf('NaN') != -1) {
		console.log("ERROR!");
	}

	this.colormapCurve.attr('d', pathD);
}

ColorPicker.prototype.plotColormapCurve3D = function()
{
	if (!this.renderer) 
	{
		// renderer
		var canvas = this.threeDCanvas;
		this.renderer = new THREE.WebGLRenderer({ 
			canvas: canvas
		});
		this.renderer.setClearColor(0xcccccc, 1);
	
		// camera
		var camera = new THREE.PerspectiveCamera( 45, +canvas.width / +canvas.height, 1, 1000 );
		camera.position.set( 0, 0, 400 );
		camera.lookAt( new THREE.Vector3( 0, 0, 0 ) );

		// add 'Orbit' controls to camera
		controls = new THREE.OrbitControls( camera, this.renderer.domElement );
		(function(_controls, picker) {
			_controls.addUpdateCallback(function() {
				picker.renderer.render(picker.scene, picker.camera);
			});
		})(controls, this)
		this.camera = camera;

		// scene
		this.scene = new THREE.Scene();

		// plane
		var planeGeom = new THREE.PlaneBufferGeometry( 100, 100, 8, 8 )
		var mat = new THREE.LineBasicMaterial( { color: 0xffffff, linewidth: 1 } );
		var wireframe = new THREE.LineSegments( planeGeom, mat );
		this.plane = wireframe;
		this.plane.rotateX( Math.PI / 2 );

		// add plane to scene
		this.scene.add(this.plane);

		// add sphere to be used for brushing
		var sphereGeom = new THREE.SphereGeometry( 2.5, 32, 32 );
		var sphereMaterials = new THREE.MeshBasicMaterial( {color: 0xff0000, wireframe: true} );
		var sphere = new THREE.Mesh( sphereGeom, sphereMaterials );
		this.scene.add( sphere );
		this.sphere = sphere;
		this.sphere.visible = false;
	}

	// if there is an old scene, dispose of it
	if (this.lineObject) {
		this.scene.remove(this.lineObject);
		doDispose(this.lineObject);
		this.lineObject = undefined;
	}

	// create line
	var material = new THREE.LineBasicMaterial( { color: 0x01188e, linewidth: 4.0 } );
	var geometry = new THREE.Geometry();

	// insert vertices
	var coordinates = this.colormapCoordinates;
	var a_range = this.colorSpace == COLORSPACE_LAB ? A_RANGE : JAB_A_RANGE;
	var b_range = this.colorSpace == COLORSPACE_LAB ? B_RANGE : JAB_B_RANGE;

	for (var i=0, len=coordinates.length; i<len; i++)
	{
		var p = coordinates[i];
		geometry.vertices.push(new THREE.Vector3( 100*(p.x-.5), 100*p.z, 100*(p.y-.5) ));
	}

	this.lineObject = new THREE.Line( geometry, material );
	this.scene.add(this.lineObject);

	this.renderer.render( this.scene, this.camera );

}

ColorPicker.prototype.makeUI = function() {

	(function(picker) {
		d3.select(picker.channelCanvas).on("mousedown", function() 
		{
			// test if we're manipulating MIN/MAX_Luminance
			var m = d3.mouse(this);
			var y = m[1];
			var MAX_Y = +this.height * (1-MAX_LUMINANCE/100);
			var MIN_Y = +this.height * (1-MIN_LUMINANCE/100);
			
			var withinMax = Math.abs(y-MAX_Y) < 5;
			var withinMin = Math.abs(y-MIN_Y) < 5;

			if ( withinMax ) {
				picker.pick = 'max';
			}
			else if ( withinMin ) {
				picker.pick = 'min';
			}
			else {
				picker.pick = undefined;
			}

			d3.select(document)

				.on("mousemove.channelPicker", function() 
				{
					var m = d3.mouse(picker.channelCanvas);
					var h = +picker.channelCanvas.height;

					if (picker.pick == 'max')
					{
						m[1] = Math.max(0, m[1]);
						m[1] = Math.min(m[1], h*(1-MIN_LUMINANCE/100)-5);
						MAX_LUMINANCE = (1-m[1]/h)*100;
						picker.drawChannelSelection();
						picker.instantiateColorMap();

					}
					else if (picker.pick == 'min')
					{
						m[1] = Math.min(h, m[1]);
						m[1] = Math.max(m[1], h*(1-MAX_LUMINANCE/100)+5)
						MIN_LUMINANCE = (1-m[1]/h)*100;
						picker.drawChannelSelection();
						picker.instantiateColorMap();
					}
					else
					{

						m[1] = Math.min(h, Math.max(0, m[1]));
						
						// set Luminance for color picker
						var L = (1 - m[1] / h) * 100;
						picker.setL(L);

						// callbacks
						for (var i=0, len=picker.callbacks.length; i<len; i++) {
							var c = picker.callbacks[i];
							if (c.event == 'changeLuminance') {
								c.callback(L);
							}
						}
					}
				})
				.on("mouseup.channelPicker", function() {
					d3.select(document)
						.on("mousemove.channelPicker", null)
						.on("mouseup.channelPicker", null);
				})
		})

		picker.svg
			.on('mousemove', function() {

				var c = picker.colorFromMouse(d3.mouse(this));
				if (picker.mouseDown) {
					picker.pickColor(c);
				}
				else {
					picker.previewColor(c);
				}
			})
			.on('mouseout', function() {
				picker.previewColor();
			})
			.on('mousedown', function() 
			{
				var m = d3.mouse(this);
				if (d3.event.shiftKey)
				{
					// add a control ppoint
					picker.addBControl({
						x: m[0], y: m[1], 
						L: picker.L(),
						colorSpace: picker.getColorSpace()
					});
				}
				else
				{
					var c = picker.colorFromMouse(d3.mouse(this));
					picker.pickColor(c);
					picker.mouseDown = true;
				}
			})
			.on('dblclick', function() {
				if (d3.event.shiftKey) {
					picker.bControls = [];
					picker.updateBControl();
				}
			})
			.on('mouseup', function() {
				picker.mouseDown = false;
			});

		var g = picker.svg.append('g')
		g.attr('transform', 'translate(50,5)');
		picker.interpolationSelector = new SmallRadio(g, [
			{text: 'spline', choice: 'spline'},
			{text: 'linear', choice: 'linear'},
			{text: '! uniform', choice: 'nonuniformLinear'}
		], function(choice) {
			picker.interpolationType = choice;
			picker.instantiateColorMap();
		})

		// defaults to spline interpolation
		picker.interpolationType = 'spline';
	})(this);
}

ColorPicker.prototype.coordFromColor = function(color)
{
	if (isArray(color)) {
		// assume this is a lab color
		color = d3.lab(color[0], color[1], color[2])
	}

	var w = +this.mainCanvas.width, h = +this.mainCanvas.height;
	var xScale = d3.scaleLinear(), yScale = d3.scaleLinear(), x, y, L, c;
	switch (this.colorSpace)
	{
	case COLORSPACE_LAB:
		xScale.range([0, 1]).domain(A_RANGE);
		yScale.range([1, 0]).domain(B_RANGE);	
		c = d3.lab(color);		
		L = c.l;
		break;

	case COLORSPACE_CAM02:
		xScale.range([0, 1]).domain(JAB_A_RANGE);
		yScale.range([1, 0]).domain(JAB_B_RANGE);
		c = d3.jab(color);
		L = c.J;
		break;
	}

	x = xScale(c.a);
	y = yScale(c.b);
	z = L/100;
	return {x: x, y: y, z: z};
}

ColorPicker.prototype.colorFromMouse = function(mouse) 
{
	var canvas = this.mainCanvas;
	var w = +this.mainCanvas.width;
	var h = +this.mainCanvas.height;

	var xScale, yScale, A, B;

	switch (this.colorSpace)
	{
	case COLORSPACE_LAB:
		xScale = d3.scaleLinear().domain([0, w-1]).range(A_RANGE);
		yScale = d3.scaleLinear().domain([h-1, 0]).range(B_RANGE);			
		B = yScale(mouse[1]);
		A = xScale(mouse[0]);
		return d3.lab((1-this.channelPos)*100, A, B);
		break;
	
	case COLORSPACE_CAM02:
		xScale = d3.scaleLinear().domain([0, w-1]).range(JAB_A_RANGE);
		yScale = d3.scaleLinear().domain([h-1, 0]).range(JAB_B_RANGE);			
		B = yScale(mouse[1]);
		A = xScale(mouse[0]);
		return d3.lab(d3.jab((1-this.channelPos)*100, A, B));	
	}

}

ColorPicker.prototype.switchToColor = function(c)
{
	var color, L;
	switch (this.colorSpace)
	{
	case COLORSPACE_CAM02:
		color = d3.jab(c);
		L = color.J;
		break;
	case COLORSPACE_LAB:
		color = d3.lab(c);
		L = color.l;
		break;
	}

	if (!color.displayable()) {
		// color not displyable in RGB gamut
		//console.log("\tNon-displayable");
	}
	else
	{
		// adjust the channel position to match luminance of given color
		this.setL(L);

		// change the color div to reflect selection
		d3.select('#pickedColor')
			.style('background-color', c.toString());
		this.markColor(color);
	}
}

ColorPicker.prototype.markColor = function(c) 
{
	/*
	var a_range, b_range;
	switch (this.colorSpace)
	{
	case COLORSPACE_CAM02:
		c = d3.jab(c);
		a_range = JAB_A_RANGE;
		b_range = JAB_B_RANGE;
		break;

	case COLORSPACE_LAB:
		c = d3.lab(c);
		a_range = A_RANGE;
		b_range = B_RANGE;
		break;
	}

	// draw a simple cross sign
	var aS = d3.scaleLinear().domain(a_range).range([0, +this.mainCanvas.width]);
	var bS = d3.scaleLinear().domain(b_range).range([+this.mainCanvas.height, 0]);
	var x = aS(c.a);
	var y = bS(c.b);

	var ctx = this.mainCanvas.getContext('2d');
	ctx.beginPath();
	ctx.moveTo(x-5, y);
	ctx.lineTo(x+5, y);
	ctx.stroke();

	ctx.beginPath();
	ctx.moveTo(x, y-5);
	ctx.lineTo(x, y+5);
	ctx.stroke();
	*/
		
}

ColorPicker.prototype.pickColor = function(c, skipCallback) 
{
	switch (this.colorSpace)
	{

	case COLORSPACE_CAM02:
	case COLORSPACE_LAB:

		var cLab = d3.lab(c);
		if (!cLab.displayable()) {
			//console.log("\tNon-displayable");
		}
		else
		{
			// adjust the channel position to match luminance of given color
			//this.channelPos = 1 - cLab.l / 100;
			//this.drawChannelSelection();

			// change the color div to reflect selection
			d3.select('#pickedColor')
				.style('background-color', c.toString());

			// notify
			if (!skipCallback) {
				for (var i=0; i<this.callbacks.length; i++) {
					var callback = this.callbacks[i];
					if (callback.event == 'pick') {
						callback.callback(c);
					}
				}
			}
			this.renderPerceptual();
			this.markColor(c);
		}
		//this.renderLAB();
		break;
	}
}

ColorPicker.prototype.previewColor = function(c)
{
	if (!c) {
		d3.select("#previewColor").style('background-color', null);
		for (var i=0; i<this.callbacks.length; i++) {
			var callback = this.callbacks[i];
			if (callback.event == 'preview') {
				callback.callback(null);
			}
		}
	}
	else
	{
		var cLab = d3.lab(c);
		if (cLab.displayable()) 
		{
			d3.select("#previewColor").style('background-color', cLab.toString());
			for (var i=0; i<this.callbacks.length; i++) 
			{
				var callback = this.callbacks[i];
				if (callback.event == 'preview') {
					callback.callback(cLab);
				}
			}
		}
		else
		{
			d3.select("#previewColor").style('background-color', null);
		}
	}
}

ColorPicker.prototype.brushColor = function(color)
{
	if (color)
	{
		if (isArray(color)) {
			color = d3.lab(color[0], color[1], color[2]);
		}
		switch(this.colorSpace)
		{
		case COLORSPACE_LAB:
			color = d3.lab(color);
			break;
		case COLORSPACE_CAM02:
			color = d3.jab(color);
			break;
		}

		// highlight location in SVG
		var circle = this.svg.selectAll('circle.brushBall');
		if (circle.size() == 0) {
			this.svg.append('circle')
				.attr('class', 'brushBall')
				.attr('r', '5');
		}
		var coord = this.coordFromColor(color);
		var w = +this.mainCanvas.width, h = +this.mainCanvas.height;
		circle
			.attr('visibility', 'visible')
			.attr('cx', coord.x * w)
			.attr('cy', coord.y * h);

		// switch to color
		this.switchToColor(color);

		if (this.renderer && this.sphere) {
			this.sphere.position.x = 100*(coord.x-.5); 
			this.sphere.position.y = 100*(coord.z);
			this.sphere.position.z = 100*(coord.y-.5);
			this.sphere.visible = true;
			this.renderer.render( this.scene, this.camera );

		}

	}
	else
	{
		this.svg.selectAll('circle.brushBall')
			.attr('visibility', 'hidden');
		if (this.renderer && this.sphere) {
			this.sphere.visible = false;
			this.renderer.render( this.scene, this.camera );
		}

	}
}

ColorPicker.prototype.renderPerceptual = function() 
{

	// color ranges (actual LAB ranges are -128, 127)
	var a = this.colorSpace == COLORSPACE_LAB ? A_RANGE : JAB_A_RANGE;
	var b = this.colorSpace == COLORSPACE_LAB ? B_RANGE : JAB_B_RANGE;


	var canvas = this.mainCanvas;
	var w = +this.mainCanvas.width;
	var h = +this.mainCanvas.height;

	var context = canvas.getContext("2d");
	var image = context.createImageData(w, h);

	var xScale = d3.scaleLinear().domain([0, w-1]).range(a);
	var yScale = d3.scaleLinear().domain([h-1, 0]).range(b);
	var L = 100 - this.channelPos * 100;

	if (this.colorSpace == COLORSPACE_CAM02 && PICKER_RENDER_GL)
	{
		var uniforms = this.jabPipeline.getStage(0).getUniforms();
		uniforms.J.value = L;
		this.jabPipeline.run();
		glCanvasToCanvas(this.glCanvas, this.mainCanvas, true);
	}
	else if (this.colorSpace == COLORSPACE_LAB && PICKER_RENDER_GL)
	{
		var uniforms = this.labPipeline.getStage(0).getUniforms();
		uniforms.L.value = L;
		this.labPipeline.run();
		glCanvasToCanvas(this.glCanvas, this.mainCanvas, true);
	}
	else
	{
		var I=0, displayables = 0, imageData = image.data;
		for (var r=0; r<h; r++) 
		{
			var B = yScale(r);
			for (var c=0; c<w; c++, I+=4) 
			{
				var A = xScale(c);
				
				// deal with off-gamut d3-cam02 issue
				var offgamut = false;
				if (this.colorSpace == COLORSPACE_CAM02 && L < 40) {
					var limit = h*(20/250)+h*((160-20)/250)*(L/40);
					var offLimitC = [w/2-limit, w/2+limit];
					var offLimitR = [h/2+h*(20/250)-limit, h/2+h*(20/250)+limit];
					if  (!(c >= offLimitC[0] && c <= offLimitC[1] &&
						 r >= offLimitR[0] && r <= offLimitR[1]))
					{
						imageData[I]	= BACKGROUND[0];
						imageData[I+1] 	= BACKGROUND[1];
						imageData[I+2]	= BACKGROUND[2];
						imageData[I+3]	= 255;	
						offgamut = true;
						continue;
					}
				}

				var cLAB = this.colorSpace == COLORSPACE_LAB ? d3.lab(L, A, B) : d3.jab(L, A, B);
				if (cLAB.displayable()) 
				{
					var cRGB = d3.rgb(cLAB);

					imageData[I]	= cRGB.r;
					imageData[I+1] 	= cRGB.g;
					imageData[I+2]	= cRGB.b;
					imageData[I+3]	= 255;
					//displayables++;
				}
				else if (!offgamut)
				{
					imageData[I]	= BACKGROUND[0];
					imageData[I+1] 	= BACKGROUND[1];
					imageData[I+2]	= BACKGROUND[2];
					imageData[I+3]	= 255;	
				}
			}
		}
		context.putImageData(image, 0, 0);

	}

}


ColorPicker.prototype.xy2ab = function(xy, colorSpace) 
{
	if (!colorSpace) {
		colorSpace = this.colorSpace;
	}

	var w = +this.mainCanvas.width;
	var h = +this.mainCanvas.height;
	var a_range, b_range;

	switch (colorSpace) 
	{
	case COLORSPACE_LAB:
		a_range = A_RANGE;
		b_range = B_RANGE;
		break;

	case COLORSPACE_CAM02:
		a_range = JAB_A_RANGE;
		b_range = JAB_B_RANGE;
		break;
	}

	// create scales
	var aScale = d3.scaleLinear().range(a_range).domain([0, w-1]);
	var bScale = d3.scaleLinear().range(b_range).domain([h-1, 0]);
	return [
		aScale(xy[0]),
		bScale(xy[1])
	];
}

ColorPicker.prototype.ab2xy = function(ab, colorSpace) 
{
	if (!colorSpace) {
		colorSpace = this.colorSpace;
	}

	var w = +this.mainCanvas.width;
	var h = +this.mainCanvas.height;
	var a_range, b_range;

	switch (colorSpace) 
	{
	case COLORSPACE_LAB:
		a_range = A_RANGE;
		b_range = B_RANGE;
		break;

	case COLORSPACE_CAM02:
		a_range = JAB_A_RANGE;
		b_range = JAB_B_RANGE;
		break;
	}

	// create scales
	var xScale = d3.scaleLinear().domain(a_range).range([0, w-1]);
	var yScale = d3.scaleLinear().domain(b_range).range([h-1, 0]);
	return [
		xScale(ab[0]),
		yScale(ab[1])
	];
}

// expects an array of L, A, B. Returns a color D3 color object
// based in the current color space
ColorPicker.prototype.getColorFromAB = function(c) 
{
	switch (this.colorSpace)
	{
	case COLORSPACE_LAB:
		return d3.lab(c[0], c[1], c[2]);
		break;
	case COLORSPACE_CAM02:
		return d3.jab(c[0], c[1], c[2]);
		break;
	}
}

function getLab(c) 
{
	if (!isNaN(c.l) && !isNaN(c.a) && !isNaN(c.b)) {
		return c;
	}
	else
	{
		if (!isNaN(c.r) && !isNaN(c.g) && !isNaN(c.b)) {
			// we have an RGB. Convert it to LAB and return
			return d3.lab(d3.rgb(c.r, c.g, c.b));
		}
	}
}

// dispose of three js object and its children
function doDispose(obj)
{
    if (obj !== null)
    {
        for (var i = 0; i < obj.children.length; i++)
        {
            doDispose(obj.children[i]);
        }
        if (obj.geometry)
        {
            obj.geometry.dispose();
            obj.geometry = undefined;
        }
        if (obj.material)
        {
            if (obj.material.map)
            {
                obj.material.map.dispose();
                obj.material.map = undefined;
            }
            obj.material.dispose();
            obj.material = undefined;
        }
    }
    obj = undefined;
}
