		var SPECTRA_CHART_OFFSET = [30, 10]
		var SPECTRA_CHART_W = 150;
		var SPECTRA_CHART_H = 150;

		// ===========================================
		// Power spectra chart
		// ============================================
		function PowerSpectraChart(svg, w, h, maxFreq, maxPower)
		{
			this.w = w || SPECTRA_CHART_W;
			this.h = h || SPECTRA_CHART_H;
			w = this.w;
			h = this.h;

			// make a group for the chart
			this.g = svg.append('g').attr('class', 'powerChart')
				.attr('class', 'powerSpectraChart')
				.attr('transform', 'translate(' + SPECTRA_CHART_OFFSET[0] + ',' + SPECTRA_CHART_OFFSET[1] + ')');


			var xScale = d3.scale.log().domain([1, maxFreq  || 2000]).range([0, w]);
			var yScale = d3.scale.log().domain([1, maxPower || 2000]).range([h, 0]);
			this.xScale = xScale; this.yScale = yScale;

			// path generator for power spectra curves
			this.pathGenerator = d3.svg.line()
				.x(function(d) { return xScale(d.x+1); })
				.y(function(d) { return yScale(d.y+1); })

			// groups for the axes
			this.xAxisG = this.g.append("g").attr('class', 'xaxis').attr('transform', 'translate(0,'+h+')');
			this.yAxisG = this.g.append('g').attr('class', 'yaxis');

			// axes
			this.xAxis = d3.svg.axis()
				.scale(xScale)
				.ticks(0, ".1s")
				.orient('bottom');
			this.xAxisG.call(this.xAxis);

			this.yAxis = d3.svg.axis()
				.scale(yScale)
				.ticks(0, ".1s")
				.orient('left')
			this.yAxisG.call(this.yAxis);

		}

		PowerSpectraChart.prototype.plotSpectra = function(powerSpectra)
		{
			var curveCommand = this.pathGenerator(powerSpectra);
			var path = this.g.append('path')
				.attr('class', 'powerCurve')
				.attr('d', curveCommand)
				.style('stroke', 'black')
				.style('fill', 'none');
			return path;
		}
		PowerSpectraChart.prototype.plotMedian = function(medianFreq)
		{
			var x = this.xScale(medianFreq);
			var medianLine = this.g.append('line')
				.attr('class', 'powerCurve')
				.attr('x1', x).attr('x2', x)
				.attr('y1', 0)
				.attr('y2', this.h-1)
				.style('stroke', 'black').style('stroke-width', '1px');

			return medianLine;
		}