// Linear Interpolation

// simple linear interpolation
function interpolateLinear(c0, c1, t)
{
	return [
		c0[0] + t*(c1[0]-c0[0]),
		c0[1] + t*(c1[1]-c0[1]),
		c0[2] + t*(c1[2]-c0[2])
	];	
}

// Bezier
function interpolateBezier(controls, t) 
{
	if (controls.length == 2) 
	{
		return interpolateLinear(controls[0], controls[1], t);
	}
	else
	{
		var newControls = [];
		for (var i=0; i<controls.length-1; i++) 
		{
			newControls.push(
				interpolateLinear(controls[i], controls[i+1], t)
			);
		}
		return interpolateBezier(newControls, t);
	}
}

function sumThrough(array, index)
{
	var running = 0;

	for (var i=0, len=Math.min(index, array.length-1); i<=len; i++) {
		running += array[i];
	}
	return running;
}

var LINEAR_UNIFORM = 1;
var LINEAR_NON_UNIFORM = 2;

function LinearInterpolation(controls, type)
{
	// add up distances
	var totalD = 0;
	var distances = [];

	for (var i=0; i<controls.length-1; i++) 
	{
		var p0 = controls[i];
		var p1 = controls[i+1];
		var d = Math.sqrt(
			Math.pow(p0[0]-p1[0], 2) +
			Math.pow(p0[1]-p1[1], 2) +
			Math.pow(p0[2]-p1[2], 2)
		);
		distances.push(d);
		totalD += d;
	}

	// normalize d by total distances
	for (var i=0; i<distances.length; i++) {
		distances[i] /= totalD;
	}
	this.distances = distances;
	this.controls = controls;
	this.interpolationType = type;
}

LinearInterpolation.prototype.interpolate = function(t)
{
	switch (this.interpolationType)
	{
	case LINEAR_UNIFORM:
		return this.interpolateUniform(t);
		break;
	case LINEAR_NON_UNIFORM:
		return this.interpolateNonUniform(t);
		break;
	}
}

LinearInterpolation.prototype.interpolateUniform = function(t) 
{
	var distances = this.distances;
	var controls = this.controls;

	// figure out we're we are in total distance
	var running = 0;
	var index = distances.length-1;
	for (var i=0; i<distances.length; i++) 
	{
		var d = distances[i];
		running += d;
		if (t <= running) {
			index = i;
			break;
		}
	}

	if (index >= 0)
	{
		var s = 1-((running - t) / distances[index]);
		var c0 = controls[index];
		var c1 = controls[index+1];

		return [
			s * (c1[0]-c0[0]) + c0[0],
			s * (c1[1]-c0[1]) + c0[1],
			s * (c1[2]-c0[2]) + c0[2],
		];
	}
	else
	{
		console.log("error!")
		return null;
	}	
}

LinearInterpolation.prototype.interpolateNonUniform = function(t)
{
	var controls = this.controls;

	var k = t * (controls.length-1);
	var k0 = Math.floor(k);
	var k1 = Math.ceil(k);
	if (k0 == k1) {
		if (k0==0) { 
			k1 = 1;
		}
		else if (k0==controls.length-1) { 
			k0 = k1-1;
		}
	}

	// compute a 't' between k0 and k1
	var running = k0/(controls.length-1);
	var l = 1/(controls.length-1);
	var s = (t-running)/l;

	// interpolate between k0 and k1
	c0 = controls[k0];
	c1 = controls[k1];
	return interpolateLinear(c0, c1, s);
}

LinearInterpolation.prototype.getTFromIndex = function(index)
{
	switch (this.interpolationType)
	{
	case LINEAR_NON_UNIFORM:
		return index/(this.controls.length-1);
		break;

	case LINEAR_UNIFORM:
		if (index == 0) {
			return 0;
		}
		else if (index >= this.controls.length-1) {
			return 1;
		}
		else {
			return sumThrough(this.distances, index-1);
		}
		break;
	}
}

