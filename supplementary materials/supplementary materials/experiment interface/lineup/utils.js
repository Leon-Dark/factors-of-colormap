
var HEATMAP_BIN_SIZE = [5, 5];

var MODEL_TYPE, DISCRETE_TYPE, SAMPLER_TYPE, CANVAS_TYPE;

function setRepresentationType(_vis_type)
{

	switch (_vis_type) {

		case 'mapSmooth':
			MODEL_TYPE = GaussMixBiDiscrete;
			SAMPLER_TYPE = ScalarSample;
			DISCRETE_TYPE = DiscreteMap;
			CANVAS_TYPE = 'canvas';
			break;

		case 'mapDiscrete':
			MODEL_TYPE = GaussMixBiDiscrete;
			SAMPLER_TYPE = DiscreteSampler;
			DISCRETE_TYPE = DiscreteMap;
			CANVAS_TYPE = 'svg';
			break;

		case 'fieldSmooth':
			MODEL_TYPE = GaussMixWithNoise;
			SAMPLER_TYPE = ScalarSample;
			DISCRETE_TYPE = undefined;
			CANVAS_TYPE = 'canvas';
			break;

		case 'fieldDiscrete':
			MODEL_TYPE = GaussMixBiDiscrete;
			SAMPLER_TYPE = DiscreteSampler;
			DISCRETE_TYPE = HeatMap;
			CANVAS_TYPE = 'svg';
			break;
	}
}

function createLineupElements(table, n, elementType, w, h)
{
	if (!elementType) {
		elementType = CANVAS_TYPE;
	}

    // how many rows
    var rows = 2;

    var rs = d3.range(rows);

    table.selectAll('tr').data(rs)
        .enter().append('tr')
        .each(function(rowNum)
        {
            var cols = Math.ceil(n/2);
            d3.select(this).selectAll('td').data(d3.range(cols))
                .enter().append('td').each(function(d, i) {
                    var index = i + rowNum*cols;
                    if (index < n)
                    {

                        d3.select(this).append(elementType)
                            .attr('width', w)
                            .attr('height', h)
                            .attr('id', "sample" + index);
                    }
                })
        });

    table
        .attr('cellspacing', 10)
        .attr('cellpadding', 10);

}

var US_COUNTY_PATHS = 'lineup/maps/us_county_paths.json';
var US_COUNTY_PIXEL_MAP = 'lineup/maps/us_countymap.json';


var US_COUNTY_DATA = null;
function drawPaths(paths, svg)
{
	// create a white background
	svg.append('rect')
		.attr('width', +svg.attr('width'))
		.attr('height', +svg.attr('height'))
		.style('fill', 'white')
		.style('stroke', 'none');

	// plot paths
	svg.selectAll('.county')
		.data(paths)
		.enter()
		.append('path')
			.attr('class', 'county choroplethBin')
			.attr('d', function(d) { return d.path })
			.attr('id', function(d) { return d.id; });
}


function qLoadJSON(url, callback)
{
	d3.json(url).then(function(data) {
		callback(null, data)
	});
}

var LOAD_ALL_REGARDLESS = false;
function setBasicMapData(width, height) {
	loadGlobalMapData({
		width: width,
		height: height,
		binSize: HEATMAP_BIN_SIZE
	});
}
function loadExperimentData(callback)
{
	var q = d3.queue();
	if (LOAD_ALL_REGARDLESS || VIS_TYPE.substr(0,3) == 'map')
	{
		console.log("load: " + US_COUNTY_PIXEL_MAP);
		q.defer(qLoadJSON, US_COUNTY_PIXEL_MAP)
	}
	if (LOAD_ALL_REGARDLESS || VIS_TYPE == 'mapDiscrete') {
		console.log("load: " + US_COUNTY_PATHS);
		q.defer(qLoadJSON, US_COUNTY_PATHS);
	}

	q.awaitAll(function(error, results)
	{
		var start = new Date();

		if (LOAD_ALL_REGARDLESS || VIS_TYPE == 'mapDiscrete')
		{
			var countyPaths = results[1];
			US_COUNTY_DATA = countyPaths;

			//drawPaths(countyPaths, svgTarget)
			//drawPaths(countyPaths, svgDecoy)

			if (!LOAD_ALL_REGARDLESS) {
				d3.select('#lineupTable').selectAll('svg')
					.each(function() {
						drawPaths(countyPaths, d3.select(this));
					});
			}
			console.log('map draw time: ' + ((new Date()-start)/1000).toFixed(2) + ' seconds');
		}

		// load pixel map data
		var dMapData;
		if (LOAD_ALL_REGARDLESS || VIS_TYPE.substr(0, 3) == 'map')
		{
			dMapData = results[0];
			dMapData.binSize = HEATMAP_BIN_SIZE;
		}
		else
		{
			dMapData = {
				width: WIDTH,
				height: HEIGHT,
				binSize: HEATMAP_BIN_SIZE
			}
		}

		// load global discrete map data
		loadGlobalMapData(dMapData);

		// initialize the lineup
		if (callback) {
			callback();
		}

		var e = ((new Date()) - start)/1000;
		console.log("Total setup time: " + e.toFixed(2) + ' sec');

	});
}
