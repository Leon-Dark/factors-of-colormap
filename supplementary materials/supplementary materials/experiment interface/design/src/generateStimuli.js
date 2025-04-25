function hclToRgb(h, c, l) {
    // 1️⃣ HCL → Lab
    let hRad = (h / 360) * 2 * Math.PI; // 角度转弧度
    let a = c * Math.cos(hRad);
    let b = c * Math.sin(hRad);

    // 2️⃣ Lab → XYZ
    let y = (l + 16) / 116;
    let x = a / 500 + y;
    let z = y - b / 200;

    // Lab 非线性转换
    const labToXyz = t => (t ** 3 > 0.008856 ? t ** 3 : (t - 16 / 116) / 7.787);
    x = labToXyz(x) * 95.047;
    y = labToXyz(y) * 100.000;
    z = labToXyz(z) * 108.883;

    // 3️⃣ XYZ → RGB
    r = x * 3.2406 + y * -1.5372 + z * -0.4986;
    g = x * -0.9689 + y * 1.8758 + z * 0.0415;
    b = x * 0.0557 + y * -0.2040 + z * 1.0570;

    // Gamma 校正
    const gammaCorrect = t => (t > 0.0031308 ? 1.055 * Math.pow(t, 1 / 2.4) - 0.055 : 12.92 * t);
    r = gammaCorrect(r / 100);
    g = gammaCorrect(g / 100);
    b = gammaCorrect(b / 100);

    // 归一化到 [0, 255]
    // r = Math.round(Math.max(0, Math.min(1, r)) * 255);
    // g = Math.round(Math.max(0, Math.min(1, g)) * 255);
    // b = Math.round(Math.max(0, Math.min(1, b)) * 255);

    return d3.rgb(r, g, b)
}
// 通过 Gamut Mapping 调整 HCL 颜色，使其落入可表示的 RGB 颜色空间
function gamutMappingHCL(h, c, l, maxIterations = 100, tolerance = 1e-5) {
    let cAdjusted = c;

    for (let i = 0; i < maxIterations; i++) {
        // 使用 d3-color 进行 HCL 转换
        // let color = d3.hcl(h, cAdjusted, l);
        // let rgb = d3.rgb(d3.lab(color));
        // hcl转rgb
        let rgb = hclToRgb(h, cAdjusted, l);

        // 检查是否落在 [0, 255] 的 RGB 颜色空间
        if (rgb.r >= 0 && rgb.r <= 255 && rgb.g >= 0 && rgb.g <= 255 && rgb.b >= 0 && rgb.b <= 255) {
            return cAdjusted;
        }

        // 如果超出 RGB 颜色空间，则减少 Chroma
        cAdjusted *= 0.95;

        // 如果 C 值已经极小，则停止调整
        if (cAdjusted < tolerance) break;
    }

    // 返回最终调整后的chroma
    return cAdjusted;
}

function getInterpolateValues(arr, num) {
    let step_num = Math.round(2000 / (arr.length - 1)), interpolated_arr = []
    for (let i = 0; i < arr.length - 1; i++) {
        for (let j = 0; j < step_num; j++) {
            let v = arr[i] + j / step_num * (arr[i + 1] - arr[i])
            interpolated_arr.push(v)
        }
    }
    interpolated_arr.push(arr[arr.length - 1])
    // sample num colors
    let sampled_colormap = []
    for (let i = 0; i < num; i++) {
        let idx = Math.floor(i / (num - 1) * (interpolated_arr.length - 1))
        sampled_colormap.push(interpolated_arr[idx])
    }
    return sampled_colormap
}

// you need to import <script type="text/javascript" src="./c3.min.js"></script>
c3.init(c3_data);
c3.api();
// color name lookup table
let color_name_map = {};
for (var c = 0; c < c3.color.length; ++c) {
    var x = c3.color[c];
    color_name_map[[x.L, x.a, x.b].join(",")] = c;
}

function getColorNameIndex(c) {
    var x = d3.lab(c),
        L = 5 * Math.round(x.L / 5),
        a = 5 * Math.round(x.a / 5),
        b = 5 * Math.round(x.b / 5),
        s = [L, a, b].join(",");
    return color_name_map[s];
}

function getNameDifference(x1, x2) {
    let c1 = getColorNameIndex(x1),
        c2 = getColorNameIndex(x2);
    //    console.log(c1, c2)
    return 1 - c3.color.cosine(c1, c2);
}

function getColorName(color) {
    let c = getColorNameIndex(color),
        t = c3.color.relatedTerms(c, 3);
    if (t[0] != undefined) {
        return [c3.terms[t[0].index], c3.terms[t[1].index], c3.terms[t[2].index]]
    }
    return [undefined]
}


function generateStimuli() {
    let colormap_array = []
    let used_hues = [0, 50, 100, 150, 200, 250, 300].reverse()
    let hues_array = [used_hues.slice(), used_hues.slice(0, 5), used_hues.slice(0, 3)],
        lumi_array = [[70, 70], [10, 90], [10, 90, 10], [10, 90, 10, 90], [10, 90, 10, 90, 10], [10, 90, 10, 90, 10, 90], [10, 90, 10, 90, 10, 90, 10], [10, 90, 10, 90, 10, 90, 10, 90], [10, 90, 10, 90, 10, 90, 10, 90, 10], [10, 90, 10, 90, 10, 90, 10, 90, 10, 90]]
    let sample_number = 500
    // insert random offset
    let offsets = []
    hues_array = []
    for (let i = 0; i < 3; i++) {
        let offset = 48.9280940699696,hues = []//Math.random() * 60,  ,  
        for (let j = 0; j < used_hues.length; j++) {
            hues.push(used_hues[j] + offset)
        }
        if (i == 0) {
            hues_array.push(hues.slice())
        } else if (i == 1) {
            let start_idx = Math.round(Math.random() * (used_hues.length - 5))
            hues_array.push(hues.slice(start_idx, start_idx + 5))
        } else {
            let start_idx = Math.round(Math.random() * (used_hues.length - 3))
            hues_array.push(hues.slice(start_idx, start_idx + 3))
        }
        offsets.push(offset)
        console.log("offset: ", offset);
    }

    for (let j = 0; j < lumi_array.length; j++) {
        let lumi = getInterpolateValues(lumi_array[j], sample_number)
        for (let i = 0; i < hues_array.length; i++) {
            let hues = getInterpolateValues(hues_array[i], sample_number)
            let chroma_array = []
            for (let k = 0; k < hues_array[i].length; k++) {
                let idx = Math.floor(k / (hues_array[i].length - 1) * (lumi.length - 1))
                let c = gamutMappingHCL(hues_array[i][k], 100, lumi[idx])
                chroma_array.push(c)
            }

            let chroma = getInterpolateValues(chroma_array, sample_number)

            let colors = []
            for (let k = 0; k < hues.length; k++) {
                colors.push([hues[k], chroma[k], lumi[k]])
            }
            if (j > 2) {
                colors = optimizingLuminance(colors, lumi_array[j])
            }

            colormap_array.push({
                colors: colors,
                offset: offsets[i]
            })
        }
        // hue = chroma = 0
        colormap_array.push({
            colors: Array(sample_number).fill(0).map((_, k) => [0, 0, lumi[k]]),
            offset: 0
        })
    }

    return colormap_array
}

function checkSimilarity(colormap) {
    let sample_number = 20, sample_colors = []
    for (let i = 0; i < sample_number; i++) {
        let idx = Math.floor(i / (sample_number - 1) * (colormap.length - 1))
        sample_colors.push(d3.lab(d3.hcl(colormap[idx][0], colormap[idx][1], colormap[idx][2])))
    }
    for (let i = 0; i < sample_colors.length; i++) {
        for (let j = i + 1; j < sample_colors.length; j++) {
            let cd = d3_ciede2000(sample_colors[i], sample_colors[j])
            if (cd < 3) {
                return false
            }
        }
    }
    return true
}

function optimizingLuminance(colormap, luminance) {

    // get control points
    let control_points = []
    for (let i = 0; i < luminance.length; i++) {
        let idx = Math.floor(i / (luminance.length - 1) * (colormap.length - 1))
        control_points.push(colormap[idx].slice())
    }
    // optimizing luminance of middle colors
    for (let i = 1; i < control_points.length - 1; i++) {
        let color = control_points[i]
        // if (color[2] > 30) continue
        for (let j = 0; j < 20; j++) {
            let name = getColorName(d3.hcl(color[0], color[1], color[2])).slice(0, 3),
                nd_black = getNameDifference(d3.lab(d3.hcl(color[0], color[1], color[2])), d3.lab(d3.rgb(0, 0, 0))),
                nd_white = getNameDifference(d3.lab(d3.hcl(color[0], color[1], color[2])), d3.lab(d3.rgb(255, 255, 255)))
            // console.log(color, name, nd);
            // if (name.every(item => item !== undefined && item.includes("black"))) {
            //     break
            // }
            if (name.every(item => item !== undefined) && nd_black > 0.9 && nd_white > 0.9) {
                // console.log(color, name, nd);
                break
            }
            if (nd_black < 0.9)
                color[2] += 1
            if (nd_white < 0.9)
                color[2] -= 1
            color[1] = gamutMappingHCL(color[0], 100, color[2])
        }
    }

    // make sure all middle colors have enough JND
    for (let i = 1; i < control_points.length - 1; i++) {
        for (let j = i + 1; j < control_points.length - 1; j++) {
            for (let k = 0; k < 20; k++) {
                let cd = d3_ciede2000(d3.lab(d3.hcl(control_points[i][0], control_points[i][1], control_points[i][2])), d3.lab(d3.hcl(control_points[j][0], control_points[j][1], control_points[j][2])))
                if (cd > 6) {
                    break
                }
                if (control_points[j][2] < 40 && control_points[i][2] < 40) {
                    if (control_points[j][2] < 40) {
                        control_points[j][2] += 1
                        control_points[j][1] = gamutMappingHCL(control_points[j][0], 100, control_points[j][2])
                    } else if (control_points[i][2] < 40) {
                        control_points[i][2] += 1
                        control_points[i][1] = gamutMappingHCL(control_points[i][0], 100, control_points[i][2])
                    }
                }
                if (control_points[j][2] > 60 && control_points[i][2] > 60) {
                    if (control_points[i][2] > 60) {
                        control_points[i][2] -= 1
                        control_points[i][1] = gamutMappingHCL(control_points[i][0], 100, control_points[i][2])
                    } else if (control_points[j][2] > 60) {
                        control_points[j][2] -= 1
                        control_points[j][1] = gamutMappingHCL(control_points[j][0], 100, control_points[j][2])
                    }
                }

            }
        }
    }

    // re-interpolate colormap
    let step_num = Math.round(2000 / (control_points.length - 1)), interpolated_arr = []
    for (let i = 0; i < control_points.length - 1; i++) {
        for (let j = 0; j < step_num; j++) {
            let v = control_points[i][0] + j / step_num * (control_points[i + 1][0] - control_points[i][0]),
                v1 = control_points[i][1] + j / step_num * (control_points[i + 1][1] - control_points[i][1]),
                v2 = control_points[i][2] + j / step_num * (control_points[i + 1][2] - control_points[i][2])
            interpolated_arr.push([v, v1, v2])
        }
    }
    interpolated_arr.push(control_points[control_points.length - 1])
    // sample num colors
    let sampled_colormap = []
    for (let i = 0; i < colormap.length; i++) {
        let idx = Math.floor(i / (colormap.length - 1) * (interpolated_arr.length - 1))
        sampled_colormap.push(interpolated_arr[idx])
    }
    return sampled_colormap
}

function generateAllStimuliCombinations() {
    let colormap_array = generateStimuli()
    let hues_array = ["Hue-7", "Hue-5", "Hue-3", "Hue-0"],
        lumi_array = ["Wave-0", "Wave-1", "Wave-2", "Wave-3", "Wave-4", "Wave-5", "Wave-6", "Wave-7", "Wave-8", "Wave-9"]
    let colormap_names = {}
    for (let i = 0; i < hues_array.length; i++) {
        for (let j = 0; j < lumi_array.length; j++) {
            let idx = j * hues_array.length + i
            let colormap = colormap_array[idx]
            let condition = [hues_array[i], lumi_array[j]].join(" with ")
            if(condition ==="Hue-0 with Isoluminance") {
                continue
            }
            // 确保 colormap 对象具有所需的方法
            let colormapObj = {
                colors: colormap.colors,
                offset: colormap.offset,
            }
            colormap_names[condition] = colormapObj
        }
    }
    console.log(colormap_names)
    return colormap_names
}
var COLOR_PRESETS=generateAllStimuliCombinations()
console.log(COLOR_PRESETS)
console.log("Offsets for each block:")
for (let condition in COLOR_PRESETS) {
    console.log(`${condition} offset:`, COLOR_PRESETS[condition].offset)
}