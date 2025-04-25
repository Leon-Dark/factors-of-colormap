var TEXT_OFFSET = 10;
var CIRCLE_RADIUS = 3;

// global markers
var markers = [], selectedMarker = null, destinationMarker = null

function getAllMarkers() { return markers; }

function Marker(svg, label, _x, _y) 
{
	var PAD = 30;
	var svgNode = svg.node();
	var w = +svgNode.width;
	var h = +svgNode.height;

	this.x = (_x !== undefined && _x !== null) ? _x : (w-PAD*2) * Math.random() + PAD;
	this.y = (_y !== undefined && _y !== null) ? _y : (h-PAD*2) * Math.random() + PAD;

	this.g = svg.append('g').attr('transform', 'translate(' + this.x + ',' + this.y + ')');
	this.circleGlow = this.g.append('circle')
		.attr('r', CIRCLE_RADIUS)
		.style('filter', 'url(#glow)')
		.style('fill', '#dddddd')
		.style('stroke', 'none');

	this.circle = this.g.append('circle')
		.attr('r', CIRCLE_RADIUS)
		.attr('stroke', 'none')
		.attr('fill', 'black');
			
	this.textGlow = this.g.append('text')
		.attr('class', 'marker')
		.attr('x', TEXT_OFFSET)
		.attr('y', -TEXT_OFFSET)
		.style('filter', 'url(#glow)')
		.style('fill', '#dddddd')
		.html(label || 'X');

	this.text = this.g.append('text')
		.attr('class', 'marker')
		.attr('x', TEXT_OFFSET)
		.attr('y', -TEXT_OFFSET)
		.html(label || 'X');

	(function(marker) {
		marker.g
			.on('mousedown', function() 
			{
				if (shiftKey && selectedMarker && selectedMarker != marker)
				{
					// add a destination marker
					destinationMarker = marker;

					// add a travel line
					//addProfileLine();
				}
				
				else {
					var mouse = d3.mouse(document.body)
					marker.mouse = mouse;
							
					unselectMarker();
					selectedMarker = marker;
					selectedMarker.highlight(true)

					d3.select(document).on('mousemove', function() 
					{
						var mouse = d3.mouse(document.body);
						var dX = mouse[0]-marker.mouse[0];
						var dY = mouse[1]-marker.mouse[1];
						marker.mouse = mouse;

						if (!marker.stationary) {
							marker.updatePosition(dX + marker.x, dY + marker.y);
						}

					});

					d3.select(document).on('mouseup', function() {
						marker.mouse = undefined;
						d3.select(document).on('mousemove', null).on('mouseup', null);
					});
				}

				d3.event.stopPropagation();
			});
	})(this);

	this.markerIndex = markers.length;

	// arm the svg to unselect, if clicked anywhere
	svg.on("mousedown", function() {
		unselectMarker();
	})
}

Marker.prototype.updatePosition = function(x, y) 
{
	if (x !== null && x !== undefined) this.x = x;
	if (y !== null && y !== undefined) this.y = y;

	this.g.attr('transform', 'translate(' + this.x + ',' + this.y + ')');
	printMarkers();
}
Marker.prototype.getX = function() {
	return this.x;
}
Marker.prototype.getY = function() {
	return this.y;
}
Marker.prototype.getLabel = function() {
	return this.text.html();
}

Marker.prototype.highlight = function(isSelected) 
{
	this.text.style('fill', isSelected ? 'red' : '');
}

Marker.prototype.textOffset = function(offset) {
	this.g.selectAll('text')
		.attr('x', offset)
		.attr('y', -offset);
}

Marker.prototype.remove = function() {
	this.g.remove();
	if (selectedMarker == this) {
		selectedMarker = null;
	}
	printMarkers();
}

Marker.prototype.changeMarkerLetter = function(letter)
{
	this.textGlow.html(letter);
	this.text.html(letter);
	printMarkers();
}


// ================================================
// Markers
// ================================================
function removeAllMarkers() {
	for (var i=0; i<markers.length; i++) {
		var m = markers[i];
		m.remove();
		selectedMarker = null;
	}
	markers = [];
}
function parseMarkers(markerString)
{
	for (var i=0; i<markers.length; i++) {
		markers[i].remove();
	}
	markers = []; selectedMarker = null;

	var tokens = markerString.split(',');
	var A = null, B = null;
	for (var i=0; i<tokens.length; i+=3)
	{
		var label = tokens[i];
		var x = +tokens[i+1];
		var y = +tokens[i+2];
		var marker = new Marker(d3.select("#svgOverlay"), label, x, y);
		markers.push( marker );
	}
	printMarkers();
}

function addMarker(label, x, y) 
{
	unselectMarker();
	selectedMarker = new Marker(d3.select('#svgOverlay'), label, x, y);
	markers.push(selectedMarker);

	// highlight as selected
	selectedMarker.highlight(true);
	printMarkers();
	return selectedMarker;
}

function unselectMarker() {
	if (selectedMarker) {
		selectedMarker.highlight(false);
	}
	selectedMarker = null;
	//removeProfileLine();
}

function printMarkers() 
{
	var output = "";
	for (var i=0, len=markers.length; i<len; i++) {
		var m = markers[i];
		output += m.getLabel() + "," + Math.floor(.5 + m.getX()) + ',' + Math.floor(.5 + m.getY());
		if (i != len-1) {
			output += ','
		}
	}
	//d3.select("#markerString").node().value = output;
	return output;
}

