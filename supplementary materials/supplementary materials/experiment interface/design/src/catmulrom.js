// Implementation of CatmulRom splines
// based on:
// https://en.wikipedia.org/wiki/Centripetal_Catmull%E2%80%93Rom_spline

var SAMPLES_PER_CURVE_SEGMENT = 40;


function vmult(scalar, v) {
	return [
		scalar * v[0],
		scalar * v[1],
		scalar * v[2]
	];
}

function vadd(x, y) {
	return [
		x[0]+y[0],
		x[1]+y[1],
		x[2]+y[2]
	];
}

function vsub(x, y)
{
	return [
		x[0]-y[0],
		x[1]-y[1],
		x[2]-y[2]
	];	
}

function normalize(a)
{
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

function vlen(a) {
	return Math.sqrt(a[0]*a[0] + a[1]*a[1] + a[2]*a[2]);
}

function CatmulRom4(p0, p1, p2, p3, _t)
{
	var ALPHA = 0.5;


	function GetT(t, _p0, _p1)
	{
		var a = 
			Math.pow((_p1[0]-_p0[0]), 2) + 
			Math.pow((_p1[1]-_p0[1]), 2) +
			Math.pow((_p1[2]-_p0[2]), 2);

		var b = Math.pow(a, 0.5);
		var c = Math.pow(b, ALPHA);
		return (c + t);
	}

	var t0 = 0.0;
	var t1 = GetT(t0, p0, p1);
	var t2 = GetT(t1, p1, p2);
	var t3 = GetT(t2, p2, p3);

	var t = _t * (t2-t1) + t1;

	var A1 = vadd( vmult( (t1-t)/(t1-t0), p0 ) , vmult( (t-t0)/(t1-t0), p1 ) );
	var A2 = vadd( vmult( (t2-t)/(t2-t1), p1 ) , vmult( (t-t1)/(t2-t1), p2 ) );
	var A3 = vadd( vmult( (t3-t)/(t3-t2), p2 ) , vmult( (t-t2)/(t3-t2), p3 ) );
	    
	var B1 = vadd( vmult( (t2-t)/(t2-t0), A1 ) , vmult( (t-t0)/(t2-t0), A2 ) );
	var B2 = vadd( vmult( (t3-t)/(t3-t1), A2 ) , vmult( (t-t1)/(t3-t1), A3 ) );
	    
	var C  = vadd( vmult( (t2-t)/(t2-t1), B1 ) , vmult( (t-t1)/(t2-t1), B2 ) );
    
	return C;
}

function vpad(a, b, c)
{
	var v1 = (vsub(b, a));
	var v2 = c ? (vsub(c, b)) : [0, 0, 0];
	var d1 = vlen(v1);
	var d2 = vlen(v2);

	var v = vadd( normalize(v1), normalize(v2) );
	return vmult( c ? (d1+d2)/2 : 1, normalize(v) );
}

// uniformly sampled CatmulRom curve
function CatmulRom(controls, pad)
{
	if (pad) 
	{
		var l = controls.length;	
		var v0 = vpad(controls[0], controls[1], controls[2]);
		var p0 = vsub(controls[0], v0);


		var v1 = vpad(controls[l-1], controls[l-2]);
		var p1 = vadd(controls[l-1], v1);

		var newControls = ([p0]).concat(controls);
		newControls.push(p1);
		controls = newControls;
	}

	var out = [];
	for (var i=1; i<controls.length-2; i++) 
	{

		for (var j=0; j<SAMPLES_PER_CURVE_SEGMENT; j++)
		{
			var t = j/(SAMPLES_PER_CURVE_SEGMENT-1);
			var p = CatmulRom4
			( 
				controls[i-1],
				controls[i  ],
				controls[i+1],
				controls[i+2],
				t
			);
			out.push(p);

		}
	}
	this.controls = controls;
	this.curve = out;

	// add up distances
	var totalD = 0;
	var distances = [];

	for (var i=0; i<out.length-1; i++) 
	{
		var p0 = out[i];
		var p1 = out[i+1];
		var d = Math.sqrt(
			Math.pow(p0[0]-p1[0], 2) +
			Math.pow(p0[1]-p1[1], 2) +
			Math.pow(p0[2]-p1[2], 2)
		);
		distances.push(d);
		totalD += d;
	}

	// normalize d by total distances
	for (var i=0; i<distances.length; i++) 
	{
		distances[i] /= totalD;
		
	}
	this.distances = distances;

}

CatmulRom.prototype.sumDistanceTo = function(index) 
{
	var running = 0;
	var distances = this.distances;

	for (var i=0, len=Math.min(index, distances.length-1); i<len; i++) {
		running += distances[i];
	}
	return running;
}

CatmulRom.prototype.getTFromIndex = function(index)
{
	if (index == 0) {
		return 0;
	}
	else if (index >= this.controls.length-2-1) {
		return 1;
	}
	else {
		return this.sumDistanceTo(index * SAMPLES_PER_CURVE_SEGMENT -1);
	}
}

CatmulRom.prototype.interpolate = function(t)  
{
	// figure out we're we are in total distance
	var distances = this.distances;
	var curve = this.curve;

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
		var c0 = curve[index];
		var c1 = curve[index+1];

		return [
			s * (c1[0]-c0[0]) + c0[0],
			s * (c1[1]-c0[1]) + c0[1],
			s * (c1[2]-c0[2]) + c0[2],
		];
	}
	else
	{
		return null;
	}
}
