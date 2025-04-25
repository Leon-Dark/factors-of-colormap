function LineupMulti(w, h, n, realModel, decoyModels, nullOption, table)
{
    // total number of exposures (n-1 actual + 1 decoy)
    this.w = w;
    this.h = h;
    this.n = n;

    this.realModel = realModel;
    this.decoyModels = decoyModels;

    // create canvases and samplers
    this.canvases = [];
    this.samplers = [];

    this.nullOption = nullOption;

    var canvasType = 'canvas'
    if (typeof CANVAS_TYPE === 'string') {
        canvasType = CANVAS_TYPE
    }
    var samplerType = ScalarSample;
    if (typeof SAMPLER_TYPE !== 'undefined') {
        samplerType = SAMPLER_TYPE;
    }

    // initialize random canvases
    for (var i=0; i<n; i++)
    {
        this.canvases.push(null);
    }
    if (table) {
        this.layoutCanvases(table)
    }

    var decoyCount = this.decoyModels.length;
    this.correctSample = [];

    for (var i=0; i<n; i++)
    {
        var canvas = this.canvases[i];
        if (!canvas) {

            canvas = document.createElement(canvasType);

            if (canvasType == 'svg')
            {
                d3.select(canvas)
                    .attr('width', w)
                    .attr('height', h);
            }
            else
            {
                canvas.width = w;
                canvas.height = h;
            }

            canvas.id="sample" + i;
            this.canvases[i] = ( canvas );
        }

        // sampler
        var model;
        if (i < n-decoyCount)
        {
            model = this.realModel;
        }
        else
        {
            var mIndex = i-(n-decoyCount)
            model = this.decoyModels[mIndex];
            this.correctSample.push(i);
        }

        var sampler = new samplerType(w, h, canvas, model);
        this.samplers.push(sampler);
    }
}
LineupMulti.prototype = Object.create(Lineup.prototype);

LineupMulti.prototype.randomizeSamples = function()
{
    var randomCanvases = this.canvases.slice();
    var decoyCanvases = [];
    for (var i=0; i<this.decoyModels.length; i++)
    {
        decoyCanvases.push(randomCanvases.pop());
    }
    decoyCanvases.reverse();

    // reinsert
    for (var i=0; i<this.decoyModels.length; i++)
    {
        var insertPos = Math.floor( Math.random() * (randomCanvases.length+1) );
        randomCanvases.splice(insertPos, 0, decoyCanvases[i]);
    }

    var correctSamples = [];
    for (var i=0; i<this.decoyModels.length; i++)
    {
        var d = decoyCanvases[i];
        for (var j=0; j<randomCanvases.length; j++)
        {
            if (randomCanvases[j].id == d.id)
            {
                correctSamples.push(j)
            }
        }
    }

    this.randomizedCanvases = randomCanvases;
    this.correctSample = correctSamples;
    //console.log('correct sample: ' + correctSamples[0] + ', ' + correctSamples[1]);
}

LineupMulti.prototype.randomLineup = function(fidelity, container)
{
    var _this = this;

    // generate colormap
    var result = generateStimuli();
    var colormap = result.colormap;
    var offsets = result.offsets;

    // create lineup
    var lineup = container.selectAll('tr')
        .data(colormap)
        .enter()
        .append('tr');

    // return both the lineup and the offsets
    return {
        lineup: lineup,
        offsets: offsets
    };
}

function LineupMultiFixed(w, h, n, realModel, decoyModels, nullOption, table)
{
    this.w = w;
    this.h = h;
    this.n = n;

    this.realModel = realModel;
    this.decoyModels = decoyModels;

    // create canvases and samplers
    this.canvases = [];
    this.samplers = [];

    this.nullOption = nullOption;

    this.canvasType = 'canvas';
    if (typeof CANVAS_TYPE === 'string') {
        this.canvasType = CANVAS_TYPE;
    }
    var samplerType = ScalarSample;
    if (typeof SAMPLER_TYPE !== 'undefined')
    {
        samplerType = SAMPLER_TYPE;
    }

    (function(_table, canvases, canvasType)
    {
        var selectionSize = table.selectAll(canvasType).size();
        if (selectionSize != n) {
            console.error("LineupFixed: number of canvases (" + selectionSize + ") + doesn't match number of requested lineup samples (" + n + ")");
        }

        table.selectAll(canvasType).each(function() {
            canvases.push(d3.select(this));
            d3.select(this)
                .attr('id', 'sample' + (canvases.length-1))
                .classed('index' + (canvases.length-1), true);
        });

        table
            .attr('cellpadding', LINEUP_PADDING).attr("cellspacing", LINEUP_SPACING);
    })(table, this.canvases, this.canvasType);
    this.table = table;

    // create samplers
    for (var i=0; i<n; i++)
    {
        var canvas = this.canvases[i];
        var sampler = new samplerType(w, h, canvas, i==n-1 ? this.decoyModel : this.realModel);
        this.samplers.push(sampler);
    }

    // randomly assign the real model
    this.randomAssignCorrect()

}

LineupMultiFixed.prototype = Object.create(LineupMulti.prototype);

LineupMultiFixed.prototype.setBlockOffset = function(offset) {
    this.currentOffset = offset;
};

LineupMultiFixed.prototype.getBlockOffset = function() {
    return this.currentOffset;
};

LineupMultiFixed.prototype.randomAssignCorrect = function()
{
    // generate random number
    var correctIndices = [];
    for (var i=0; i<this.decoyModels.length; i++)
    {
        var done = false;

        do
        {
            var r = Math.floor(Math.random() * this.canvases.length);

            for (var j=0; j<correctIndices.length; j++) {
                if (r == correctIndices[j]) {
                    r = -1;
                    break;
                }
            }
            if (r >= 0)
            {
                done = true;
                correctIndices.push(r);
            }
        } while (!done)
    }

    for (var i=0; i<this.n; i++)
    {
        var dontVis = true, assigned = false;
        for (var j=0; j<correctIndices.length; j++)
        {
            if (correctIndices[j] == i)
            {
                this.samplers[i].setModel(this.decoyModels[j], dontVis);
                assigned = true;
                break;
            }
        }
        if (!assigned) {
            this.samplers[i].setModel(this.realModel, dontVis);
        }

    }
    this.correctSample = correctIndices;
}

function LineupExperimentTwo(w, h, n, realModel, decoyModels, nullOption, table) {
    LineupMultiFixed.call(this, w, h, n, realModel, decoyModels, nullOption, table);
    this.blockOffset = null;
}

LineupExperimentTwo.prototype = Object.create(LineupMultiFixed.prototype);

// 继承后重新设置构造函数
LineupExperimentTwo.prototype.constructor = LineupExperimentTwo;

LineupExperimentTwo.prototype.setBlockOffset = function(offset) {
    this.blockOffset = offset;
};

LineupExperimentTwo.prototype.getBlockOffset = function() {
    return this.blockOffset;
};
