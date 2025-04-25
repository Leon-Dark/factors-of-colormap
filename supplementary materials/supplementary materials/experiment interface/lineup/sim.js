var SIM_COUNT = 0;
var LAST_SIM = 0;
var MAX_SIM_COUNT = 8;
var SIM_GAP = 5;
var SIM_H = 30;
var SIM_W = 120;
var SIM_BIN_COUNT = 25;
var DEF_SIM_ITERATIONS = 75;

var SIM_HIST_BINS = 50;

function runHistSimulation(itr, expDistance, _lineup)
{
    if (!_lineup) {
        _lineup = lineupExp;
    }
    var HIST_W = 200;
    var HIST_H = 150;

    var samplers = _lineup.lineup.samplers;
    var sums = 0;
    var histogram = [];
    var bins = SIM_HIST_BINS;

    for (var b=0; b<bins; b++) {
        histogram.push(0);
    }

    for (var i=0; i<itr; i++) 
    {

        if (expDistance) {
            _lineup.modelWithExpectation(expDistance);
        }
        else {
            _lineup.randomModel();
        }

        for (var s=0; s<samplers.length; s++) 
        {
            var sampler = samplers[s];
            sampler.sampleModel();
            var hist = sampler.computeValueHistogram(bins);
            
            for (var b=0; b<bins; b++) {
                histogram[b] += hist[b]
            }
            sums++;
        }
    }

    // normalize hist
    var histData = [];
    for (var b=0; b<bins; b++) 
    {
        histogram[b] /= sums;
        histData.push({
            y: histogram[b],
            x: b/(bins-1)
        })
    }
    histData.push({x: 1, y: 0});
    histData.push({x: 0, y: 0});

    // plot
    var g = d3.select("#simulationResults");
    g.selectAll('*').remove();

    var lineGenerator = d3.line()
        .curve(d3.curveLinearClosed)
        .x(function(d) { return d.x*HIST_W})
        .y(function(d) { return (1-(d.y/0.3))*HIST_H});

    g.append('path')
        .attr('d', lineGenerator(histData))
        .style('stroke', '#4ad5ff')
        .style('stroke-width', '1px')
        .style('fill', '#4ad5ff')

    g.append('line')
        .attr('x1', 0).attr('x2', HIST_W)
        .attr('y1', HIST_H).attr('y2', HIST_H)
        .style('stroke', 'black');
    g.append('line')
        .attr('x1', 0).attr('x2', 0)
        .attr('y1', 0).attr('y2', HIST_H)
        .style('stroke', 'black');

    return histogram;

}

function runSimulation(itr) {
    // turn of callbacks (so we can do the Simulation
    // fairly quickly
    if (!itr) itr = DEF_SIM_ITERATIONS;
    var start = Date.now();
    UPDATE_CALLBACK = false;
    var distances = [], avgDist = 0;;
    for (var i=0; i<itr; i++)
    {
        lineupExp.randomModel();

        // compute model distance
        var d = lineupExp.modelDecoyDistance();
        distances.push(d);
        avgDist += d;
    }
    avgDist /= itr;

    UPDATE_CALLBACK = true;
    refreshModel();
    console.log("Simulation took: " + Math.floor((Date.now()-start)/1000+.5) + " secs");

    // create a freqHistogram
    var hist = [], maxHist = 0, stdDist = 0;
    for (var i=0; i<SIM_BIN_COUNT; i++) { hist.push(0); }
    for (var i=0; i<distances.length; i++)
    {
        var d = distances[i];
        var b = Math.min(SIM_BIN_COUNT-1, Math.floor(d * SIM_BIN_COUNT));

        hist[b]++;
        maxHist = Math.max(maxHist, hist[b]);
        stdDist += Math.pow(avgDist-d, 2);
    }
    stdDist = Math.sqrt(stdDist / (distances.length-1));

    // plot histogram
    d3.selectAll(".histogramNew").attr('class', 'histogram');

    var g = d3.select("#simulationResults");
    var simG;
    if (SIM_COUNT==MAX_SIM_COUNT)
    {
        simG = g.select("#sim" + LAST_SIM).select('g.histG');
        simG.selectAll('*').remove();
    }
    else {

        simG = g.append("g")
            .attr('id', 'sim' + (LAST_SIM)).attr('class', 'simHistogram')
            .attr('transform', 'translate(20,' + (LAST_SIM)*(SIM_H+SIM_GAP) + ")");
        simG.append('line')
            .attr('x1', 0).attr('x2', SIM_W)
            .attr('y1', SIM_H).attr('y2', SIM_H)
            .style('stroke', 'black');

        simG = simG.append('g').attr('class', 'histG');

        SIM_COUNT++;
    }

    LAST_SIM = (LAST_SIM+1) % MAX_SIM_COUNT;


    // plot the histogram
    (function(simG, hist, maxHist, avgDist, stdDist) {
        simG.selectAll('rect').data(hist)
            .enter().append('rect')
            .attr('x', function(d, i) { return i*(SIM_W/SIM_BIN_COUNT)})
            .attr('y', function(d, i) {
                return SIM_H * (1 - d/maxHist);
            })
            .attr('width', SIM_W/SIM_BIN_COUNT)
            .attr('height', function(d) { return (d/maxHist)*SIM_H; })
            .attr('class', 'histogramNew');

        // create a line for average / std
        simG.append('line')
            .attr('x1', avgDist*SIM_W).attr('x2', avgDist*SIM_W)
            .attr('y1', 0).attr('y2', SIM_H)
            .style('stroke', 'red')

        simG.append('line')
            .attr('x1', (avgDist-2*stdDist)*SIM_W).attr('x2', (avgDist+2*stdDist)*SIM_W)
            .attr('y1', SIM_H).attr('y2', SIM_H)
            .style('stroke', 'red')
            .style('stroke-width', '2px');

        simG.append('text')
            .attr('x', SIM_W)
            .attr('y', (10+SIM_H)/2).html('avg ' + avgDist.toFixed(2) + ' +/- ' + stdDist.toFixed(2) + ' std')
            .style('font-size', '10px')


    })(simG, hist, maxHist, avgDist, stdDist);

    return {
        distances: distances,
        avgDist: avgDist,
        stdDist: stdDist,
    };
}


var PLOT_W = 169;
var PLOT_H = 110;
function plotParamSweep(svg, results, xScale, yScale)
{
    svg.selectAll("*").remove();
    svg = svg.append('g')
        .attr('transform', 'translate(30,0)');

    // plot line of presumed JND
    svg.append('line')
        .attr('x1', 0).attr('x2', PLOT_W)
        .attr('y1', yScale(.15)).attr('y2', yScale(.15))
        .style('stroke', "#cccccc")

    svg.selectAll("circle").data(results).enter()
        .append('circle')
        .attr('cx', function(d) { return xScale(d.p); })
        .attr('cy', function(d) { return yScale(d.avgDist); })
        .attr('r', 3)
        .style('fill', 'black')
        .style('stroke', null);

    svg.selectAll("line").data(results).enter()
            .append('line')
            .attr('x1', function(d) { return xScale(d.p); })
            .attr('x2', function(d) { return xScale(d.p); })
            .attr('y1', function(d) { return yScale(d.avgDist-2*d.stdDist); })
            .attr('y2', function(d) { return yScale(d.avgDist+2*d.stdDist); })
            .style('stroke', 'black');

    // plot plot scale
    var xAxis = d3.axisBottom().scale(xScale).ticks(5)
    svg.append('g')
        .call(xAxis)
        .attr('transform', 'translate(0,' + PLOT_H + ')');

    var yAxis = d3.axisLeft().scale(yScale)
        svg.append('g')
            .call(yAxis)
}

var SIMRESULTS=null;
function saveSimResults()
{
    if (!SIMRESULTS) {
        runParametersSim();
    }
    var seeds = [];
    for (var i=0; i<SIMRESULTS.length; i++) {
        var rec = SIMRESULTS[i];
        seeds.push({
            center: rec.center,
            correlation: rec.correlation,

            // expected divergence
            expectation: rec.avgDist,

            // standard deviation
            std: rec.stdDist
        });
    }
    console.save(seeds, 'block_seed.json');
    SIMRESULTS = null;
}
function runParametersSim(param, steps)
{
    var _M_PERTURB = M_PERTURB;
    var _R_PERTURB = R_PERTURB;

    if (!param) {
        param = ['center'];
    }


    // run through runParameters
    var p1 = param[0];
    var p2 = param[1];
    var results = [];
    if (!steps) steps = 20;



    var scaleMax = 0, minX, maxX;
    for (var i=0; i<steps; i++)
    {
        var p;
        if (p1 == 'center')
        {
            M_PERTURB = MIN_M_PERTURB + (i/(steps-1)) * (MAX_M_PERTURB-MIN_M_PERTURB);
            p = M_PERTURB;
            minX = MIN_M_PERTURB;
            maxX = MAX_M_PERTURB;
        }
        else if (p1 == 'correlation')
        {
            R_PERTURB = MIN_R_PERTURB + (i/(steps-1)) * (MAX_R_PERTURB-MIN_R_PERTURB);
            p = R_PERTURB;
            minX = MIN_R_PERTURB;
            maxX = MAX_R_PERTURB;
        }

        var rs = runSimulation();
        rs.p = p;
        rs.center = M_PERTURB;
        rs.correlation = R_PERTURB;

        scaleMax = Math.max(scaleMax, rs.avgDist+rs.stdDist);
        results.push(rs);
    }

    // plot
    var xScale = d3.scaleLinear().domain([minX-0.01, maxX]).range([0, PLOT_W]);
    var yScale = d3.scaleLinear().domain([0, scaleMax]).range([PLOT_H, 0]);
    plotParamSweep(d3.select("#simulationResults"), results, xScale, yScale);

    SIMRESULTS = results;
}
