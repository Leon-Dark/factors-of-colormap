var scalarField = null;
var binaryFiles = {};

var scaleFactor = 1;
var cropW = null;
var cropH = null;

function getScalarField() {
	return scalarField;
}

		// ===============================================
		// File loading
		// ================================================
		function loadFiles(_scaleFactor, _cropW, _cropH) 
		{
			scaleFactor = _scaleFactor;
			cropW = _cropW;
			cropH = _cropH;

			//var preview = document.querySelector('#preview');
			var files   = document.querySelector('input[type=file]').files;

			function readAndPreview(file) 
			{
				// Make sure `file.name` matches our extensions criteria
				if ( /\.(jpe?g|png|gif|tif|tiff)$/i.test(file.name) ) 
				{
					var reader = new FileReader();

					// attach event listener listener
					reader.addEventListener("load", function () 
					{
						var image = new Image();
						image.onload = function() {
							var internalCanvas = document.createElement('canvas');
							internalCanvas.width = image.width;
							internalCanvas.height = image.height;
							var context = internalCanvas.getContext('2d');
							context.drawImage(image, 0, 0);

							// get image data
							var imgData = context.getImageData(0, 0, image.width, image.height);
							scalarField = scalarFromImageData(imgData);
							scalarField.normalize();
							newScalarField(scalarField);
						}
						image.title = file.name;
						image.src = this.result;
					}, false);
					
					// read the file
					reader.readAsDataURL(file);
				}
				else if ( /\.(hdr)$/i.test(file.name) )
				{
					// see if we have the file name
					var filename = removeExtension(file.name);
					var fileRecord = binaryFiles[filename];
					if (fileRecord === undefined || fileRecord === null) 
					{
						fileRecord = {
							filename: filename,
							headerFile: file.name
						};
						binaryFiles[filename] = fileRecord;
					}

					// parse the header
					(function(file, fileRecord) 
					{
						parseHDR(file, function(header) 
						{
							fileRecord.header = header;
							if (fileRecord.dataview) 
							{
								readGridFloat(fileRecord);
							}
						});
					})(file, fileRecord);
				}
				else if ( /\.(flt|dat)$/i.test(file.name) )
				{
					//var canvas = d3.select('#canvas').node();
					var canvas = d3.select("#mainCanvas").node();
					var reader = new FileReader();
					reader.onload = function(event) 
					{
						var result = event.target.result;
						console.log("Binary file length: " + result.byteLength);

						// create a data view
						var floatview = new Float32Array(result);
						var dataview = new DataView(result);

						// see if we have a header/file record for this file
						var filename = removeExtension(file.name)
						var fileRecord = binaryFiles[ filename ];
						if (!fileRecord) {
							fileRecord = {
								filename: filename,
								dataview: dataview,
								floatview: floatview
							};
							binaryFiles[ filename ] = fileRecord;
							
							
							if (result.byteLength == 4 * canvas.width * canvas.height) 
							{
								console.log("matches canvas dimensions");
								// create header on the assumption that the file matches the dimensions
								// of our canvas
								fileRecord.header = {
									byteorder: 'LSBFIRST',
									ncols: canvas.width,
									nrows: canvas.height
								};
								readGridFloat(fileRecord);
								binaryFiles[ filename ] = undefined;	
							}
							
						}
						else
						{
							fileRecord.dataview = dataview;
							if (fileRecord.header) {
								readGridFloat(fileRecord);
								binaryFiles[ filename ] = undefined;
							}
						}
					}
					reader.readAsArrayBuffer(file);
				}
			}

			if (files) {
				[].forEach.call(files, readAndPreview);
			}
		}

		function parseHDR(file, callback)
		{
			var reader = new FileReader();
			reader.onload = function(event) 
			{
				var result = event.target.result;

				// parse lines
				var lines = result.split('\n');
				var header = {};

				for (var i=0; i<lines.length; i++) {
					var meta = lines[i].match(/\S+/g);
					if (meta !== null) {
						header[ meta[0] ] = isNaN(meta[1]) ? meta[1] : Number(meta[1]);
					}
				}

				callback(header);
			}
			reader.readAsText(file);
		}

		function readGridFloat(fileRecord) 
		{
			console.log("read grid float: " + fileRecord.header.ncols + " x " + fileRecord.header.nrows );
			var w = fileRecord.header.ncols;
			var h = fileRecord.header.nrows;

			// make sure width and height are a multiple of two (for FFT to work properly)
			scalarField = new ScalarField(w, h);

			var input = fileRecord.dataview;
			var finput = fileRecord.floatview;
			var output = scalarField.view;
			var endianness = fileRecord.header.byteorder === 'LSBFIRST' ? true : false;

			for (var i=0, r=0, rOffset = 0; r<h; r++, rOffset += w) 
			{
				for (var c=0; c<w; c++, i++) {
					output[i] = 
						//finput[ rOffset+c ];	// <--- this should work is we're in little endian (LSBFIRST)
						input.getFloat32(4*(rOffset + c), endianness);
				}
			}

			// scale
			//scaleFactor = 0.5;
			
			if (scaleFactor != 1) 
			{
				var scaledW = Math.floor(.5 + scaleFactor * w );
				var scaledH = Math.floor(.5 + scaleFactor * h );

				console.log("scalling from " + w + "x" + h + " to " + scaledW + "x" + scaledH);
				scalarField.scale(scaledW, scaledH);
			}
			

			if ((cropW && cropW < w) || (cropH && cropH < h)) {
				var cW = cropW ? Math.min(cropW, scalarField.w) : scalarField.w;
				var cH = cropH ? Math.min(cropH, scalarField.h) : scalarField.h;
				scalarField.crop(0, 0, cW, cH);
			}

			// normalize the scalar field
			scalarField.normalize();

			// clear temporary data to reclaim memory
			binaryFiles[fileRecord.filename] = undefined;
			
			newScalarField(scalarField);

		}

		function removeExtension(filename) 
		{
			var lastDotPosition = filename.lastIndexOf(".");
			if (lastDotPosition === -1) return filename;
			else return filename.substr(0, lastDotPosition);
		}