
let backgroundPageView = chrome.extension.getBackgroundPage();

document.addEventListener('DOMContentLoaded', function () {

    let sessionState = backgroundPageView.getSessionState();
    let imageDataURL;

    var xmin = null;
    var xmax = null;
    var ymin = null;
    var ymax = null;

    if (sessionState.imageDataURL) {
        imageDataURL = sessionState.imageDataURL;

        let image = new Image();
        image.addEventListener("load", () => {
            // view_screenshot.append(image);

            // Canvas drawing

            let canvas = document.getElementById("canvas");
            let ctx = canvas.getContext('2d');

            canvas.width = image.width;
            canvas.height = image.height;

            ctx.drawImage(image, 0, 0, image.width, image.height);

            ctx.strokeStyle = "red";
            ctx.lineWidth = 2;

            var canvasOffset = canvas.getBoundingClientRect();
            var offsetX = canvasOffset.left;
            var offsetY = canvasOffset.top;
            var isDown = false;
            var startX;
            var startY;

            document.getElementById('canvas').addEventListener('mousedown', function (e) {
                e.preventDefault();
                e.stopPropagation();

                startX = parseInt(e.clientX - offsetX);
                startY = parseInt(e.clientY - offsetY);

                isDown = true;
            });
            document.getElementById('canvas').addEventListener('mousemove', function (e) {
                e.preventDefault();
                e.stopPropagation();

                if (!isDown) {
                    return;
                }

                mouseX = parseInt(e.clientX - offsetX);
                mouseY = parseInt(e.clientY - offsetY);

                // Put your mousemove stuff here

                ctx.clearRect(0, 0, canvas.width, canvas.height);

                var width = mouseX - startX;
                var height = mouseY - startY;

                ctx.drawImage(image, 0, 0, image.width, image.height);
                ctx.strokeRect(startX, startY, width, height);

                xmin = startX;
                ymin = startY;
                xmax = width;
                ymax = height;
            });
            document.getElementById('canvas').addEventListener('mouseup', function (e) {
                e.preventDefault();
                e.stopPropagation();

                isDown = false;

                // window.close();
            });
            document.getElementById('canvas').addEventListener('mouseout', function (e) {
                e.preventDefault();
                e.stopPropagation();

                // isDown = false;
            });

        });
        image.src = imageDataURL; // will occur load event
    }

    window.addEventListener("beforeunload", function () {
        backgroundPageView.bndboxDrawTabClosed(xmin, xmax, ymin, ymax);
    });

    // let label = null;

    // button_cancel.addEventListener("click", function () {
    //     label = null;
    //     window.close();
    // });

});



