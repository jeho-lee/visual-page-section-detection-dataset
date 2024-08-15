let backgroundPageView = chrome.extension.getBackgroundPage();

let imageview;

function renderParseResults(dataURL, detections) {
	let image = new Image();

	image.addEventListener("load", () => {
		let ctx = imageview.getContext('2d');

		const screenshot_w = image.width;
		const screenshot_h = image.height;

		imageview.width = screenshot_w;
		imageview.height = screenshot_h;

		ctx.drawImage(image, 0, 0, screenshot_w, screenshot_h);

		// draw bounding boxes with predicted element class
		detections.forEach((detection, index) => { // each item has attr - name, score, color, xmin, xmax, ymin, ymax

			// Draw predicted bounding box
			ctx.beginPath();
			ctx.lineWidth = 8;
			ctx.globalAlpha = 1;

			ctx.strokeStyle = detection.color;
			ctx.rect(detection.xmin, detection.ymin, detection.xmax - detection.xmin, detection.ymax - detection.ymin); // x, y, width, height
			ctx.stroke();

			// Draw predicted GUI segment original rect
			// ctx.fillStyle = detection.color;
			// ctx.globalAlpha = 0.8;
			// ctx.fillRect(detection.xmin, detection.ymin, 70, 20);

			// ctx.fillStyle = 'black';
			// ctx.font = '10px Arial';
			// // ctx.fillText(detection.name + ' - ' + Math.round(detection.score * 100) / 100, detection.xmin + 3, detection.ymin + 10);
			// ctx.fillText(detection.name, detection.xmin + 3, detection.ymin + 10);			
		});
	});
	
	image.src = dataURL; // will occur load event
}

document.addEventListener('DOMContentLoaded', function () {

	imageview = document.getElementById("imageview");

	let sessionState = backgroundPageView.getSessionState();
	console.log(sessionState);
	let imageDataURL, detections;

	if (sessionState.imageDataURL && sessionState.GUI_segments) {
		imageDataURL = sessionState.imageDataURL;
		detections = sessionState.original_detections;
		renderParseResults(imageDataURL, detections);
	}

});
