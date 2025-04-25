function SmallRadio(g, choices, _callback)
{
	this.g = g;

	// clear if anything
	this.g.selectAll('g').remove();

	// create groups for buttons
	this.buttons = this.g.selectAll('g').data(choices);
	this.buttons = this.buttons.enter().append('g')
		.attr('transform', function(d, i) {
			return 'translate(' + 0 + ',' + (i*14) + ')';
		})	
		.merge(this.buttons);

	(function(all, buttons, radio) {
		buttons.each(function(d, i) 
		{
			var thisG = d3.select(this);
			thisG.append('rect')
				.attr('x', 0).attr('y', 0).attr('class', 'smallButton' + (i==0 ? ' smallButtonClicked' : ''))
				.attr('width', '10').attr('height', '10');

			thisG.append('text')
				.attr('x', -5).attr('y', 9).attr('class', 'smallText')
				.attr('text-anchor', 'end').html(d.text);

			thisG.on('click', function(_d) 
			{
				all.selectAll('rect.smallButton').attr('class', 'smallButton');
				d3.select(this).select('rect').attr('class', 'smallButton smallButtonClicked');
				radio.fireCallback(_d.choice);
			});
		});
	})(this.g, this.buttons, this);

	if (_callback) {
		this.callback = _callback;
	}
}

SmallRadio.prototype.makeActive = function(_choice) 
{
	this.buttons.each(function(d) 
	{
		d3.select(this).select('rect')
			.attr('class', 'smallButton' + (d.choice===_choice ? ' smallButtonClicked' : ''));
	});
}

SmallRadio.prototype.addCallback = function() {
	this.callback = callback;
}

SmallRadio.prototype.fireCallback = function(choice) {
	this.callback(choice)
}