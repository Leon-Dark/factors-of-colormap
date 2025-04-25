function LineupExperimentTwo(w, h, _lineupN, gMain, gDecoy, nullOption, table)
{
    this.w = w;
    this.h = h;

    this.perturb = true;
    this.blockOffset = null;  

    // create model
    var modelType = GaussMixWithNoise;
    // if (typeof MODEL_TYPE !== 'undefined') {
    //     modelType = MODEL_TYPE;
    // }
    this.main = new modelType(w, h);
    this.decoy = new modelType(w, h);
 //   this.decoyTwo = new modelType(w, h);

    // create a random model
    this.randomModel();

    // lineup
    this.lineupN = _lineupN;
    var decoys = [this.decoy];
    if (table) {
        this.lineup = new LineupMultiFixed(w, h, _lineupN, this.main, decoys, nullOption, table);
    }
    else {
        this.lineup = new LineupMulti(w, h, _lineupN, this.main, decoys, nullOption)
    }

    this.canMakeSelection = false;
    this.nullOption = nullOption;
}

LineupExperimentTwo.prototype = Object.create(LineupExperiment.prototype);

LineupExperimentTwo.prototype.dispose = function()
{
    this.decoyTwo.dispose();
    LineupExperiment.prototype.dispose.call(this);
}

LineupExperimentTwo.prototype.copyToDecoy = function()
{
    this.main.copyTo(this.decoy);
  //  this.main.copyTo(this.decoyTwo);

    if (this.perturb)
    {
        this.decoy.randomPerturb(2);
       // this.decoyTwo.randomPerturb(2);
    }

    this.decoy.fireCallbacks();
    //this.decoyTwo.fireCallbacks();
}

LineupExperimentTwo.prototype.setBlockOffset = function(offset) {
    this.blockOffset = offset;
};

LineupExperimentTwo.prototype.getBlockOffset = function() {
    return this.blockOffset;
};
