
function drawStimuli(lineupobj) {
    let lineup_datas = []
    for (let n = 0; n < lineupobj.lineup.samplers.length; n++) {
        let view = new Float32Array(lineupobj.lineup.samplers[n].field.buffer);
        let data = new Array(200)
        for (let i = 0; i < 200; i++) {
            data[i] = new Array(200)
            for (let j = 0; j < 200; j++) {
                let idx = i * 200 + j;
                data[i][j] = view[idx]
            }
        }
        lineup_datas.push(data)
    }
    let lineup_datas_extent = [Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER]
    let all_data = []
    for (let i = 0; i < lineup_datas.length; i++) {
        if (lineup_datas[i]) {
            all_data = all_data.concat(lineup_datas[i])
        }
    }
    for (let i = 0; i < all_data.length; i++) {
        for (let j = 0; j < all_data[i].length; j++) {
            if (all_data[i][j] != 'NaN') {
                if (lineup_datas_extent[0] > +all_data[i][j]) lineup_datas_extent[0] = +all_data[i][j]
                if (lineup_datas_extent[1] < +all_data[i][j]) lineup_datas_extent[1] = +all_data[i][j]
            }
        }
    }
    console.log("lineup_datas_extent", lineup_datas_extent);


    let colormap_array = COLOR_PRESETS
    d3.select("body").selectAll("#mainDiv").remove()
    let main_div = d3.select("body").append("div").attr("id", "mainDiv")
    for (let condition in colormap_array) {
        let colormap = colormap_array[condition].colors
        let div = main_div.append("div").attr("id", "mainDiv")
            .style("border", "1px solid black").style("margin-top", "10px")
            .style("padding", "5px")
        div.append("h3").text(condition)
        // render the colormap
        drawStimuliColormap(colormap, div, condition)
        // div.append("br")
        // drawStimuliColormapControlPoints(colormap_control_points_arr[idx], div)
        div.append("br")
        drawStimuliCurve(colormap, div, 0, "Hue")
        drawStimuliCurve(colormap, div, 1, "Chroma")
        drawStimuliCurve(colormap, div, 2, "Luminance")
        div.append("br")
        drawStimuliLineups(lineup_datas, lineup_datas_extent, colormap, div, condition)
    }
}

function drawStimuliColormap(colormap, div, id) {

    let width = colormap.length, height = 45
    //get context 
    div.append("canvas").attr("id", id)
        .attr("width", width).attr("height", height).style("margin-left", "20px").style("display", "inline-block")
    let canvas = document.getElementById(id)
    let context = canvas.getContext('2d');

    //traverse the image data
    for (var i = 0; i < canvas.width; i++) {
        let tuple = d3.rgb(d3.lab(d3.hcl(colormap[i][0], colormap[i][1], colormap[i][2])))
        for (var j = 0; j < canvas.height; j++) {
            context.fillStyle = 'rgba(' + tuple.r +
                ',' + tuple.g +
                ',' + tuple.b +
                ',' + 1 + ')';
            context.fillRect(i, j, 1, 1);
        }
    }
}
function drawStimuliColormapControlPoints(arr, div) {
    for (let i = 0; i < arr.length; i++) {
        div.append("span").style("width", "20px")
            .style("display", "inline-block").style("margin-left", "10px")
            .style("height", "20px")
            .style("background-color", d3.rgb(d3.lab(d3.hcl(arr[i][0], arr[i][1], arr[i][2]))))
    }
}

function drawStimuliCurve(colormap, div, id, axisName) {
    let x = 0, y = 1
    let data = []
    for (let i = 0; i < colormap.length; i++) {
        data.push([i, colormap[i][id]])
    }

    var svg_width = 400, svg_height = 200, margin = 30
    let linechart_svg = div.append("svg").attr("id", "renderSvg").attr("typeId", "line")
        .attr("width", svg_width).attr("height", svg_height).style("display", "inline-block");

    let linechart = linechart_svg.style("background-color", "#FFF")
        .append("g")
        .attr("transform", "translate(" + margin + "," + margin + ")");

    let m_xScale = d3.scaleLinear().range([0, svg_width - margin * 2]), // value -> display
        m_yScale = d3.scaleLinear().range([svg_height - margin * 2, 0]); // value -> display
    // Scale the range of the data
    m_xScale.domain([0, data.length - 1]);
    if (id == 0)
        m_yScale.domain([0, 360]);
    else if (id == 1)
        m_yScale.domain([0, 100])
    else if (id == 2)
        m_yScale.domain([0, 100])
    // define the line
    let valueline = d3.line()
        .x(function (d) {
            return m_xScale(d[x]);
        })
        .y(function (d) {
            return m_yScale(d[y]);
        })//.curve(d3.curveCatmullRom);

    // Add the valueline path.
    linechart.selectAll('path')
        .data([data]).enter().append("path")
        .attr("d", function (d) {
            return valueline(d);
        })
        .attr("class", "linechart")
        .attr("fill", "none")
        // .attr("stroke", "#444")
        .attr("stroke", function () {
            if (y === 1) {
                return "#c30d23"
            }
            return "#036eb8"
        })
        .style("stroke-width", 1)

    // Add the X Axis
    linechart.append("g")
        .attr("transform", "translate(0," + (svg_height - margin * 2) + ")")
        .call(d3.axisBottom(m_xScale)); //.tickFormat("")

    // Add the Y Axis
    linechart.append("g")
        .call(d3.axisLeft(m_yScale)); //.tickFormat("")

    linechart_svg.append("text").attr("x", 0).attr("y", 20).text(axisName);
}

function drawStimuliLineups(lineup_datas, lineup_datas_extent, colormap, div, id) {
    
    function getColor(x) {
        let idx = Math.floor(x / (lineup_datas_extent[1] - lineup_datas_extent[0]) * (colormap.length - 1))
        let color = d3.rgb(d3.lab(d3.hcl(colormap[idx][0], colormap[idx][1], colormap[idx][2])))
        return [color.r, color.g, color.b, 1]
    }

    function drawStimuliLineup(data, i) {
        let canvas_id = id + "-lineup-" + i
        div.append("canvas").attr("id", canvas_id)
            .attr("width", data[0].length).attr("height", data.length).style("margin-left", "20px")
        //get context 
        var canvas = document.getElementById(canvas_id)
        var context = canvas.getContext('2d');

        //traverse the image data
        for (let i = 0; i < canvas.height; i++) {
            for (let j = 0; j < canvas.width; j++) {
                let tuple
                let scalar_value = data[i][j]
                if (scalar_value === 'NaN') {
                    tuple = [0, 0, 0, 1]
                } else {
                    tuple = getColor(+scalar_value)
                }
                context.fillStyle = 'rgba(' + tuple[0] +
                    ',' + tuple[1] +
                    ',' + tuple[2] +
                    ',' + tuple[3] + ')';
                context.fillRect(j, i, 1, 1);
            }
        }
    }

    for (let i = 0; i < lineup_datas.length; i++) {
        drawStimuliLineup(lineup_datas[i], i)
    }
}