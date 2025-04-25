function LineupExperiment(w, h, _lineupN, gMain, gDecoy, nullOption, table)
{
    // width / height of the model
    this.w = w;
    this.h = h;

    // whether to randomly perturb decoy (subjec to perturbation parameters)
    this.perturb = true;

    // create model
    var modelType = GaussMixWithNoise;
    if (typeof MODEL_TYPE !== 'undefined') {
        modelType = MODEL_TYPE;
    }
    this.main = new modelType(w, h, gMain);
    this.decoy = new modelType(w, h, gDecoy);

    this.randomModel();

    // lineup
    this.lineupN = _lineupN;
    if (table) {
        this.lineup = new LineupFixed(w, h, _lineupN, this.main, this.decoy, nullOption, table);
    }
    else {
        this.lineup = new Lineup(w, h, _lineupN, this.main, this.decoy, nullOption);
    }

    this.canMakeSelection = false;
    this.nullOption = nullOption;
}

LineupExperiment.prototype.dispose = function() {
    this.lineup.dispose();
    this.main.dispose();
    this.decoy.dispose();
    this.main = null;
    this.decoy = null;
    this.w = null;
    this.h = null;
}

LineupExperiment.prototype.enableSelection = function(t) {
    this.canMakeSelection = t;
}
LineupExperiment.prototype.getMain = function() {
    return this.main;
}

LineupExperiment.prototype.getDecoy = function() {
    return this.decoy;
}

LineupExperiment.prototype.copyToDecoy = function()
{
    this.main.copyTo(this.decoy);
    if (this.perturb)
    {
        this.decoy.randomPerturb(2);
    }
    this.decoy.fireCallbacks();
}

LineupExperiment.prototype.setClickFeedback = function(correct, incorrect)
{
    this.correct = correct;
    this.incorrect = incorrect;
}

LineupExperiment.prototype.randomModel = function()
{
    this.decoy.flipDensity = false;
    this.curDistance = null;
    this.main.init();
    this.copyToDecoy();
}

LineupExperiment.prototype.modelDecoyDistance = function()
{
    this.curDistance = this.main.normalizedDivergence(this.decoy);
    return this.curDistance;
}

LineupExperiment.prototype.getAnswer = function() {
    return this.answer;
}

LineupExperiment.prototype.clearAnswer = function() {
    this.answer = null;
    if (this.tdSelection) {
        this.tdSelection.style('background-color', null);
    }
}

LineupExperiment.prototype.highlightCorrect = function(show)
{
    this.domSelection.selectAll('td').style('background-color', null);
    d3.select('div.nullOption').style('border', 'solid 1px black');

    var correctAnswer = this.lineup.getCorrectAnswer();
    if (!Array.isArray(correctAnswer))
    {
        correctAnswer = [correctAnswer];
    }

    for (var i=0; i<correctAnswer.length; i++)
    {
        var correctID = 'canvas.index' + correctAnswer[i];
        var td = d3.select(correctID).node().parentNode;
        if (this.trialHasDecoy)
        {
            d3.select(td)
                .style('background-color', show ? '#aaaaaa' : null);
        }
        else
        {
            d3.select('div.nullOption')
                .style('border', show ? 'solid 10px #aaaaaa' : 'solid 1px black');
        }
    }
    // 00cc66
}

LineupExperiment.prototype.getComputationTime = function()
{
    return {
        samplingTime: this.lineup.samplingTime,
        visTime: this.lineup.visTime
    };
}

LineupExperiment.prototype.randomLineup = function(fidelity, domSelection, noDecoy)
{
    var SEL_BORDER = "#ff623b";

    // new lineup
    this.trialHasDecoy = noDecoy ? false : true;
    this.lineup.layoutCanvases(domSelection);
    this.lineup.sample(fidelity, noDecoy);
    this.domSelection = domSelection;

    this.correctAnswer = this.lineup.getCorrectAnswer();

    // clear out old selection / answer
    this.answer = null;

    var canvasType = 'canvas';
    if (typeof CANVAS_TYPE === 'string') {
        canvasType = CANVAS_TYPE
    }

    this.tdSelection = domSelection.selectAll('td')
    this.canvasSelection = domSelection.selectAll(canvasType);
    this.nullSelection = domSelection.selectAll('div.nullOption');

    // clear earlier selection
    this.tdSelection.style('background-color', null);

    // setup callbacks
    (function(lineup, dom, noDecoy, correctAnswer)
    {
        lineup.canvasSelection.on('click', function()
        {
            lineup.canvasIndex = d3.select(this).attr('class').substr(5);

            // check if this is the correct answer
            lineup.answer = '0';
            lineup.answerModel = '0';

            //console.log('canvasIndex: ' + lineup.canvasIndex + ', correct: ' + correctAnswer);

            if (!Array.isArray(correctAnswer)) {
                correctAnswer = [correctAnswer];
            }
            for (var i=0; i<correctAnswer.length; i++)
            {
                if (!noDecoy && correctAnswer[i] == +lineup.canvasIndex)
                {
                    lineup.answer = '1';
                    lineup.answerModel = i+1;
                    if (lineup.correct) lineup.correct(lineup.answerModel);
                    break;
                }
            }
            if (lineup.answer == '0' && lineup.incorrect())
            {
                lineup.incorrect()
            }

            if (lineup.canMakeSelection)
            {
                lineup.tdSelection.style('background-color', null);
                lineup.nullSelection.style('border', 'solid 1px black');
                d3.select(this.parentNode).style('background-color', SEL_BORDER);
            }
        });

        dom.selectAll('div.nullOption').on('click', function()
        {
            if (noDecoy && lineup.correct) lineup.correct(0);
            else if (!noDecoy && lineup.incorrect) lineup.incorrect();

            lineup.answer = noDecoy ? '1' : '0';
            lineup.tdSelection.style('background-color', null);
            d3.select(this).style('border', 'solid 10px ' + SEL_BORDER)
            lineup.canvasIndex = '98';
        });

    })(this, domSelection, noDecoy, this.correctAnswer);
}

// generates a lineup with an expected distance between the main and the decoy
// ideally, set tolerance level to STD (from simulations)
var LINEUP_TOLERANCE = 0.01;
var LINEUP_MAX_TRIAL = 150;
var LINEUP_MAX_ROUNDS = 3;

LineupExperiment.prototype.modelWithExpectation = function(expectation)
{
    //expectation（目标距离）：
    //如果是 数值，则目标是让 main 模型与 decoy（干扰模型）之间的分布距离接近该值。
    //如果是 对象（范围值），则目标是让计算出的距离 distance 落在 [expectation[0], expectation[1]] 之间。
    var range = expectation && typeof(expectation) == 'object';

    var tolerance = LINEUP_TOLERANCE;
    var converged = false;
    var distance = null;
    var iterations = 0;

    //range：如果 expectation 是一个数组（如 [0.1, 0.3]），则 range 设为 true，表示距离需要落在某个区间内。
    //tolerance：允许的误差范围（默认 LINEUP_TOLERANCE = 0.01）。
    //converged：指示是否找到符合 expectation 设定的数据。
    //distance：当前 main 和 decoy 之间的计算距离。
    //iterations：记录实验中进行了多少次尝试。

    this.answer = null;

    for (var round=0; !converged && round<LINEUP_MAX_ROUNDS; round++)
    {
        for (var trial=0; !converged && trial<LINEUP_MAX_TRIAL; trial++, iterations++)
        {
            this.randomModel();
            distance = this.modelDecoyDistance();

            if (!expectation)
            {
                console.log("no expectaiton. Converged");
                converged = true;
                expectation = 0.0;
            }
            else if (expectation < 0)
            {
                converged = true;
                this.decoy.flipDensity = true;
                //不会只是在 main 的基础上添加小扰动，而是整个分布发生大幅变化，使其和 main 更加不同。
            }
            else
            {
                if (range && distance >= expectation[0] && distance <= expectation[1])
                {
                    converged = true;
                }
                if (Math.abs(distance-expectation) <= tolerance)
                {
                    converged = true;
                }
            }
        }

        if (!converged)
        {
            tolerance *= 2;
        }
    }

    //console.log("[" + iterations + "]: requested: " + expectation + ", got: " + distance);
    this.curDistance = distance;
    this.curExpectation = expectation;
    this.converged = converged;
    this.iterations = iterations;

    return distance;
}

LineupExperiment.prototype.getCurDistance = function() {
    return this.curDistance;
}

LineupExperiment.prototype.getCurExpectation = function() {
    return this.curExpectation;
}
