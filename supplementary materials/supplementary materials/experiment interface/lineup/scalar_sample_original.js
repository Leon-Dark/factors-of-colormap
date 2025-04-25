var BLUR=false;
var BLUR_STAGE = 9;
var SCALAR_UPPER_PERCENTILE = 1-.001/1;
var HISTOGRAM_BINS = 60;
var GPU_SAMPLING = true;

// disable renderer caching, forcing new canvases each time
ALL_SAMPLERS = [];

var CALLBACK_SAMPLE = true;

var SHADER_PATH = '';

var shaderList = [
    {name: 'pdfSample', path: 'design/src/shaders/pdfSample.glsl'},
 

    {name: 'visWithMax',		path: 'design/src/shaders/visWithMax.frag'},
    {name: 'vertex',	path: 'design/src/shaders/vertex.vert'},
 
    {name: 'blurOff',   path: 'design/src/shaders/blur7Offscreen.frag'},
];

function ScalarSample(w, h, canvas, model, colormap)
{
    this.w = w;
    this.h = h;
    this.field = new ScalarField(w, h);
    this.model = model;
    this.canvas = canvas;

    // add myself to the model
    if (model)
    {
        this.setModel(model);
    }

    // if we're passed a d3 selection, convert to a standard canvas
    if (this.canvas.selectAll) {
        this.canvas = this.canvas.node();
    }

    // if there's a shader path prefix, add it to all shaders
    if (SHADER_PATH !== null && SHADER_PATH !== undefined) {
        for (var i=0; i<shaderList.length; i++)
        {
            var shader = shaderList[i];
            shader.path = SHADER_PATH + shader.path;
        }
        SHADER_PATH = null;
    }

    if (this.canvas)
    {
        (function(me) {
            me.visualizer = new ColorAnalysis(
                me.field, me.canvas,
                function()
                {
                    console.log('initVisPipeline');
                    me.initVisPipeline();
                }, shaderList
            );
        })(this);
    }

    if (!colormap) {
        this.field.setColorMap(getColorPreset("Viridis"));
    }
    else {
        this.field.setColorMap(colormap);
    }
    ALL_SAMPLERS.push(this);
}

ScalarSample.prototype.dispose = function()
{
    for (var i=0; i<ALL_SAMPLERS.length; i++) {
        var s = ALL_SAMPLERS[i];
        if (s == this) {
            ALL_SAMPLERS.splice(i, 1);
            break;
        }
    }

    if (this.canvas) {
        var c = this.canvas
        if (!c.attr) {
            c = d3.select(this.canvas);
        }
        removeRenderCache(c.attr('id'));

    }
    this.field = null;
    this.model = null;
    this.canvas = null;
    this.w = null;
    this.h = null;
}

ScalarSample.prototype.setColorMap = function(colormap)
{
    this.field.setColorMap(colormap);
}

ScalarSample.setUniversalColormap = function(colormap, dontVis) {
    for (var i=0; i<ALL_SAMPLERS.length; i++)
    {
        ALL_SAMPLERS[i].setColorMap(colormap);

        // render?
        if (!dontVis) {
         ALL_SAMPLERS[i].vis();
        }
    }
}

ScalarSample.prototype.setModel = function(_model, dontVis)
{
    if (this.model) {
        this.model.unregisterCallback(this.callbackID);
        this.model = null;
    }

    this.model = _model;
    (function(me) {
        me.callbackID = me.model.addCallback(function()
        {
            if (CALLBACK_SAMPLE || me.callbackSample)
            {
                //console.log('callback sampling');
                me.sampleModel();
                if (me.canvas || me.svg) {
                    me.vis();
                }
            }
        });
    })(this);

    if (this.canvas && !dontVis)
    {
        this.sampleModel();
        this.vis();
    }
}

ScalarSample.prototype.setSamplingFidelity = function(fidelity)
{
    this.localN = fidelity;
}

ScalarSample.prototype.sampleModel = function(_fidelity, model)
{
    if (!model) {
        model = this.model;
    }

    if (GPU_SAMPLING)
    {
        // copy pdf over to field
        var pdf = model.getPDF().view;
        var field = this.field.view;
        var minP = Number.MAX_VALUE, maxP = Number.MIN_VALUE;

        for (var i=0, len=field.length; i<len; i++)
        {
            var p = pdf[i];
            field[i] = p;
            if (p < minP) {
                minP = p;
            }
            else if (p > maxP) {
                maxP = p;
            }
        }
        var _lenP = 1 / (maxP-minP);
        for (var i=0, len=field.length; i<len; i++)
        {
            var p = (field[i] - minP) * _lenP;
            if (model.flipDensity) {
                p = 1-p;
            }
            field[i] = p;
        }

        this.field.updated();
    }
    else {

        var fidelity = !isNaN(_fidelity) ? _fidelity : this.localN;
        if (!fidelity || isNaN(fidelity)) {
            if (typeof N === 'undefined') {
                fidelity = 0;
            }
            else {
                fidelity = N;
            }
        }
        if (!model) {
            model = this.model;
        }

        var upperPercentile = undefined;
        if (typeof SCALAR_UPPER_PERCENTILE !== 'undefined') {
            upperPercentile = SCALAR_UPPER_PERCENTILE;
        }
        model.sampleModel(fidelity, this.field, upperPercentile);
    }
}

ScalarSample.prototype.sampleAndVis = function(_fidelity)
{
    this.sampleModel(_fidelity);
    this.vis();
}

ScalarSample.prototype.vis = function()
{
    if (!this.canvas)
    {
        console.log("Error: ScalarSample doesn't have a canvas.");
    }
    else if (!this.visualizer || !this.visualizer.ready())
    {
        // pipeline not yet ready. Set flag to callVis when it's ready
        this.callVisFlag = true;
    }
    else {
        if (this.highFidelity && GPU_SAMPLING) {
            this.visualizer.run('plotPDF');
        }
        else {
            this.visualizer.run(BLUR ? 'blur' : 'vis');
        }
    }
}

ScalarSample.prototype.computeValueHistogram = function(_bins)
{

    var field = this.field;
    var hist = field.calcAmplitudeFrequency(_bins || HISTOGRAM_BINS);
    var histSum = d3.sum(hist);
    for (var i=0; i<hist.length; i++) {
        hist[i] /= histSum;
    }
    return hist;
}

ScalarSample.prototype.initVisPipeline = function()
{
    if (!this.canvas) {
        console.log("Error: ScalarSample doesn't have a canvas.");
        return;
    }

    var plotPDF = new GLPipeline(this.visualizer.glCanvas);
    plotPDF.addStage({
        uniforms:
        {
            scalarField: {},
            colormap: {},
        },
        inTexture: 'scalarField',
        fragment: this.visualizer.shaders['pdfPlot'],
        vertex: this.visualizer.shaders['vertex']
    });

    var sampleAndVis = new GLPipeline(this.visualizer.glCanvas);
    sampleAndVis.addStage({
        uniforms:
        {
            scalarField: {},
            randomSeed: {value: -1.0},
        },
        inTexture: 'scalarField',
        fragment: this.visualizer.shaders['pdfSample'],
        vertex: this.visualizer.shaders['vertex']
    });

    // blur
    for (var i=1, stageCount = BLUR_STAGE-1; i<=stageCount; i++)
    {
        var blurShader;
        if (i == stageCount)
        {
            // add a CPU computation stages
            var cpuStage = {
                cpuComputation: function(buffer) {
                    var minValue = Number.MAX_VALUE;
                    var maxValue = Number.MIN_VALUE;
                    for (var i=0, len=buffer.length; i<len; i++)
                    {
                        var v = buffer[i];
                        if (v > maxValue) {
                            maxValue = v;
                        }
                        else if (v < minValue) {
                            minValue = v;
                        }
                    }
                    return {
                        maxValue: maxValue,
                        minValue: minValue,
                        normTerm: 1.0 / (maxValue-minValue)
                    };
                }
            }
            sampleAndVis.addStage(cpuStage);

            // add a standard vis stage
            blurShader = 'visWithMax';
            sampleAndVis.addStage({
                uniforms: {
                    scalarField: {},
                    colormap: {},
                    contour: {value: -1},
                    minValue: {
                        value: null,
                        cpuComputation: true,
                        index: 0, id: 'minValue'
                    },

                    normTerm: {
                        value: null,
                        cpuComputation: true,
                        index: 0, id: 'normTerm'
                    }
                },
                inTexture: 'scalarField',
                fragment: this.visualizer.shaders[blurShader],
                vertex: this.visualizer.shaders['vertex']
            });
        }
        /*
        else if (i == stageCount-1)
        {
            blurShader = 'medianOff';
            sampleAndVis.addStage({
                uniforms: {
                    scalarField: {},
                    colormap: {},
                    pitch: {value: [1/this.field.w, 1/this.field.h]}
                },
                inTexture: 'scalarField',
                fragment: this.visualizer.shaders[blurShader],
                vertex: this.visualizer.shaders['vertex']
            });
        }
        */
        else {
            blurShader = 'blurOff';
            sampleAndVis.addStage({
                uniforms: {
                    scalarField: {},
                    colormap: {},
                    pitch: {value: [1/this.field.w, 1/this.field.h]}
                },
                inTexture: 'scalarField',
                fragment: this.visualizer.shaders[blurShader],
                vertex: this.visualizer.shaders['vertex']
            });
        }
    }


    var vis = new GLPipeline(this.visualizer.glCanvas);
    vis.addStage({
        uniforms: {
            scalarField: {},
            colormap: {},
            contour: {value: -1.0},
        },
        inTexture: 'scalarField',
        fragment: this.visualizer.shaders['vis'],
        vertex: this.visualizer.shaders['vertex']
    });

    // blur + vis
    var blur = new GLPipeline(this.visualizer.glCanvas);

    // for multi-stage blurring, add a final medianBlur
    for (var i=1; i<=BLUR_STAGE; i++)
    {
        var blurShader;
        if (i == BLUR_STAGE)
        {
            // add a CPU computation stages
            var cpuStage = {
                cpuComputation: function(buffer) {
                    var minValue = Number.MAX_VALUE;
                    var maxValue = Number.MIN_VALUE;
                    for (var i=0, len=buffer.length; i<len; i++)
                    {
                        var v = buffer[i];
                        if (v > maxValue) {
                            maxValue = v;
                        }
                        else if (v < minValue) {
                            minValue = v;
                        }
                    }
                    return {
                        maxValue: maxValue,
                        minValue: minValue
                    };
                }
            }
            blur.addStage(cpuStage);

            // add a standard vis stage
            blurShader = 'visWithMax';
            blur.addStage({
                uniforms: {
                    scalarField: {},
                    colormap: {},
                    contour: {value: -1},
                    maxValue: {
                        value: null,
                        cpuComputation: true,
                        index: 0, id: 'maxValue'
                    }
                },
                inTexture: 'scalarField',
                fragment: this.visualizer.shaders[blurShader],
                vertex: this.visualizer.shaders['vertex']
            });
        }
        else {
            blurShader = 'blurOff';

            blur.addStage({
                uniforms: {
                    scalarField: {},
                    colormap: {},
                    pitch: {value: [1/this.field.w, 1/this.field.h]}
                },
                inTexture: 'scalarField',
                fragment: this.visualizer.shaders[blurShader],
                vertex: this.visualizer.shaders['vertex']
            });
        }
    }


    this.visualizer.pipelines = {
        plotPDF: plotPDF,
        vis: GPU_SAMPLING ? sampleAndVis : vis,
        blur: blur
    };

    //this.visualizer.createVisPipeline();
    if (this.callVisFlag) {
        this.callVisFlag = false;
        this.vis();
    }
}
