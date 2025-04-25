// when sampling, how wide/long is a single sample? note: splat is centered
// around a randomly drawn coordinate
// 0 -> 1 pixel, 1-> 3 pixels, etc...
var SPLAT_SIZE=1;

// colors
var MODEL_COLORS = ['#e41a1c','#377eb8','#4daf4a','#984ea3','#ff7f00','#a65628','#f781bf','#999999'];

// maximum height of a gaussian in the model plot
var P_HEIGHT = 40;

// to speed up sampling, we create a map from a uniform probability distribution to
// the gaussin mix distribution. MAP_SIZE determines the resolution of this map
// (higher resolution=less aliasing)
var MAP_SIZE = 100;

// activate callbacks on model update
var UPDATE_CALLBACK = true;

function gauss(x, p) {
    var mue = p[0]
    var delta = p[1];
    var scaler = (p[2] === undefined || p[2] === null) ? 1 : p[2];

    var k = delta * Math.sqrt(2*Math.PI);
    return scaler * (1/k)*Math.exp(-0.5 * Math.pow((x-mue)/delta, 2) );
}

function GaussMix(w, h, svg)
{
    this.w = w;
    this.h = h;
    this.svg = svg;

    this.models = [];
    this.modelMaxX = 0;
    this.modelMaxY = 0;

    this.cdfX = null;
    this.mapX = null;
    this.cdfY = null;
    this.mapY = null;

    this.callbacks = [];
}

GaussMix.prototype.copyTo = function(newModel, dontUpdate)
{
    if (!newModel) {
        newModel = new GaussMix(this.w, this.h, null);
    }
    else {
        newModel.w = this.w;
        newModel.h = this.h;
    }

    newModel.models = [];
    for (var i=0; i<this.models.length; i++) {
        var m = this.models[i];
        newModel.models.push({
            t: m.t,
            param: m.param.slice(),
            axis: m.axis
        });
    }
    if (!dontUpdate) {
        newModel.updateModel();
    }
    return newModel;
}

GaussMix.prototype.addCallback = function(_callback) {
    var _id = Math.random();
    this.callbacks.push({
        callback: _callback,
        id: _id
    });
    return _id;
}

GaussMix.prototype.unregisterCallback = function(callbackID) {
    for (var i=0; i<this.callbacks.length; i++) {
        if (this.callbacks[i].id == callbackID) {
            this.callbacks.splice(i, 1);
            return true;
        }
    }
    return false;
}

GaussMix.prototype.fireCallbacks = function() {
    if (!UPDATE_CALLBACK) {
        return;
    }
    for (var i=0; i<this.callbacks.length; i++) {
        this.callbacks[i].callback(this);
    }
}

GaussMix.prototype.init = function()
{
    this.models = [];

    // add a few random gausses
    for (var i=0, count=1+Math.floor(.499 + Math.random()*3); i<count; i++ ) {
        this.add('x');
    }
    for (var i=0, count=1+Math.floor(.499 + Math.random()*3); i<count; i++ ) {
        this.add('y');
    }

    this.updateModel();
}

GaussMix.prototype.computeCDFs = function()
{
    var w = this.w;
    var h = this.h;

    var X=d3.range(0, w);
    var Y=d3.range(0, h);

    var cdfX, cdfY;

    for (var x=0; x<w; x++) {
        X[x]=0;
    }
    for (var y=0; y<h; y++) {
        Y[y]=0;
    }


    // compute PDFs
    for (var m=0; m < this.models.length; m++)
    {
        var model = this.models[m];
        var outs = model.outputs;

        var len = model.axis == 'x' ? w : h;
        var P = model.axis == 'x' ? X : Y;
        for (var i=0; i<len; i++)
        {
            P[i] += outs[i].y;
        }
    }

    // compute CDFs and normalize
    cdfX=d3.range(0, w);
    cdfY=d3.range(0, h);

    var cummX=0;
    for (var i=0, len=X.length; i<len; i++) {
        cummX += X[i];
        cdfX[i] = 0;
    }
    for (var i=0, cdf=0, len=X.length; i<len; i++) {
        X[i] /= cummX;
        cdf += X[i];
        cdfX[i] = cdf;
    }

    var cummY=0;
    for (var i=0, len=Y.length; i<len; i++) {
        cummY += Y[i];
    }
    for (var i=0, cdf=0, len=Y.length; i<len; i++) {
        Y[i] /= cummY;
        cdf += Y[i];
        cdfY[i] = cdf;

    }
    this.pdfX = X;
    this.pdfY = Y;
    this.cdfX = cdfX;
    this.cdfY = cdfY;

    /*
    // old way of computing CDFs; slightly more accurate but slower
    cdfX=d3.range(0, w);
    cdfY=d3.range(0, h);

    var cumm=0;
    for (var x=0; x<w; x++) {
        cumm+=X[x];
        cdfX[x]=cumm;
    }
    for (var x=0; x<w; x++) {
        cdfX[x] /= cumm;
    }

    var cumm=0;
    for (var y=0; y<h; y++) {
        cumm+=Y[y];
        cdfY[y]=cumm;
    }
    for (var y=0; y<h; y++) {
        cdfY[y] /= cumm;
    }
    this.cdfX = cdfX;
    this.cdfY = cdfY;
    */

    // compute a descrete p map: this allows us to map from discrete
    // uniform p distribution to the distribution characterized by the above CDFs
    // larger MAP_SIZE=less aliasing (at the cost of memory and initial compute time)
    mapX=d3.range(w*MAP_SIZE);
    mapY=d3.range(h*MAP_SIZE);

    for (var x=0, last=0, p=0, len=w*MAP_SIZE, step=1/(w*MAP_SIZE); x<len; x++, p+=step)
    {
        while (cdfX[last] <= p)
        {
            last++;
        }
        mapX[x]=last;
    }

    for (var y=0, last=0, p=0, len=h*MAP_SIZE, step=1/(h*MAP_SIZE); y<len; y++, p+=step)
    {
        while (cdfY[last] < p)
        {
            last++;
        }
        mapY[y]=last;
    }

    this.mapX = mapX;
    this.mapY = mapY;
}

GaussMix.prototype.sampleModel = function(_iterations, _field, rotate)
{
    var SPLAT_AREA=(SPLAT_SIZE*2+1)*(SPLAT_SIZE*2+1);
    var splat = [];
    for (var j=0;j<SPLAT_AREA; j++) {
        splat.push(0);
    }
    _iterations=_iterations*5;
    if (!this.mapX) {
        this.computeCDFs();
    }
    var mapX = this.mapX;
    var mapY = this.mapY;
    var pdfX = this.pdfX;
    var pdfY = this.pdfY;

    var w = this.w;
    var h = this.h;
    var w_1 = w-1;
    var h_1 = h-1;

    var w_2 = Math.floor(w/2);
    var h_2 = Math.floor(h/2);

    // reset scalar field with zeros
    _field.zero();

    var view = _field.view;
    var iterations = _iterations;

    /*
    rotation stuff
    var theta, cosTheta, sinTheta; rotate=ROTATE;
    if (rotate) {
        theta = (Math.random()*2-1) * Math.PI;
        cosTheta = Math.cos(theta);
        sinTheta = Math.sin(theta);
    }
    */

    for (var i=0; i<iterations; i++)
    {
        var x = Math.min(mapX.length-1, Math.floor(Math.random()*mapX.length));
        var y = Math.min(mapY.length-1, Math.floor(Math.random()*mapY.length));


        var R=mapY[y];
        var C=mapX[x];

        /*
        // rotation stuff
        if (rotate)
        {
            var tY = R-h_2, tX = C-w_2;
            var x_ = Math.floor(.5 + tX*cosTheta - tY*sinTheta + w_2);
            var y_ = Math.floor(.5 + tX*sinTheta + tY*cosTheta + h_2);

            // test if within range
            if (x_ >= 0 && x_ < w && y_ >=0 && y_ < h) {
                R = y_;
                C = x_;
            }
        }
        */

        // create a splat
        var I=0;


        var R0 = Math.max(0, R-SPLAT_SIZE), R1 = Math.min(h_1, R+SPLAT_SIZE);
        var C0 = Math.max(0, C-SPLAT_SIZE), C1 = Math.min(w_1, C+SPLAT_SIZE);
        var P=0;

        // compute total density at this splat
        for (var r=R0; r<=R1; r++)
        {
            for (var c=C0; c<=C1; c++, I++)
            {
                var p = pdfX[c]*pdfY[r];
                splat[I] = p;
                P += p;
            }
        }
        var iP = 1/P;
        I = 0;

        // distribute density throughout the splat according to the PDF
        for (var r=R0; r<=R1; r++)
        {
            for (var c=C0; c<=C1; c++, I++)
            {
                view[ r*w + c ] += splat[I] * iP;
            }
        }


        //view[ R*w + C ] += 1.0;
    }
    _field.normalize();
    _field.updated();
}

GaussMix.prototype.add = function(axis)
{
    var L = axis == 'x' ? this.w : this.h;

    this.models.push({
        t: gauss,
        param: [
            L * ( 0.5 + (Math.random()*2 - 1) * 0.5   ),    // center
            L * ( 0.1 + (Math.random()*2 - 1) * (.1/2)),    // std
            0.7  + (Math.random()*2 - 1)*0.3
        ],
        axis: axis
    });
    this.updateModel();
}

GaussMix.prototype.remove = function(axis)
{
    var m=null, mCount=0;
    for (i=0; i<this.models.length; i++) {
        if (this.models[i].axis==axis) {
            mCount++;
            m=i;
        }
    }
    if (mCount > 1) {
        this.models.splice(m, 1);
        this.updateModel();
    }
}

GaussMix.prototype.klDivergence = function()
{
    // too lazy to implement (also, probably unneeded for now)
    return 0;
}

// randomly perturbs the model a bit
GaussMix.prototype.randomPerturb = function()
{
    var CENTER_PERTURB = .1/2;
    var DENSITY_PERTURB = 4;	// of maxiumum weight

    var maxXDensity = this.modelMaxX;
    var maxYDensity = this.modelMaxY;

    for (var i=0; i<this.models.length; i++) {
        var m = this.models[i];
        var c = m.axis=='x' ? WIDTH : HEIGHT;
            c *= (Math.random()*2-1) * CENTER_PERTURB;
        var d = m.axis=='x' ? maxXDensity : maxYDensity;
            d *= (Math.random()*2-1) * DENSITY_PERTURB;
        m.param[0] += c;
        m.param[2] += d;

        // don't bother perturbing the SD for now
    }
    this.updateModel();
}

GaussMix.prototype.updateModel = function()
{
    var modelMaxX = 0;
    var modelMaxY = 0;
    var models = this.models;

    // compute probability density
    var modelOutputs = [];
    for (var m=0; m<models.length; m++)
    {
        var model = models[m];
        var points = [];
        if (model.axis == 'x') {
            points = d3.range(0, this.w);
        }
        else if (model.axis == 'y') {
            points = d3.range(0, this.h);
        }

        var maxVal = 0;
        for (var i=0; i<points.length; i++) {
            var p = points[i];
            var out = {
                x: p,
                y: model.t(p, model.param)
            }
            maxVal = Math.max(maxVal, out.y) ;
            points[i] = out;
        }

        model.outputs = points;
        modelOutputs.push(points);

        if (model.axis == 'x')
        {
            modelMaxX = Math.max(modelMaxX, maxVal);
        }
        else {
            modelMaxY = Math.max(modelMaxY, maxVal);
        }
    }

    this.modelMaxX = modelMaxX;
    this.modelMaxY = modelMaxY;

    // compute CDFs and maps
    this.computeCDFs();

    // plot to svg
    this.plotModelCurves();
}

GaussMix.prototype.plotModelCurves = function()
{
    if (!this.svg) {
        return;
    }

    // plot distribution
    var lineGeneratorX = (function(models) {
        return d3.line()
            .x(function(d) { return d.x; })
            .y(function(d) { return -P_HEIGHT * (d.y/models.modelMaxX); });
    })(this);

    var lineGeneratorY = (function(models) {
        return d3.line()
            .x(function(d) { return d.x; })
            .y(function(d) { return -P_HEIGHT * (d.y/models.modelMaxY); });
    })(this);

    var paths = this.svg.selectAll('path').data(this.models)

    paths.exit().remove();
    var enter = paths.enter().append('path');
    paths = paths.merge(enter);
    (function(models, paths) {
        paths
            .attr('d', function(d) {
                return d.axis=='x' ? lineGeneratorX(d.outputs) : lineGeneratorY(d.outputs)
            })
            .attr('class', 'modelPath')
            .attr('stroke', function(d, i) {
                return MODEL_COLORS[Math.min(i, MODEL_COLORS.length-1)];
            })
            .attr('transform', function(d)
            {
                if (d.axis == 'y') {
                    return 'translate(' + models.w + ',0) ,rotate(90)';
                }
                else {
                    return null;
                }
            })

            .on('mouseover', function() { d3.select(this).style('stroke', '#333333'); })
            .on('mouseout', function(d, j) {
                d3.select(this).style('stroke', MODEL_COLORS[Math.min(j, MODEL_COLORS.length-1)]);
            });


        paths.on('mousedown', function(d) {
            var mouseCoord = d3.mouse(models.svg.node());
            (function(model, oldDelta, oldScaler, mouseCoord) {
                d3.select(document).on('mousemove.moveDist', function() {

                    var dMove, dScaler, mouse = d3.mouse(models.svg.node());
                    if (model.axis=='x')
                    {
                        dMove = mouse[0] - mouseCoord[0];
                        dScaler = -(mouse[1] - mouseCoord[1]);
                    }
                    else {
                        dMove = mouse[1] - mouseCoord[1];
                        dScaler = mouse[0] - mouseCoord[0];
                    }

                    var newDelta = oldDelta + dMove;
                    newDelta = Math.max(1, newDelta);
                    newDelta = Math.min(model.axis=='x' ? models.w-1 : models.h-1, newDelta);

                    newScaler = oldScaler + dScaler/P_HEIGHT;
                    model.param[1] = newDelta;
                    model.param[2] = Math.max(0.05, newScaler);

                    models.updateModel();

                });

                d3.select(document).on('mouseup.moveDist', function()
                {
                    models.fireCallbacks();
                    d3.select(document).on('mousemove.moveDist', null)
                    d3.select(document).on('mouseup.moveDist', null)

                })
            })(d, d.param[1], d.param[2], mouseCoord);
        });
    })(this, paths);

    // plot model center
    var lines = this.svg.selectAll('line').data(this.models);
    (function(lines, models) {
        lines.exit().remove();
        enter = lines.enter().append('line');
        lines = lines.merge(enter);
        lines
            .attr('x1', function(d) {
                return d.axis=='x' ? d.param[0] : -1 * (-P_HEIGHT * d.t(d.param[0], d.param)/models.modelMaxY);
            })
            .attr('x2', function(d) { return d.axis=='x' ? d.param[0] : 0; })
            .attr('y1', function(d) { return d.axis=='x' ? (-P_HEIGHT * d.t(d.param[0], d.param)/models.modelMaxX) : d.param[0]})
            .attr('y2', function(d) { return d.axis=='x' ? 0 : d.param[0] })
            .attr('transform', function(d)
            {
                if (d.axis == 'y') {
                    return 'translate(' + models.w + ',0)';
                }
                else {
                    return null;
                }
            })
            .attr('stroke', function(d, i) {
                return MODEL_COLORS[Math.min(i, MODEL_COLORS.length-1)];
            })

            .style('stroke-width', '3px')
            .on('mouseover', function() { d3.select(this).style('stroke', '#333333'); })
            .on('mouseout', function(d, j)
             {
                d3.select(this).style('stroke', MODEL_COLORS[Math.min(j, MODEL_COLORS.length-1)]);
            })
            .on('mousedown', function(d) {
                var mouseCoord = d3.mouse(models.svg.node());
                (function(model, oldMue, oldScaler, mouseCoord) {
                    d3.select(document).on('mousemove.moveLine', function() {

                        var dMove=0, dScaler=0, mouse = d3.mouse(models.svg.node());
                        if (model.axis=='x')
                        {
                            dMove = mouse[0] - mouseCoord[0];
                            //dScaler = -(mouse[1] - mouseCoord[1]);
                        }
                        else {
                            dMove = mouse[1] - mouseCoord[1];
                            //dScaler = mouse[0] - mouseCoord[0];
                        }

                        var newMue = oldMue + dMove;
                        newMue = Math.max(0, newMue);
                        newMue = Math.min(model.axis=='x' ? models.w-1 : models.h-1, newMue);

                        newScaler = oldScaler + dScaler/P_HEIGHT;
                        model.param[0] = newMue;
                        model.param[2] = Math.max(0.05, newScaler);

                        models.updateModel();

                    });

                    d3.select(document).on('mouseup.moveLine', function() {

                        // notify there's been a model update
                        models.fireCallbacks();
                        d3.select(document).on('mousemove.moveLine', null)
                        d3.select(document).on('mouseup.moveLine', null)

                    })
                })(d, d.param[0], d.param[2], mouseCoord)

            })
    })(lines, this);


}
