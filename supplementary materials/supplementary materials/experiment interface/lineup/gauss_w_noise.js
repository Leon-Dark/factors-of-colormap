/*******************
 *  全局设定/常量  *
 *******************/
// 需要扰动噪声的模型数目（比如如果有多个 FrequencyModel，仅扰动前 N 个）
var NOISE_PERTURB_COUNT = 2;

// 在 randomPerturb 时，modelNumber == 1 表示扰动“密度部分”，modelNumber == 2 表示扰动“噪声部分”
var DEFAULT_PERTURB_MODEL = 1;

// 调试模式设置: 'low'=低频, 'high'=高频, 'mid'=中频, null=随机模式
var DEBUG_FREQUENCY_MODE = 'high'; // 设置为 null 可恢复随机模式


/*******************
 * FrequencyModel  *
 *******************/
/**
 * 直接实现 eval 方法的模型，用于生成环状、带空间频率的图案。
 */
function FrequencyModel(cx, cy, radius, freqRange, amplitude) {
    this.cx = cx;
    this.cy = cy;
    this.radius = radius;
    this.freqRange = freqRange;  // [低频, 高频]
    this.amplitude = amplitude;

    // 随机相位（决定扰动噪声的起始相位）
    this.randomPhase = DEBUG_FREQUENCY_MODE === null ? Math.random() * Math.PI * 2 : Math.PI / 2;

    // 不规则形状参数（边界扰动）
    this.irregularityAmplitude = 0.15; // 边界扰动幅度（相对于半径的比例）
    this.irregularityFrequency = 5;    // 边界扰动的“波浪”数量

    // 用于区分“密度”和“噪声”模型，在父类逻辑里可能会用到
    this.densityEnabled = false; 
    this.noiseEnabled = true;

    // 计算“空间频率” 相关参数（ringCount、不规则性等）
    this.calculateFrequencyParameters();
}

// 计算环的一些关键参数
FrequencyModel.prototype.calculateFrequencyParameters = function() {
    // 取频率区间的中值作为当前频率
    this.frequency = (this.freqRange[0] + this.freqRange[1]) / 2;

    // ringCount：直观写法是“半径 × 频率”，再四舍五入
    // 比如如果 frequency=1/10，半径=200，则大约 200*(1/10)=20 个周期
    this.ringCount = Math.max(1, Math.round(this.radius * this.frequency));

    // 根据频率区间，动态调整不规则性和扰动频率
    // （可按你需求再自定义更多分段逻辑）
    if (this.frequency < 0.05) {
        // 低频
        this.irregularityAmplitude = 0.2;
        this.irregularityFrequency = 3;
    } else if (this.frequency < 0.15) {
        // 中频
        this.irregularityAmplitude = 0.15;
        this.irregularityFrequency = 6;
    } else {
        // 高频
        this.irregularityAmplitude = 0.15;
        this.irregularityFrequency = 6;
    }

    // console.log("频率:", this.frequency,
    //             "环数:", this.ringCount,
    //             "不规则幅度:", this.irregularityAmplitude,
    //             "波浪数:", this.irregularityFrequency);
};

/**
 * eval(x,y) —— 返回 (x,y) 位置处的灰度值（或强度）。
 * 父类框架会调用它来生成整张图。
 */
FrequencyModel.prototype.eval = function(x, y) {
    var dx = x - this.cx;
    var dy = y - this.cy;
    var distance = Math.sqrt(dx * dx + dy * dy);
    var angle = Math.atan2(dy, dx);
    if (angle < 0) angle += 2 * Math.PI;

    // compute boundary phase shift within sector
    var boundaryPhaseShift = 0;
    var sectorRandomNoise = 0; 
    if (this.perturbParams && this.perturbParams.type === 3) {
        var inPerturbSector = (angle >= this.perturbParams.startAngle && angle <= this.perturbParams.endAngle);
        var transitionWidth = Math.PI /32;
        var angleDist = Math.min(
            Math.abs(angle - this.perturbParams.startAngle),
            Math.abs(angle - this.perturbParams.endAngle)
        );
        var transitionFactor = 0;
        
        if (inPerturbSector) {
            // 如果在扰动扇区内部
            if (angleDist < transitionWidth) {
                // 在边缘过渡区域，使用余弦插值实现平滑过渡
                var t = angleDist / transitionWidth;
                transitionFactor = 0.5 - 0.5 * Math.cos(Math.PI * t);
            } else {
                // 在扰动区域内部，完全应用扰动
                transitionFactor = 1.0;
            }
        }
        
        boundaryPhaseShift = this.perturbParams.phaseShift * transitionFactor;
    }
    var boundaryAngle = angle + boundaryPhaseShift;

    // 边界扰动 - 修改为等高线类似的扰动效果
    // 使用多个不同频率和振幅的正弦函数叠加，创造更复杂的轮廓
    var noise1, noise2, noise3;
    
    if (DEBUG_FREQUENCY_MODE === null) {
        // 在随机模式下，为每次刷新生成完全不同的噪声组合
        noise1 = Math.sin(this.irregularityFrequency * boundaryAngle + this.randomPhase);
        noise2 = Math.sin(this.irregularityFrequency * (2.0 + Math.random() * 0.6) * boundaryAngle + this.randomPhase * (1.0 + Math.random()));
        noise3 = Math.sin(this.irregularityFrequency * (3.5 + Math.random() * 0.4) * boundaryAngle + this.randomPhase * (0.5 + Math.random() * 0.5));
    } else {
        // 在调试模式下，使用固定的噪声组合
        noise1 = Math.sin(this.irregularityFrequency * boundaryAngle + this.randomPhase);
        noise2 = 0.5 * Math.sin(this.irregularityFrequency * 2.3 * boundaryAngle + this.randomPhase * 1.5);
        noise3 = 0.3 * Math.sin(this.irregularityFrequency * 3.7 * boundaryAngle + this.randomPhase * 0.7);
    }
    

    
    // 合并多个噪声函数和距离影响因子，产生聚集的扰动区域
    var boundaryPerturb = this.irregularityAmplitude * this.radius * 
                         (noise1 + noise2 + noise3);
    
    // 添加扇区特定的额外随机扰动
// 添加扇区特定的额外随机扰动（简化版）
if (this.perturbParams && this.perturbParams.type === 4) {
    var sectorWidth   =  this.perturbParams.endAngle - this.perturbParams.startAngle;
    var inPerturbSector = (angle >= this.perturbParams.startAngle &&
                           angle <= this.perturbParams.endAngle);

    if (inPerturbSector) {
        

        // 归一化到 [0,1]，并令边界 sin = 0
        var u = (angle - this.perturbParams.startAngle) / sectorWidth;   // 0~1
        var edgeFactor = Math.sin(Math.PI * u);                          // 0→1→0

        // 初始化一次随机参数
        if (!this.perturbParams.sectorNoiseAmplitude) {
            if (this.frequency < 0.05) {
                // 低频
                this.perturbParams.sectorNoiseAmplitude= 0.2+ Math.random() * 0.3;
            } else if (this.frequency < 0.15) {
                // 中频
                this.perturbParams.sectorNoiseAmplitude = 0.1+ Math.random() * 0.3;
      
            } else {
                // 高频
                this.perturbParams.sectorNoiseAmplitude = 0.1+Math.random() * 0.2;}
            // 增大幅度使形状扰动更明显
            // 降低频率系数，使扰动更侧重于形状而不是频率
            this.perturbParams.freqFactor1 = 0.7;  // 较低频率
            this.perturbParams.freqFactor2 = 2.3;  // 中等频率
            this.perturbParams.freqFactor3 = 3.7;  // 较高频率但仍然适中
            
            // 使用更简单的相位偏移
            this.perturbParams.phase1 = this.randomPhase;
            this.perturbParams.phase2 = this.randomPhase +this.randomPhase * (1.0 + Math.random());  // 错开120度
            this.perturbParams.phase3 = this.randomPhase + this.randomPhase * (0.5 + Math.random() * 0.5);  // 再错开120度
        }

        // 生成低频噪声组合，更专注于形状扰动
        var sectorNoise1 = Math.sin(this.irregularityFrequency * 
                              this.perturbParams.freqFactor1 * angle + 
                              this.perturbParams.phase1);
                           
        var sectorNoise2 = 0.5 * Math.sin(this.irregularityFrequency * 
                               this.perturbParams.freqFactor2 * angle + 
                               this.perturbParams.phase2);
                            
        var sectorNoise3 = 0.3 * Math.sin(this.irregularityFrequency * 
                               this.perturbParams.freqFactor3 * angle + 
                               this.perturbParams.phase3);
        
        // 组合三个噪声
        var combinedNoise = (sectorNoise1 + sectorNoise2 + sectorNoise3) / 1.5; // 除以1.0使总振幅适中但比之前略大
        
        // 叠加并乘以 edgeFactor 使边界自然收敛到 0
        var sectorRandomNoise = edgeFactor * this.radius * 
                              combinedNoise * this.perturbParams.sectorNoiseAmplitude;
        boundaryPerturb += sectorRandomNoise;
    }
}

    
    
    var effectiveRadius = this.radius + boundaryPerturb;

    // 如果超出半径，直接 0
    if (distance > effectiveRadius) {
        return 0;
    }

    // 标准化到 [0,1]
    var normalizedDist = distance / effectiveRadius;
    
    // 应用局部扰动（如果存在）
    var localPerturbFactor = 1.0;
    var phaseModifier = 0;
    var frequencyModifier = 0; // 新增频率修改器
    
    if (this.perturbParams) {
        // 检查当前点是否在扰动角度范围内
        var inPerturbSector = (angle >= this.perturbParams.startAngle && 
                              angle <= this.perturbParams.endAngle);
        
        // 平滑过渡，避免扰动边界的突变
        var angleDist = Math.min(
            Math.abs(angle - this.perturbParams.startAngle),
            Math.abs(angle - this.perturbParams.endAngle)
        );
        var transitionWidth = Math.PI / 16; // 22.5度的过渡区
        var transitionFactor = 1.0;
        
        if (inPerturbSector) {
            // 使用余弦插值实现更平滑的过渡
            if (angleDist < transitionWidth) {
                // 余弦平滑过渡：0->1更加平缓，避免突变
                var t = angleDist / transitionWidth;
                transitionFactor = 0.5 - 0.5 * Math.cos(Math.PI * t);
            } else {
                // 在扰动区域内部，完全应用扰动
                transitionFactor = 1.0;
            }
            
            // 根据扰动类型应用不同效果
            if (this.perturbParams.type === "combined") {
                // 振幅变化
                localPerturbFactor = 1.0 - this.perturbParams.amplitudeChange * transitionFactor;
                // 相位变化
                phaseModifier = this.perturbParams.phaseShift * transitionFactor;
            } else if (this.perturbParams.type === 1) {
                // 振幅变化
                localPerturbFactor = 1.0 - this.perturbParams.amplitudeChange * transitionFactor;
            } else if (this.perturbParams.type === 2) {
                // 频率变化 - 会影响周期长度
                frequencyModifier = this.perturbParams.frequencyChange * transitionFactor;
            } else if (this.perturbParams.type === 3) {
                // 相位变化 - 仅应用条纹相位扰动
                phaseModifier = this.perturbParams.phaseShift * transitionFactor;
            } else if (this.perturbParams.type === 4) {
                // 边界随机扰动 - 不影响条纹相位，扰动计算已在上方完成
                phaseModifier = 0; // 保持条纹相位不变
            }
        }
    }

    // 计算正弦条纹，应用频率扰动
    var effectiveRingCount = this.ringCount * (1 + frequencyModifier);
    var sinVal = Math.sin(2 * Math.PI * effectiveRingCount * normalizedDist + phaseModifier);

    // 加入角度调制
    var angleModulation = 1 + 0.1 * Math.sin(angle * 3 + this.randomPhase);
    sinVal *= angleModulation;

    // 先做原本的 windowFactor 衰减（从中心到边缘余弦减弱）
    var windowFactor = Math.cos(Math.PI * normalizedDist / 2);
    var value = (sinVal + 1) / 2;
    //value *= (windowFactor * windowFactor);

    // 应用振幅扰动
    value *= localPerturbFactor;

    // 外圈提早衰减逻辑
    var fadeStart = 0.7;  // 从 70% 半径处开始衰减，你可调成更大/更小
    if (normalizedDist > fadeStart) {
        var fadeNorm = (normalizedDist - fadeStart) / (1 - fadeStart);
        fadeNorm = Math.max(0, Math.min(1, fadeNorm));
        // 这里用平方让曲线更柔和，也可以用别的函数
        fadeNorm = fadeNorm * fadeNorm;
        value *= (1 - fadeNorm);
    }

    // 应用对比度
    return this.amplitude * value;
};

// 随机扰动噪声（让图案稍微有差别，用于"graphical inference"对比）
FrequencyModel.prototype.perturbNoise = function() {
    // 创建局部扰动而非全局扰动
    console.log("创建局部扰动");
    
    // 随机选择扰动角度范围（局部区域）
    var startAngle, endAngle;
    if (DEBUG_FREQUENCY_MODE !== null) {
        // 在调试模式下使用固定的扇区范围：45°-135°
        startAngle =  Math.PI/4 ;
        var sectorSize = Math.PI / 3 + Math.random() * Math.PI*2/3; // 45-180度的扇区
        endAngle = startAngle + sectorSize;
    } else {
        // 在随机模式下使用随机扇区
        startAngle = Math.random() * Math.PI * 2;
        var sectorSize = Math.PI / 2 + Math.random() * Math.PI/2; // 45-180度的扇区
        endAngle = startAngle + sectorSize;
        
        // 确保角度在 0-2π 范围内
        if (endAngle > Math.PI * 2) {
            startAngle = Math.max(0, startAngle - (endAngle - Math.PI * 2));
            endAngle = Math.PI * 2;
        }
    }
    
    // 随机选择一种扰动类型
    // 1=振幅扰动，2=频率扰动，3=相位扰动，4=边界随机扰动
    var perturbType = Math.floor(Math.random() * 4) + 1;
    
    // 强制使用相位扰动用于调试 - 如果需要始终测试相位扰动效果，取消下行注释
    // perturbType = 3; // 测试相位扰动
    perturbType = 4; // 测试边界随机扰动
    
    // 保存扰动参数，将在eval函数中使用
    this.perturbParams = {
        type: perturbType,
        startAngle: startAngle,
        endAngle: endAngle,
        // 扰动强度参数 - 比全局扰动更强以使其更明显
        amplitudeChange: 0.1 + Math.random() * 0.9, // 0.1-0.3的变化
        frequencyChange: 0.2 + Math.random() * 0.3, // 频率增加20%-50%
        phaseShift: Math.random() * Math.PI // 增强相位扰动：180°-360°的相位偏移
    };
    
    // 根据扰动类型更新日志消息
    var perturbTypeStr = "";
    switch(perturbType) {
        case 1: 
            perturbTypeStr = "振幅"; 
            break;
        case 2: 
            perturbTypeStr = "频率"; 
            break;
        case 3: 
            perturbTypeStr = "相位"; 
            break;
        case 4: 
            perturbTypeStr = "边界随机"; 
            break;
    }
    
    console.log(perturbTypeStr + "局部扰动已创建",
                "角度范围:", Math.round(startAngle * 180 / Math.PI) + "°-" + 
                Math.round(endAngle * 180 / Math.PI) + "°");
    
    // 根据扰动类型打印特定参数
    if (perturbType === 1) {
        console.log("振幅变化:", this.perturbParams.amplitudeChange.toFixed(2));
    } else if (perturbType === 2) {
        console.log("频率变化:", "+" + Math.round(this.perturbParams.frequencyChange * 100) + "%");
    } else if (perturbType === 3) {
        console.log("相位偏移:", Math.round(this.perturbParams.phaseShift * 180 / Math.PI) + "°");
    } else if (perturbType === 4) {
        console.log("边界随机扰动");
    }
};

// 复制当前模型（为满足父类可能需要的 copy 功能）
FrequencyModel.prototype.copy = function() {
    var copy = new FrequencyModel(
        this.cx,
        this.cy,
        this.radius,
        [this.freqRange[0], this.freqRange[1]],
        this.amplitude
    );
    copy.randomPhase = this.randomPhase;
    copy.irregularityAmplitude = this.irregularityAmplitude;
    copy.irregularityFrequency = this.irregularityFrequency;
    return copy;
};



/*****************************
 * GaussMixWithNoise  (主类) *
 *****************************/
/**
 * 继承自 GaussMixBivariate 的类，用来管理模型数组，进行渲染与扰动。
 */
function GaussMixWithNoise(w, h, svg) {
    // 调用父类构造
    GaussMixBivariate.call(this, w, h, svg);
}

GaussMixWithNoise.prototype = Object.create(GaussMixBivariate.prototype);
// 采样线性均值、γ-均值、bright%
GaussMixWithNoise.prototype.sampleStats = function(
    model,
    N = 50000,
    gamma = 2.2,
    thr  = 0.6          // ⬅️ 新增阈值参数
) {
    let sumLin = 0, sumGamma = 0;
    let bright80 = 0, brightCustom = 0;

    const w = this.w, h = this.h;
    for (let i = 0; i < N; i++) {
        const x = Math.random() * w;
        const y = Math.random() * h;
        const v = model.eval(x, y);               // 线性灰度
        sumLin   += v;

        const vg = Math.pow(Math.min(Math.max(v, 0), 1), 1 / gamma); // γ-校正
        sumGamma += vg;

        if (vg > 0.8) bright80++;     // 旧版 brightPct
        if (vg >  thr) brightCustom++;
    }

    return {
        meanLin      : sumLin   / N,
        meanGamma    : sumGamma / N,
        brightPct    : bright80     / N,   // 仍然返回旧字段
        brightPctThr : brightCustom / N    // 新字段，阈值可改
    };
};


/**
 * 随机扰动入口
 * @param {number} modelNumber - 1 表示 perturbDensity, 2 表示 perturbNoise
 */
GaussMixWithNoise.prototype.randomPerturb = function(modelNumber) {
    var models = this.models;
    var m = models[0];
    
    console.log("扰动前:", this.sampleStats(m));
    m.perturbNoise();
    this.updateModel();
    console.log("扰动后:", this.sampleStats(m));
    
};



/**
 * 初始化：这里生成一个 FrequencyModel，并加入 models 数组。
 * 你也可以一次加入多个不同频率的模型，以便多重对比。
 * @param {Object} options - 可选参数
 * @param {string} options.debugMode - 调试模式: 'low'=低频, 'high'=高频, 'mid'=中频, null=随机
 */
GaussMixWithNoise.prototype.init = function(options) {
    // 清空已有模型
    this.models = [];

    // 预设的三个频率区间
    var freqRanges = [
        [1/50, 1/40], // 低频
        [1/15, 1/15], // 中频
        [1/10,  1/10]   // 高频
    ];

    // 用于辅助打印日志
    var freqDescription = ["低频 (约40~50像素)", "中频 (约10~20像素)", "高频 (约5~8像素)"];

    // 频率选择逻辑
    var freq_index;
    
    // 检查是否有调试模式参数
    if (options && options.debugMode) {
        if (options.debugMode === 'low') {
            freq_index = 0; // 低频
          //  console.log("调试模式: 使用低频数据");
        } else if (options.debugMode === 'high') {
            freq_index = 2; // 高频
           // console.log("调试模式: 使用高频数据");
        } else if (options.debugMode === 'mid') {
            freq_index = 1; // 中频
            //console.log("调试模式: 使用中频数据");
        } else {
            // 未知模式，使用随机
            freq_index = Math.floor(Math.random() * freqRanges.length);
            //console.log("未知调试模式，使用随机频率");
        }
    } else if (DEBUG_FREQUENCY_MODE) {
        if (DEBUG_FREQUENCY_MODE === 'low') {
            freq_index = 0; // 低频
            //console.log("调试模式: 使用低频数据");
        } else if (DEBUG_FREQUENCY_MODE === 'high') {
            freq_index = 2; // 高频
            //console.log("调试模式: 使用高频数据");
        } else if (DEBUG_FREQUENCY_MODE === 'mid') {
            freq_index = 1; // 中频
            //console.log("调试模式: 使用中频数据");
        }
    } else {
        // 正常模式：随机选择某个频段
        freq_index = Math.floor(Math.random() * freqRanges.length);
    }
    
    var chosenRange = freqRanges[freq_index];
    var desc = freqDescription[freq_index];

    // 取这个区间的中间值，构造一个稍微缩放的"目标区间"
    var midFreq = (chosenRange[0] + chosenRange[1]) / 2;
    var selectedRange = [midFreq * 0.9, midFreq * 1.1];

    // 设定振幅与图案半径
    var amplitude = 1.0;
    var radius = 200;

    // 中心位置
    var cx = this.w / 2;
    var cy = this.h / 2;

    // 创建一个 FrequencyModel，并加入到 models
    var freqModel = new FrequencyModel(cx, cy, radius, selectedRange, amplitude);
    this.models.push(freqModel);

    // 让父类/框架去更新可视化
    this.updateModel();
};

/**
 * 复制当前模型到一个新对象（父类流程可能会用到）
 * @param {GaussMixWithNoise} newModel - 可选，如果不传则自动创建
 * @param {boolean} dontUpdate - 若为 true，则复制完不调用 updateModel()
 */
GaussMixWithNoise.prototype.copyTo = function(newModel, dontUpdate) {
    if (!newModel) { 
        newModel = new GaussMixWithNoise(this.w, this.h, this.svg);
    }

    newModel.models = [];
    for (var i = 0; i < this.models.length; i++) {
        var srcModel = this.models[i];
        newModel.models.push(srcModel.copy());
    }

    if (!dontUpdate) {
        newModel.updateModel();
    }

    return newModel;
};
