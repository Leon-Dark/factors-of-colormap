// somewhere between 2 and 5 seems (visually) like a reasonable tradeoff
var BI_MAP_SIZE=2;
var DOUBLE_PRECISION=false;

function GaussMixBivariate(w, h, svg)
{
    GaussMix.call(this, w, h, svg);
    if (this.svg) {
        this.svg = this.svg.append('g');
    }

    // double precision for pdf
    this.pdf = new ScalarField(w, h, DOUBLE_PRECISION);
    this.cdf = new ScalarField(w, h);

    var cdfMapSize = Float32Array.BYTES_PER_ELEMENT * w * h * (BI_MAP_SIZE * BI_MAP_SIZE);
    this.cdfMap = new Float32Array(new ArrayBuffer(cdfMapSize));
}

function biGauss(mX, mY, sX, sY, rho, scaler)
{
    this.mX = mX;
    this.mY = mY;
    this.sX = sX;
    this.sY = sY;
    this.updateRho(rho);
    this.scaler = (scaler ? scaler : 1);
}

biGauss.prototype.getSigmaX = function() { return this.sX; }
biGauss.prototype.getSigmaY = function() { return this.sY; }
biGauss.prototype.updateSigmaX = function(_sX) { this.sX = _sX; }
biGauss.prototype.updateSigmaY = function(_sY) { this.sY = _sY; }


biGauss.prototype.copy = function()
{
    return new biGauss(this.mX, this.mY, this.sX, this.sY, this.rho, this.scaler);
}

biGauss.prototype.updateRho = function(_rho)
{
    // rescale row so that it's between -.7 and .7
    this.rho = _rho;
    this.rho2 = this.rho * this.rho;
    this.rhoExpConst = -1/(2 * (1-this.rho2));
    this.rhoSqrConst =  1/(2 * Math.PI * Math.sqrt(1-this.rho2));
}

biGauss.prototype.perturb = function(rhoP)
{
    var newRho = this.rho + rhoP;
    if (newRho > 1 || newRho < -1) {
        rhoP*=-1;
        newRho = this.rho + rhoP;
    }
    this.updateRho(newRho);
}

biGauss.prototype.eval = function(x, y)
{
    var stX = (x-this.mX)/this.sX;
    var stY = (y-this.mY)/this.sY;
    var stXY = stX * stY;

    var e = this.rhoExpConst * (stX*stX -2 * this.rho * stXY + stY*stY);
    //var a = this.rhoSqrConst * (1/(this.sX * this.sY))

    return this.scaler * Math.exp( e ); // * a;
}

GaussMixBivariate.prototype = Object.create(GaussMix.prototype);

GaussMixBivariate.prototype.getPDF = function() {
    return this.pdf;
}

GaussMixBivariate.prototype.dispose = function()
{
    this.pdf = null;
    this.cdf = null;
    this.cdfMap = null;
}

GaussMixBivariate.prototype.init = function()
{
    var MIN_GAUSS = 3;
    var MAX_GAUSS = 6;

    var count = Math.floor(.5 + Math.random() * (MAX_GAUSS-MIN_GAUSS)) + MIN_GAUSS;
    this.models = [];

    // add a few random gausses
    var dontUpdate = true;
    for (var i=0; i<count; i++ ) {
        this.add(dontUpdate);
    }
    this.updateModel();
}


GaussMixBivariate.prototype.copyTo = function(newModel, dontUpdate)
{
    if (!newModel) {
        newModel = new GaussMixBivariate(this.w, this.h, null);
    }
    else {
        newModel.w = this.w;
        newModel.h = this.h;
    }

    newModel.models = [];
    for (var i=0; i<this.models.length; i++)
    {
        var m = this.models[i];
        newModel.models.push( m.copy() );
    }
    if (!dontUpdate) {
        newModel.updateModel();
    }
    return newModel;
}

var MIN_SIGMA = 10;

GaussMixBivariate.prototype.add = function(dontUpdate)
{
    // center
    var mX = this.w/2 + (Math.random()*2-1) * (this.w*0.35);
    var mY = this.h/2 + (Math.random()*2-1) * (this.h*0.35);

    // standard deviation
    var sigmaX = (Math.random()*.5 + .2) * this.w * .32;
    var sigmaY = (Math.random()*.5 + .2) * this.h * .32;

    // correlation (limit to -0.7 to 0.7)
    var rho = (Math.random()*2-1) *.7;

    // scaler
    var scaler = 1.0; //0.7  + (Math.random()*2 - 1)*0.3;

    this.models.push(new biGauss(mX, mY, sigmaX, sigmaY, rho, scaler));
    if (!dontUpdate) {
        this.updateModel();
    }

}

GaussMixBivariate.prototype.remove = function() {
    if (this.models.length < 1) {
        return;
    }
    else {
        this.models.splice(this.models.length-1, 1);
        this.updateModel();
    }
}

var MIN_M_PERTURB = 0.01;
var MAX_M_PERTURB = 0.20;

var MIN_R_PERTURB = 0.0;
var MAX_R_PERTURB = 0.3;

var M_PERTURB = .015;
var S_PERTURB = 0;
var R_PERTURB = 0.07;

GaussMixBivariate.prototype.randomPerturb = function()
{
    for (var i=0; i<this.models.length; i++)
    {

        var l = 0;
        var r = [0, 0];
        do {
            r = [Math.random()*2-1, Math.random()*2-1];
            l = r[0]*r[0]+r[1]*r[1];
        } while (l==0);

        l = (M_PERTURB * Math.min(this.w, this.h)) / Math.sqrt(l);

        var m = this.models[i];
        m.mX += r[0] * l;
        m.mY += r[1] * l;

        // peturb model angle
        var rhoP = (Math.random() > .5 ? 1 : -1) * (Math.random() * R_PERTURB);
        m.perturb(rhoP);
    }
    this.updateModel();
}

GaussMixBivariate.prototype.deldensity = function(nonZeroOK)
{
    var RESOLUTION=30;
    var HIST_ROW = RESOLUTION*2+1;

    var w = this.w;
    var h = this.h;
    var histSize = HIST_ROW * HIST_ROW;
    var histogram = DOUBLE_PRECISION ?
        new Float64Array(histSize) :
        new Float32Array(histSize);
    /*
    var histogram = w*h < 65000 ?
        new Uint16Array(histSize) :
        new Uint32Array(histSize);
    */

    var histMax = 0;

    // get the pdf and its range
    var pdf = this.pdf.view;

    var minDensity = this.minDensity;
    var maxDensity = this.maxDensity;
    var densityRange_1 = RESOLUTION / (maxDensity-minDensity);

    var totalDensity=0;
    var R0=1, R1=h-1, C0=1, C1=w-1;

    for (var r=R0, R=w; r<R1; r++, R+=w)
    {
        for (var c=C0; c<C1; c++)
        {
            var RC = R+c;
            var P = pdf[RC];

            var fx =  (P-pdf[RC-1]) * densityRange_1;
            var fy =  (P-pdf[RC-w]) * densityRange_1;

            //console.log("num: " + fx + ',' + fy);
            var fj = Math.floor(.49999999 + Math.abs(fx));
            var fi = Math.floor(.49999999 + Math.abs(fy));

            if (fx<0) fj = RESOLUTION-fj; else fj += RESOLUTION;
            if (fy<0) fi = RESOLUTION-fi; else fi += RESOLUTION;


            var hI = fi*HIST_ROW + fj;
            var hV = histogram[ hI ] + 1;
            if (hV > histMax) {
                histMax = hV;
            }
            histogram[ hI ] = hV;
        }
    }

    // scan histogram again, and ensuring no non-zero elements within
    var cummDeldensity = (R1-R0) * (C1-C0);
    if (!nonZeroOK) {
        for (var i=0; i<histSize; i++)
        {
            if (histogram[i] == 0.0) {
                histogram[i] = 1e-40;
                cummDeldensity += 1e-40;
            }
        }
    }

    this.deldensityResult = {
        deldensity: histogram,
        maxDeldensity: histMax,
        cummDeldensity: cummDeldensity,
        histW: HIST_ROW,
        histH: HIST_ROW
    };

    return this.deldensityResult;
}

// for debugging
GaussMixBivariate.prototype.plotDeldensity = function()
{
    var results = this.deldensityResult;
    if (!results) {
        results = this.deldensity();
    }
    var histogram = results.deldensity;

    var w=results.histW, h=results.histH;
    var scalar = new ScalarField(w, h);
    var view = scalar.view;
    for (var i=0, len=w*h; i<len; i++)
    {
        var t = histogram[i]
        view[i] = t;
    }
    scalar.normalize();
    scalar.setColorMap(getColorPreset('spectral'));
    var canvas = scalar.generatePicture();
    d3.selectAll('#plotDeldensity').remove();
    d3.select(canvas).attr('id', 'plotDeldensity');
    d3.select('body').node().appendChild(canvas);
}

var RAD_2_DEGREES = 180 / Math.PI;

GaussMixBivariate.prototype.plotModelCurves = function()
{
    if (!this.svg) {
        return;
    }

    var visibleModels = [];
    for (var i=0; i<this.models.length; i++) {
        var m = this.models[i];
        if (!m.invisible) {
            visibleModels.push(m);
        }
    }
    var ellipses = this.svg.selectAll('ellipse').data(visibleModels)
    ellipses.exit().remove();

    var enter = ellipses.enter().append('ellipse')
        .attr('class', 'modelEllipse');
    ellipses = ellipses.merge(enter);
    ellipses
        //.attr('cx', function(d) { return d.mX; })
        //.attr('cy', function(d) { return d.mY; })
        .attr('transform', function(d)
        {
            var rho = d.rho;
            if (rho == undefined || rho == null) {
                rho = d.getAngle() //+ Math.PI/2;
            }
            else {
                rho = rho * .25 * Math.PI;
            }

            var angle = -1 * (rho) * RAD_2_DEGREES
            var rotation = 'rotate(' + angle + ')';
            var translation = 'translate(' + d.mX + ',' + d.mY + ')';
            return translation + ' ' + rotation;
        })
        .attr('rx', function(d) { return d.getSigmaX(); })
        .attr('ry', function(d) { return d.getSigmaY(); })
        .style('stroke-width', '3px')
        .attr('stroke', function(d, i) {
            return MODEL_COLORS[Math.min(i, MODEL_COLORS.length-1)];
        })
        .attr('fill', 'none');

    var lines = this.svg.selectAll('line').data(visibleModels)
    lines.exit().remove();
    enter = lines.enter().append('line');
    lines = lines.merge(enter);
    lines
        .attr('stroke', function(d, i) {
            return MODEL_COLORS[Math.min(i, MODEL_COLORS.length-1)];
        })
        .style('stroke-width', '3px')
        /*
        .attr('x1', function(d)
        {
            var rho = d.rho;
            if (!rho) rho = 0.0;
            return d.mX+3*Math.cos( Math.PI*.25*rho );
        })
        .attr('y1', function(d)
        {
            var rho = d.rho;
            if (!rho) rho = 0.0;
            return d.mY-3*Math.sin( Math.PI*.25*rho );
        })
        */
        .each(function(d)
        {
            var rho = d.rho;
            if (rho == undefined || rho == null) {
                rho = d.getAngle() //+ Math.PI/2;
            }
            else {
                rho = rho * .25 * Math.PI;
            }
            // slop based on rho
            var len = d.getSigmaX();

            var x1 = d.mX+3*Math.cos( rho );
            var y1 = d.mY-3*Math.sin( rho );

            var x2 = d.mX + len * Math.cos( rho );
            var y2 = d.mY - len * Math.sin( rho );

            d3.select(this)
                .attr('x1', x1).attr('y1', y1)
                .attr('x2', x2).attr('y2', y2)
        });

    // plots centers
    var centers = this.svg.selectAll('circle.center').data(visibleModels)
    centers.exit().remove();
    enter = centers.enter().append('circle')
        .attr('class', 'center');
    centers = centers.merge(enter);
    centers
        .attr('cx', function(d) { return d.mX; })
        .attr('cy', function(d) { return d.mY; })
        .attr('fill', function(d, i) {
            return MODEL_COLORS[Math.min(i, MODEL_COLORS.length-1)];
        })
        .attr('r', 3);

    // event handlers
    (function(me, centers, ellipses) {
        centers.on('mousedown', function(biG)
        {
            me.mouseCoord = d3.mouse(me.svg.node());
            me.oldMX = biG.mX;
            me.oldMY = biG.mY;
            d3.select(document)
                .on('mousemove.moveCenter', function()
                {
                    var mouse = d3.mouse(me.svg.node());
                    var dMouse = [
                        mouse[0]-me.mouseCoord[0],
                        mouse[1]-me.mouseCoord[1]
                    ];
                    biG.mX = me.oldMX + dMouse[0];
                    biG.mY = me.oldMY + dMouse[1];
                    me.plotModelCurves();
                })
                .on('mouseup.moveCenter', function() {
                    me.updateModel();
                    me.fireCallbacks();
                    d3.select(document)
                        .on('mousemove.moveCenter', null)
                        .on('mouseup.moveCenter', null);
                    me.putOnTop();
                });
        });

        ellipses.on('mousedown', function(biG)
        {
            me.mouseCoord = d3.mouse(me.svg.node());
            me.oldSX = biG.getSigmaX();
            me.oldSY = biG.getSigmaY();
            d3.select(document)
                .on('mousemove.moveCenter', function()
                {
                    var mouse = d3.mouse(me.svg.node());
                    var dMouse = [
                        mouse[0]-me.mouseCoord[0],
                        mouse[1]-me.mouseCoord[1]
                    ];

                    var sX = Math.max(MIN_SIGMA, me.oldSX + dMouse[0]);
                    var sY = Math.max(MIN_SIGMA, me.oldSY + dMouse[1]);
                    biG.updateSigmaX(sX);
                    biG.updateSigmaY(sY);

                    me.plotModelCurves();
                })
                .on('mouseup.moveCenter', function() {
                    me.updateModel();
                    me.fireCallbacks();
                    d3.select(document)
                        .on('mousemove.moveCenter', null)
                        .on('mouseup.moveCenter', null);
                    me.putOnTop();
                });
        });

        lines.on('mousedown', function(BiG)
        {
            me.mouseCoord = d3.mouse(me.svg.node());
            d3.select(document)
                .on('mousemove.moveCenter', function()
                {
                    // compute new rho based on slope created by line
                    // passing through model center and new mouse coordinates
                    var mouse = d3.mouse(me.svg.node());
                    var slope = (mouse[1]-BiG.mY)/(mouse[0]-BiG.mX);


                    if (BiG.updateRho) {
                        if (slope > 1) {
                            slope=1;
                        }
                        else if (slope < -1) {
                            slope=-1;
                        }
                        BiG.updateRho(slope*-1);
                    }
                    else {
                        var a = -Math.atan2(mouse[1] - BiG.mY, mouse[0]-BiG.mX)
                        BiG.updateAngle(a /*- Math.PI/2*/);
                    }
                    me.plotModelCurves();
                })
                .on('mouseup.moveCenter', function() {
                    me.updateModel();
                    me.fireCallbacks();
                    d3.select(document)
                        .on('mousemove.moveCenter', null)
                        .on('mouseup.moveCenter', null);
                    me.putOnTop();
                });
        });

    })(this, centers, ellipses);
}

GaussMixBivariate.prototype.updateModel = function()
{
    // compute CDFs and maps
    this.computeCDFs();

    this.plotModelCurves();
}

GaussMixBivariate.prototype.computeCDFs = function()
{
    var w = this.w;
    var h = this.h;
    var models = this.models;
    var mCount = models.length;

    // compute PDF / CDF
    var cummDensity = 0, maxDensity = 0, minDensity=Number.MAX_VALUE;

    // clear out
    this.pdf.zero();
    this.cdf.zero();

    var pdf = this.pdf.view;
    var cdf = this.cdf.view;

    // loop through all rows / columns
    for (var r=0, I=0; r<h; r++)
    {
        for (var c=0; c<w; c++, I++)
        {
            // evaluate density of all models
            var P=0;
            for (var m=0; m<mCount; m++)
            {
                var model = models[m];
                P += model.eval(c, r);
            }
            // To force a uniform distribution (for testing):
            //P = Math.random();//1/(w*h);

            if (P > maxDensity) {
                maxDensity = P;
            }
            if (P < minDensity) {
                minDensity = P;
            }


            cummDensity += P;
            pdf[I] = P;
            cdf[I] = cummDensity;
        }
    }

    if (minDensity < 0)
    {
        var k = -minDensity;
        minDensity = 0;
        maxDensity += k;
        cummDensity = 0;

        // loop again to shift densities to ensure all positive probabilities
        for (var r=0, I=0; r<h; r++)
        {
            for (var c=0; c<w; c++, I++)
            {
                pdf[I] += k;
                cummDensity += pdf[I];
                cdf[I] = cummDensity;
            }
        }

    }

    //console.log('normalize PDF');
    //this.pdf.normalize();

    this.maxDensity = maxDensity;
    this.minDensity = minDensity;
    this.cummDensity = cummDensity;

    // construct map
    this.pdf.updated();
    this.updateCDFMap = true;
}

// construct map
GPU_CDF_MAP = false;
GaussMixBivariate.prototype.computeCDFMap = function()
{
    var cdf = this.cdf.view;
    var cummDensity = this.cummDensity;
    var cdfMap = this.cdfMap;
    var cdfMapLen = this.cdfMap.length;

    var gpuMap = null;
    if (GPU_CDF_MAP) {
        gpuMap = new ScalarField(this.w, this.h);
        this.gpuMap = gpuMap;
        gpuMap = gpuMap.view;
    }

    for (var i=0, last=0, p=0, step=cummDensity/cdfMapLen; i<cdfMapLen; i++, p+=step)
    {
        while (cdf[last] < p)
        {
            last++;
        }
        cdfMap[i] = last;
        if (GPU_CDF_MAP) {
            gpuMap[last] += step;
        }
    }

    this.updateCDFMap = false;
}


GaussMixBivariate.prototype.normalizedDivergence = function(other)
{
    var kld = this.klDivergence(other);
    return kld;
    //return kld / (.5 * (this.entropy + other.entropy));
}

GaussMixBivariate.prototype.pdfDistance = function(other)
{
    var P = this.pdf.view;
    var Q = other.pdf.view;

    var maxP_1 = 1.0/this.cummDensity;
    var maxQ_1 = 1.0/other.cummDensity;

    var distance = 0;

    // amplitude distance
    // ==================
    for (var i=0, len=P.length; i<len; i++)
    {
        var p = P[i];
        p *= maxP_1;

        var q = Q[i];
        q *= maxQ_1;

        distance += Math.abs(p-q);
    }

    // distance is between 0..2, so multiply between 0.5
    var distDistance = logDTransform(distance*.5)

    // frequency-based distance
    // ==========================
    var delP = this.deldensity(true /* don't bother zeroing out empty bins */);
    var delQ = other.deldensity(true);

    var fP = delP.deldensity;
    var fQ = delQ.deldensity;

    var maxfP = delP.cummDeldensity;
    var maxfQ = delQ.cummDeldensity;

    distance = 0;
    for (var i=0, len=fP.length; i<len; i++) {
        distance += Math.abs(fP[i]-fQ[i]);
    }
    var freqDistance = logDTransform(distance/maxfP) *.5;

    // return weighted average of the two distances
    var ALPHA = 0.5;
    return ALPHA * distDistance + (1-ALPHA) * freqDistance;
}

function logDTransform(x)
{
    var k =0.7;
    var expK = Math.pow(10, -k);
    return (Math.log10(x+expK) + k) / (Math.log10(1+expK)+k);
}

function expDTransform(x)
{
    var b = 3;      // base
    return (Math.pow(b, x-1) - 1/b) / (1-1/b);
}

GaussMixBivariate.prototype.klDivergence = function(other)
{
    var DELENTROPY = false;
    var delMe = null, delOt = null;
    var LOG_C_1 = 1.0 / (Math.log10(1.01) + 2.0);

    if (DELENTROPY)
    {
        delMe = this.deldensity();
        delOt = other.deldensity();
    }

    // implements a KL divergence of other from this KL(me||other)
    var P = DELENTROPY ? delMe.deldensity : this.pdf.view;
    var Q = DELENTROPY ? delOt.deldensity : other.pdf.view;

    if (P.length != Q.length) {
        console.error("Can't compute divergence: probability distributions of different sizes");
        return null;
    }

    var maxP = DELENTROPY ? delMe.cummDeldensity : this.cummDensity;
    var maxQ = DELENTROPY ? delOt.cummDeldensity : other.cummDensity;

    var maxP_1 = 1.0/maxP;
    var maxQ_1 = 1.0/maxQ;

    var divergence = 0, divergence2 = 0;
    var entropyMe = 0, entropyOther = 0;
    var distDistance = 0;

    //console.log('max densities: ' + maxP + ', ' + maxQ);
    for (var i=0, len=P.length; i<len; i++)
    {
        var p = P[i];
        p *= maxP_1;

        var q = Q[i];
        q *= maxQ_1;

        var logP = Math.log2(p);
        var logQ = Math.log2(q)

        entropyMe    += logP * p;
        entropyOther += logQ * q;

        // divergence = p * log(p/q) = p * (log(p) - log(q))
        divergence  += p * (logP - logQ);
        divergence2 += q * (logQ - logP);

        /*
        var d = Math.abs(p-q);
        var d1 = (Math.log10(d+0.01) + 2) * LOG_C_1;
        */

        distDistance += Math.abs(p-q);
        //console.log("d: " + d + ", d1: " + d1 + ', ' + distDistance);
    }

    this.entropy = -entropyMe;
    other.entropy = -entropyOther;

    this.divergence = divergence;
    other.divergence = divergence2;

    return logDTransform(distDistance / 2);

    /*
    if (divergence > divergence2) {
        return divergence / this.entropy;
    } else {
        return divergence2 / other.entropy;
    }
    //return Math.max(divergence, divergence2);
    */
}

var BI_SPLAT = [];
var splatGauss = new biGauss(0, 0, SPLAT_SIZE/4, SPLAT_SIZE/4, 0);
var cummSplat=0.0;
for (var I=0,r=-SPLAT_SIZE; r<=SPLAT_SIZE; r++)
{
    for (var c=-SPLAT_SIZE; c<=SPLAT_SIZE; c++, I++)
    {
        var s = splatGauss.eval(c, r);
        BI_SPLAT.push(s);
        cummSplat += s;
    }
}

for (var i=0; i<BI_SPLAT.length; i++) {
    BI_SPLAT[i] /= cummSplat;
}

GaussMixBivariate.prototype.putOnTop = function()
{
    function putNodeOnTop(node)
    {
        var n = jQuery(node);
        n.parent().append(n.detach());
    }

    if (!this.svg) {
        return;
    }
    else
    {
        putNodeOnTop(this.svg.node());
    }
}

GaussMixBivariate.prototype.sampleModel = function(iterations, _field, upperPercentile)
{
    if (this.updateCDFMap) {
        this.computeCDFMap();
    }

    var SPLAT_AREA=(SPLAT_SIZE*2+1)*(SPLAT_SIZE*2+1);
    var splat = [];
    for (var j=0;j<SPLAT_AREA; j++) {
        splat.push(0);
    }

    var w = this.w;
    var h = this.h;
    var w_1 = w-1;
    var h_1 = h-1;

    var cdf = this.cdf.view;
    var cdfMap = this.cdfMap;
    var cdfLen = cdfMap.length;

    // reset scalar field with zeros
    _field.zero();
    var view = _field.view;

    // iterate
    for (var i=0; i<iterations; i++)
    {
        // find center of splat
        var I = cdfMap[ Math.floor(Math.random() * cdfLen) ];

        // convert to row, column coordinate
        var C = I % w;
        var R = Math.floor(I/w);

        // SPLATTING: find splat boundary
        // ===============================
        /*
        var R0 = Math.max(0, R-SPLAT_SIZE), R1 = Math.min(h_1, R+SPLAT_SIZE);
        var C0 = Math.max(0, C-SPLAT_SIZE), C1 = Math.min(w_1, C+SPLAT_SIZE);
        var cummP=0;

        // compute total density at this splat
        for (var k=0, r=R0; r<=R1; r++)
        {
            for (var c=C0; c<=C1; c++, k++)
            {
                var p = cdf[r*w + c];
                splat[k] = p;
                cummP += p;
            }
        }
        cummP = 1/cummP;

        // distribute density throughout the splat according to the PDF
        for (var k=0, r=R0; r<=R1; r++)
        {
            for (var c=C0; c<=C1; c++, k++)
            {
                view[ r*w + c ] += splat[k] * cummP;
            }
        }
        */

        view[ R*w + C ] += 1.0;
    }

    if (upperPercentile) {
        _field.normalizeToPercentile(upperPercentile);
    }
    else
    {
        _field.normalize();
    }
}
