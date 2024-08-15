let backgroundPageView = chrome.extension.getBackgroundPage();

let imageview;

//      detection: {
//          name: String
//          color: String
//          score: Float
//          xmin: Float
//          xmax: Float
//          ymin: Float
//          ymax: Float
//      }
//      matched: {
//          node
//          nodeXpath
//          nodeRect
//      }
//      navContainer = {
//          node
//          nodeXpath
//          items: {
//              ~
//          }
//      }
//      searchInput = {
//          node:
//          nodeXpath:
//          nodeRect:
//      }
//
//      label

function renderParseResults(dataURL, segments) {
	let image = new Image();

	image.addEventListener("load", () => {
		let ctx = imageview.getContext('2d');

		const screenshot_w = image.width;
		const screenshot_h = image.height;

		imageview.width = screenshot_w;
		imageview.height = screenshot_h;

		ctx.drawImage(image, 0, 0, screenshot_w, screenshot_h);

		// draw bounding boxes with predicted element class
		segments.forEach((segment, index) => { // each item has attr - name, score, color, xmin, xmax, ymin, ymax
			const cur_dets_color = segment.detection.color;
			const cur_dets_name = segment.detection.name;
			const cur_dets_score = segment.detection.score;
			const pred = segment.detection;
			const label = segment.label;

			// domRect corresponding to mapped DOM node
			const domRect = segment.matched.nodeRect;

			// Draw predicted bounding box
			ctx.beginPath();
			ctx.lineWidth = 8;
			ctx.globalAlpha = 1;

			// Draw predicted GUI segment original rect
			// ctx.fillStyle = pred.color;
			// ctx.fillRect(pred.xmin, pred.ymin, 140, 23);

			// ctx.fillStyle = 'black';
			// ctx.font = '16px Arial';
			// ctx.fillText(pred.name + ' - ' + Math.round(pred.score * 100) / 100, pred.xmin + 5, pred.ymin + 17);

			// ctx.strokeStyle = pred.color;
			// ctx.rect(pred.xmin, pred.ymin, pred.xmax - pred.xmin, pred.ymax - pred.ymin); // x, y, width, height
			// ctx.stroke();
			

			// Draw matched DOM element's rect
			ctx.strokeStyle = cur_dets_color;
			ctx.rect(domRect.xmin, domRect.ymin, domRect.xmax - domRect.xmin, domRect.ymax - domRect.ymin); // x, y, width, height
			ctx.stroke();

			// ctx.fillStyle = cur_dets_color;
			// ctx.fillRect(domRect.xmin, domRect.ymin, domRect.xmax - domRect.xmin, domRect.ymax - domRect.ymin); // x, y, width, height

			// GUI segment type text
			ctx.fillStyle = 'black';
			ctx.fillRect(domRect.xmin, domRect.ymin, 160, 30);

			ctx.fillStyle = 'white';
			ctx.font = '15px Arial';
			ctx.fillText(pred.name + ' - ' + Math.round(pred.score * 100) + '%', domRect.xmin + 5, domRect.ymin + 20);

			
			if (segment.navCollection) {

				if (segment.navCollection.is_nested) {
					const collectionTree = segment.navCollection.collectionTree;
					const collections = collectionTree[collectionTree.length - 1];

					for (const collection of collections) {
						const curCollectionNodeRect = collection.nodeRect;

						// collection nodeRect
						ctx.beginPath();
						ctx.globalAlpha = 1;
						const strokeLineWidth = 5;
						ctx.lineWidth = strokeLineWidth;

						ctx.strokeStyle = "red";
						ctx.rect(curCollectionNodeRect.xmin + strokeLineWidth, curCollectionNodeRect.ymin,
							curCollectionNodeRect.xmax - curCollectionNodeRect.xmin - strokeLineWidth * 2,
							curCollectionNodeRect.ymax - curCollectionNodeRect.ymin); // x, y, width, height
						ctx.stroke();

						// nav items
						for (const navItem of collection.navItems) {
							const navItemRect = navItem.item.nodeRect;
							ctx.globalAlpha = 0.15;
							ctx.fillStyle = "blue";
							ctx.fillRect(navItemRect.xmin, navItemRect.ymin, navItemRect.xmax - navItemRect.xmin, navItemRect.ymax - navItemRect.ymin);
						}
					}
				}
				else {
					const collection = segment.navCollection.collectionTree[0][0];
					console.log("cur collection", collection);
					// nav items
					for (const navItem of collection.navItems) {
						const navItemRect = navItem.item.nodeRect;
						ctx.globalAlpha = 0.15;
						ctx.fillStyle = "blue";
						ctx.fillRect(navItemRect.xmin, navItemRect.ymin, navItemRect.xmax - navItemRect.xmin, navItemRect.ymax - navItemRect.ymin);
					}
				}
			}

			if (segment.basicCollection) {
				// basic collection items
				for (const item of segment.basicCollection.items) {
					const itemRect = item.nodeRect;
					ctx.globalAlpha = 0.15;
					ctx.fillStyle = "blue";
					ctx.fillRect(itemRect.xmin, itemRect.ymin, itemRect.xmax - itemRect.xmin, itemRect.ymax - itemRect.ymin);
				}
			}

			if (segment.navContainer && segment.navContainer.children) {
				segment.navContainer.children.forEach((child_obj, index) => {
					const itemRect = child_obj.item.nodeRect;

					// nodeRect
					ctx.beginPath();
					ctx.globalAlpha = 1;
					const strokeLineWidth = 5;
					ctx.lineWidth = strokeLineWidth;

					// ctx.strokeStyle = "black";
					// ctx.lineWidth = 1.5;
					// ctx.rect(itemRect.xmin, itemRect.ymin, itemRect.xmax - itemRect.xmin, itemRect.ymax - itemRect.ymin); // x, y, width, height
					// ctx.stroke();

					// ctx.fillStyle = "red";
					// ctx.fillRect(itemRect.xmin, itemRect.ymin, itemRect.xmax - itemRect.xmin, itemRect.ymax - itemRect.ymin); // x, y, width, height

					ctx.strokeStyle = "red";
					ctx.rect(itemRect.xmin + strokeLineWidth, itemRect.ymin,
						itemRect.xmax - itemRect.xmin - strokeLineWidth * 2, itemRect.ymax - itemRect.ymin); // x, y, width, height
					ctx.stroke();

					// numbering
					ctx.fillStyle = cur_dets_color;
					ctx.fillRect(itemRect.xmax, itemRect.ymin, -20, 20);
					ctx.fillStyle = 'black';
					ctx.font = '15px Arial';
					ctx.fillText(index + 1, itemRect.xmax - 15, itemRect.ymin + 15);

					// linkRect
					if (child_obj.link != undefined) {
						const linkRect = child_obj.link.nodeRect;
						ctx.globalAlpha = 0.15;
						ctx.fillStyle = "blue";
						ctx.fillRect(linkRect.xmin, linkRect.ymin, linkRect.xmax - linkRect.xmin, linkRect.ymax - linkRect.ymin); // x, y, width, height
					} else {

					}

				});
			}
			

			// Text for GUI segment type
			
			// ctx.globalAlpha = 1;
			// ctx.fillStyle = 'black';
			// ctx.fillRect(domRect.xmin, domRect.ymin, 200, 30);

			// ctx.fillStyle = 'white';
			// ctx.font = '15px Arial';

			// let name_string = cur_dets_name;
			// if (label) name_string = name_string + ` (${label})`;
			// ctx.fillText(name_string + ' - ' + Math.round(cur_dets_score * 100) + '%', domRect.xmin + 5, domRect.ymin + 20);
			
		});
	});
	
	image.src = dataURL; // will occur load event
}

document.addEventListener('DOMContentLoaded', function () {

	imageview = document.getElementById("imageview");

	let sessionState = backgroundPageView.getSessionState();
	console.log(sessionState);
	let imageDataURL, segments;

	if (sessionState.imageDataURL && sessionState.GUI_segments) {
		imageDataURL = sessionState.imageDataURL;
		segments = sessionState.GUI_segments;
		renderParseResults(imageDataURL, segments);
	}

});
