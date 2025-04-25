// ===========================================
// Douglas Peucker shape simplification
// ===========================================
var PROFILE_SHAPE_TOLERANCE = 1.5;

function Segment(p1, p2)
{
	this.dy = p2.y - p1.y;
	this.dx = p2.x - p1.x;
	this.nominator = p2.x*p1.y-p2.y*p1.x;
	this.denominator = Math.sqrt(this.dy * this.dy + this.dx * this.dx);
}

Segment.prototype.distanceToPoint = function(p)
{
	return Math.abs( this.dy*p.x - this.dx*p.y + this.nominator) / this.denominator;
}

function DouglasPeucker(points, r0, r1, tolerance)
{
	var index = r0;
	var dmax = 0;
	var segment = r0+1 <= r1-1 ? new Segment( points[r0], points[r1] ) : undefined;

	for (var i = r0+1, len=r1-1; i <= len; i++) 
	{
		var d = segment.distanceToPoint( points[i] );
		if (d > dmax) 
		{
			index = i;
			dmax = d;
		}
	}
	segment = undefined;

	if ( dmax > tolerance ) 
	{
		var recResults1 = DouglasPeucker(points, r0, index, tolerance); 
		var recResults2 = DouglasPeucker(points, index, r1, tolerance);	

		recResults1.pop();
		return recResults1.concat(recResults2);
	}
	else
	{
		return [ points[r0], points[r1] ];
	}
}


function Profile(scalar_or_profile, p1, p2)
{
	if ((p1 === null || p1 === undefined) || (p2 === null || p2 === undefined))
	{
		this.profile = scalar_or_profile;
	}
	else
	{
		var distance = Math.sqrt( Math.pow(p1.x-p2.x, 2) + Math.pow(p1.y-p2.y, 2) );
		this.profile = scalar_or_profile.sampleProfile(p1, p2, distance/3);
	}
}

Profile.prototype.similarity = function(profile2)
{
	function sample(profile, u)
	{
		var i=u*(profile.length-1);
		if (i%1 == 0) {
			return profile[i];
		}
		else
		{
			// linear interpolation
			var i0 = Math.floor(i);
			var i1 = Math.ceil(i);

			var p0 = profile[i0];
			var p1 = profile[i1];

			return (i-i0) * (p1-p0) + p0;
		}
	}

	var p1 = this.profile;
	var p2 = profile2.profile;
	var N = 100;

	/*
	var totalDiff = 0;
	for (var i=0; i<N; i++) 
	{
		pp1 = sample(p1, i/(N-1));
		pp2 = sample(p2, i/(N-1));
		totalDiff += Math.abs(pp2-pp1);
	}
	return 1 - (totalDiff / N);
	*/

	var ts1 = [], ts2 = [];
	for (var i=0; i<N; i++) {
		ts1.push(sample(p1, i/(N-1)));
		ts2.push(sample(p2, i/(N-1)));
	}
	ts1 = new Timeseries(ts1);
	ts2 = new Timeseries(ts2);
	var d = ts1.distance(ts2);

	return 1 - d/N;
}

Profile.prototype.visualize = function(svg, w, h)
{
	if (this.g) {
		this.remove();
	}

	var profile = this.profile;
	var profileShape = [];

	for (var i=0, samples=profile.length; i<samples; i++) {
		var p = {
			x: i/(samples-1) * w,
			y: (1-profile[i]) * h
		};

		profileShape.push(p);
		/*
		if (isNaN(p.x) || isNaN(p.y)) {
			console.error("NaN in profile!");
		}
		*/

	}

	var pathGenerator = d3.svg.line()
		.x(function(d) { return d.x; })
		.y(function(d) { return d.y; })

	var g = svg.append('g')
		.attr('class', 'profileShape');

	g.append('rect')
		.attr('width', w).attr('height', h)
		.style('stroke', 'black').style('fill', 'none');


	g.append('path')
		.attr('d', pathGenerator(profileShape))
		.style('stroke', 'black').style('fill', 'none')
		.style('stroke-width', '2px');
	
	this.g = g;
	return this.g;
}

function incrementProfileShapeTolerance(delta) {
	PROFILE_SHAPE_TOLERANCE += delta;
	if (PROFILE_SHAPE_TOLERANCE < 0) {
		PROFILE_SHAPE_TOLERANCE = 0;
	}
	return PROFILE_SHAPE_TOLERANCE;
}

Profile.prototype.visualizeToCanvas = function(canvas)
{

	var canvasNode = canvas.node();
	var w = canvasNode.width;
	var h = canvasNode.height;
	var ctx = canvasNode.getContext('2d');
	ctx.clearRect(0, 0, w, h);			
	
	var profileShape = this.getProfileShape(w, h);
	
	// simplify shape
	profileShape = DouglasPeucker(profileShape, 0, profileShape.length-1, PROFILE_SHAPE_TOLERANCE)

	ctx.strokeStyle="#000000";
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.moveTo(profileShape[0].x, profileShape[0].y);

	for (var i=1, len=profileShape.length; i<len; i++)
	{
		var p = profileShape[i];
		ctx.lineTo(p.x, p.y);
		ctx.stroke();
	}
}

Profile.prototype.reverse = function() {
	this.doReverse = true;
}

Profile.prototype.getProfileShape = function(w, h)
{
	var profile = this.profile;
	var profileShape = [];

	for (var i=0, samples=profile.length; i<samples; i++) {
		profileShape.push({
			x: ((this.doReverse ? samples-1-i : i) / (samples-1)) * w,
			y: (1-profile[i]) * h
		});
	}
	return profileShape;
}

Profile.prototype.getProfile = function() 
{
	return this.profile;
}

Profile.prototype.remove = function()
{
	if (this.g) {
		this.g.remove();
		this.g = undefined;
	}
}
