var STIM_W = 200;
var STIM_H = 200;

var KS_TEST_THRESHOLD = 0.10;
var KS_TRIALS = 10;
var KS_TRIAL_EXTENSION = 4;
var KS_ENABLE = false;



var visLeft, visRight;

function initExperimentGL(exp)
{
	var shaderList = [
		{name: 'vis',		path: 'design/src/shaders/vis.frag'},
		{name: 'vertex',	path: 'design/src/shaders/vertex.vert' }
	];
	
	function createVisLeft(callback) 
	{
		visLeft = new ColorAnalysis(
			exp.stimulus.getFirst(),
			d3.select("#stimLeft").node(),
			function() {callback(null);}, shaderList
		);
	}

	function createVisRight(callback) {
		visRight = new ColorAnalysis(
			exp.stimulus.getSecond(),
			d3.select("#stimRight").node(),
			function() {callback(null);}, shaderList
		);
	}

	var q = d3.queue()
		.defer( createVisLeft )
		.defer( createVisRight )
		.defer( loadExternalColorPresets )
		.awaitAll(function(error, results)
		{
			if (error) { 
				throw error;
			}
			else
			{
				// create vis pipelines
				exp.visLeft = visLeft;
				exp.visRight = visRight;

				exp.visLeft.createVisPipeline();
				exp.visRight.createVisPipeline();

				// initialize colormaps
				var colormap = null;
				if (COLORMAPS && COLORMAPS.length>0)
				{
					exp.cycleColormaps = true;
					exp.currentColormapIndex = 0;
					colormap = COLORMAPS[0];

				}
				else
				{
					exp.cycleColormaps = false;
					colormap = exp.currentColormap;
					if (!colormap || colormap.length == 0) {
						colormap = 'greyscale';
					}
				}
				exp.changeColormap(colormap);

				// when ready, visualize the stimulus
				exp.nextBlock();
				exp.next();
			}
		});
}

function shuffleArray(a) {
	var j, x, i;
	for (i = a.length - 1; i > 0; i--) {
		j = Math.floor(Math.random() * (i + 1));
		x = a[i];
		a[i] = a[j];
		a[j] = x;
	}
	return a;
}
function reorderArray(a, index) 
{
	if (typeof index === 'string') 
	{
		var newIndex = [];
		for (var j=0; j<index.length; j++) 
		{
			var x = index.charAt(j);
			if (x == 'a') x=0;
			if (x == 'b') x=1;
			if (x == 'c') x=2;
			newIndex.push(+x);
		}
		index = newIndex;
	}
	var newA = [];
	for (var i=0; i<index.length; i++) {
		newA.push(a[index[i]]);
	}
	return newA;
}

function Experiment(practice, _colormap)
{
	// randomize order of magnitudes
	/*
	if (!practice) {
		shuffleArray(MAGNITUDES);
	}
	*/
	
	// whether this is a practice trial
	this.practice = practice;

	// colormap
	if (COLORMAPS && COLORMAPS.length > 0)
	{	
		this.currentColormap = null;
		this.currentColormapIndex = -1;
	}
	else
	{
		this.currentColormap = _colormap;
		this.currentColormapIndex = null;
	}

	// magnitudes
	this.currentMagnitude = null;
	this.currentMagnitudeIndex = -1;

	// experimental data
	this.experimentalData = [];

	// stimulius object
	this.stimulus = new TAFC(STIM_W, STIM_H);
	this.stimulus.shuffleImagePosition();

	// keep track of results
	this.results = [];
	this.engagements = [];
	this.engagementCorrectCount = 0;
	this.correctCount = 0;
	this.totalCount = 0;

	// show loading image
	d3.select("#loadingImage").style("visibility", 'visible')

	// hide confirm button
	d3.select("#confirmButton").node().disabled = true;

	// initialize GL elements
	initExperimentGL(this);
}

Experiment.prototype.changeColormap = function(colormap) 
{
	this.colormapLeft = getColorPreset(colormap, null, null, true);
	this.colormapRight = getColorPreset(colormap, null, null, true);
				
	this.stimulus.getFirst().setColorMap(this.colormapLeft);
	this.stimulus.getSecond().setColorMap(this.colormapRight);

	// render color map
	var scaleCanvas = d3.select("#colorScaleCanvas");
	this.colormapLeft.drawColorScale(
		+scaleCanvas.attr('width'),
		+scaleCanvas.attr('height'), +scaleCanvas.attr('height'),
		'vertical',
		scaleCanvas.node()
	);
	this.currentColormap = colormap;
}

Experiment.prototype.getCurrentBlock = function() {
	var colormapBlocks = this.cycleColormaps ? this.currentColormapIndex*MAGNITUDES.length : 0
	return this.currentMagnitudeIndex + colormapBlocks;
}
Experiment.prototype.getTotalBlocks = function() {
	var colormapCount = this.cycleColormaps ? COLORMAPS.length : 1;
	return MAGNITUDES.length * colormapCount;
}

Experiment.prototype.getCurrentTrial = function() {
	return this.currentTrial;
}

Experiment.prototype.sendData = function(TRIALS, callback) 
{
	var colormapCount = this.cycleColormaps ? COLORMAPS.length : 1;

	var data2send = JSON.stringify({ 
		experimentalData: this.experimentalData,
		engagementsCorrect: this.engagementCorrectCount,
		engagementsTotal: ENGAGEMENT_CHECKS * MAGNITUDES.length * colormapCount,
		engagementAccuracy: ENGAGEMENT_CHECKS > 0 ? (this.engagementCorrectCount / (colormapCount * ENGAGEMENT_CHECKS * MAGNITUDES.length)) : 0.0,

		stimulusCorrect: this.correctCount,
		stimulusTotal: TRIAL_COUNT * MAGNITUDES.length * colormapCount,
		stimulusAccuracy: this.correctCount / (TRIAL_COUNT * MAGNITUDES.length * colormapCount)
	});

	console.log("data2send size: " + data2send.length);

	(function(experiment, trial, _data2send, _callback) {
		$.ajax({
			type: "POST",
			url: "php/experimental_data.php",
		
			data: _data2send,
			dataType: "json",
			contentType: "application/json; charset=utf-8",
			
			success: function(data) 
			{ 
				console.log("sendData SUCCESS");
				_callback(true);				
			},

			error: function(errMsg) 
			{
				console.log("sendData failed: " + errMsg);
				console.log("trials left: " + (trial));
				if (trial > 0) {
					experiment.sendData(trial-1, _callback);
				}
				else
				{
					_callback(false);
				}
			}
		});
		console.log("send complete");
	})(this, TRIALS != undefined ? TRIALS : 3, data2send, callback);
}

Experiment.prototype.nextBlock = function()
{
	// how far into the experiments should we place engagement tests?
	var ENGAGEMENT_OFFSET = 3;

	// compute position of engagements
	this.engagements = [];
	for (var i=0; i<ENGAGEMENT_CHECKS; i++) 
	{
		var index = Math.floor(Math.random() * (TRIAL_COUNT - ENGAGEMENT_OFFSET*2) + ENGAGEMENT_OFFSET + .5);
		if (index < ENGAGEMENT_OFFSET) 
		{
			index = ENGAGEMENT_OFFSET;
		}
		else if (index > TRIAL_COUNT-ENGAGEMENT_OFFSET-1) {
			index = TRIAL_COUNT-ENGAGEMENT_OFFSET-2;
		}
		index = Math.max(0, index);
		index = Math.min(TRIAL_COUNT-1, index);
		this.engagements.push(index);
	}
	this.engagements.sort(function(a,b) { return a-b; });

	this.currentDiff = START_DIFF;
	this.currentTrial = 0;
	this.currentMagnitudeIndex++;
	if (this.currentMagnitudeIndex >= MAGNITUDES.length) 
	{
		// cycle colormaps?
		if (this.cycleColormaps)
		{
			this.currentColormapIndex++;
			if (this.currentColormapIndex >= COLORMAPS.length)
			{
				console.log("EXPERIMENT complete!")
				return true;
			}
			else
			{
				// change colormap
				this.changeColormap(COLORMAPS[this.currentColormapIndex]);
				
				// reset magnitude
				this.currentMagnitudeIndex = 0;
				this.currentMagnitude = MAGNITUDES[0];
				return false;
			}
		}
		else {
			// only one colormap, and we're finished with all magnitude
			console.log("EXPERIMENT complete!")
			return true;
		}
	}
	else
	{
		this.currentMagnitude = MAGNITUDES[this.currentMagnitudeIndex];
		return false;
	}
}

Experiment.prototype.randomStimulusThreaded = function(_magnitude, _diff) 
{
	(function(experiment, timeStart, magnitude, diff) 
	{
		// exponent weight set by default in noisegen.js (don't change)	
		// setExponentWeight(expWeight);

		experiment.stimulus.randomStimulusThreaded(
			magnitude,
			diff,
			KS_TEST_THRESHOLD,
			
			function(results) 
			{
				// visualize the 2AFC images
				experiment.visualize(results);
				experiment.stimDisplayTime = Date.now();

				// keep track of current results
				experiment.currentStimulus = results;

				// zero out the stimulus buffers
				experiment.currentStimulus.stim1Buffer = undefined;
				experiment.currentStimulus.stim2Buffer = undefined;
			}
		);
	})(this, Date.now(), _magnitude, _diff);
}

Experiment.prototype.visualize = function(results)
{
	this.visLeft.run('vis');
	this.visRight.run('vis');

	unselect();

	// hide loading image
	d3.select("#loadingImage")
		.style('visibility', 'hidden')

	// show confirm button
	d3.select('#confirmButton')
		.node().disabled = false;
		//.style('visibility', 'visible');

}

Experiment.prototype.next = function()
{

	// show loading image
	unselect();
	d3.select("#loadingImage").style("visibility", 'visible')

	// hide confirm button
	d3.select("#confirmButton")
		.node().disabled = true;
		//.style("visibility", 'hidden');

	// clear canvas
	this.visLeft.clearCanvas();
	this.visRight.clearCanvas();


	// see if it's time for engagement check
	var magnitude = this.currentMagnitude;
	var diff = this.currentDiff;

	if (this.engagements.length > 0 && this.currentTrial == this.engagements[0]) 
	{
		this.displayingEngagement = true;
		diff = ENGAGEMENT_DIFF;
	}

	// if worker is supported
	if (window.Worker) {
		this.randomStimulusThreaded(magnitude, diff);
	}
}

Experiment.prototype.answer = function(response)
{
	var result = null;
	if (this.displayingEngagement)
	{
		result = this.answerEngagement(response);
	}
	else
	{
		result = this.answerRegular(response);
		if (this.practice && !result) {
			return false;
		}
	}

	// compute percentage complete to update progress bar
	/*
	var p = 
		(this.totalCount + this.currentMagnitudeIndex*ENGAGEMENT_CHECKS + ENGAGEMENT_CHECKS-this.engagements.length) /
		((TRIAL_COUNT + ENGAGEMENT_CHECKS) * MAGNITUDES.length);
	*/
	
	var colormapCount = this.cycleColormaps ? COLORMAPS.length : 1;
	var magCount = MAGNITUDES.length;
	var p = this.totalCount / ( TRIAL_COUNT * magCount * colormapCount );
	
	p = Math.min(1.0, p * .9 + .1);
	d3.select("#rectProgress").attr('width', Math.floor(150*p+.5));
	d3.select("#labelProgress").html(Math.floor(100*p + .5) + '%');

	return result;
}

Experiment.prototype.answerEngagement = function(response)
{
	var correct;
	if ((response == 'right' && !this.stimulus.isSwaped()) ||
		(response == 'left' && this.stimulus.isSwaped()))
	{
		correct = true;
	}
	else
	{
		correct = false;
	}
	
	if (correct) {
		this.engagementCorrectCount++;
	}

	// remove one from engagement
	this.engagements.shift();
	this.displayingEngagement = false;
	this.next();
	return correct;
}

Experiment.prototype.isFinished = function() { 
	return this.finished === true;
}

Experiment.prototype.resumeBlock = function() 
{
	this.next();
}
Experiment.prototype.setBlockPause = function(callback) {
	this.blockPause = callback;
}

Experiment.prototype.getCurrentColormap = function() {
	return this.currentColormap;
}

Experiment.prototype.answerRegular = function(response)
{
	var correct = false;
	if ((response == 'right' && !this.stimulus.isSwaped()) ||
		(response == 'left' && this.stimulus.isSwaped()))
	{
		correct = true;
	}

	if (this.practice && !correct) {
		return false;
	}

	if (!this.currentStimulus.converged && !this.skipped)
	{
		// just skip and get another one, but make sure we only do this once
		// per cycle (i.e., no two skips in a row)
		this.skipped = true;
		console.log("inv stimulis. next()");
		this.next();
		return true;
	}
	this.skipped = undefined;

	if (correct) { 
		this.correctCount++; 
	}

	// store the answer and its parameters (correctness, sequence, responseTime, etc...)
	this.currentStimulus.responseTime = Date.now() - this.stimDisplayTime;
	this.currentStimulus.correct = correct ? 1 : 0;
	this.currentStimulus.stimulusNum = this.totalCount + 1;
	this.currentStimulus.blockNum = this.getCurrentBlock() + 1;
	this.currentStimulus.trialNum = this.currentTrial + 1;
	this.currentStimulus.colormap = this.getCurrentColormap();

	// store answer
	this.experimentalData.push(this.currentStimulus)

	// increment totals
	this.totalCount++;
	this.currentTrial++;
	
	// move to next stimulus or block
	if (this.currentTrial >= TRIAL_COUNT)
	{	
		// clear canvas
		this.visLeft.clearCanvas();
		this.visRight.clearCanvas();

		if (this.nextBlock()) 
		{
			console.log("We're finished");
			this.finished = true;

			// send the data
			if (!this.practice) {
				this.sendData(undefined, function(sent) 
				{
					window.onbeforeunload = null;
					window.location.replace("strategy.html");
				});
			}
			else
			{
				// practice complete
			}

			d3.select("#confirmButton")
				.node().disabled = true;

			d3.select("#loadingImage")
				.style('visibility', 'visible');
		}
		else
		{
			if (this.blockPause) {
				this.blockPause(this.currentMagnitudeIndex, this.currentColormapIndex);
			}
			else
			{
				this.next();
			}
		}
	}
	else
	{
		// we're still in the same block
		if (correct) {
			this.currentDiff = Math.max(DIFF[0], this.currentDiff-FORWARD);
			//console.log("CORRECT! difficulty: " + this.currentDiff)
		}
		else {
			this.currentDiff = Math.min(DIFF[1], this.currentDiff+BACKWARD);
			//console.log("inCORRECT :( difficulty rolled back to: " + this.currentDiff)
		}

		// move to next stimlus
		this.next();
	}
	return correct;
}
