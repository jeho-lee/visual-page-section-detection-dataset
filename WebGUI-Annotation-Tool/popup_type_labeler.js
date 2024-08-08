
let backgroundPageView = chrome.extension.getBackgroundPage();

var xmin = null;
var xmax = null;
var ymin = null;
var ymax = null;

let selector_type, textarea_type, button_ok, button_cancel, button_redraw, redraw_canvas, preview;

function redrawCurBndbox(imageDataURL) {

  let image = new Image();
  image.addEventListener("load", () => {
    // view_screenshot.append(image);

    // Canvas drawing
    let ctx = redraw_canvas.getContext('2d');

    redraw_canvas.width = image.width;
    redraw_canvas.height = image.height;

    ctx.drawImage(image, 0, 0, image.width, image.height);

    ctx.strokeStyle = "red";
    ctx.lineWidth = 2;

    var canvasOffset = redraw_canvas.getBoundingClientRect();
    var offsetX = canvasOffset.left;
    var offsetY = canvasOffset.top;
    var isDown = false;
    var startX, startY, destX, destY;

    document.getElementById('canvas').addEventListener('mousedown', function (e) {
      e.preventDefault();
      e.stopPropagation();

      // startX = parseInt(e.clientX - offsetX);
      // startY = parseInt(e.clientY - offsetY);

      startX = parseInt(e.clientX);
      startY = parseInt(e.clientY);

      isDown = true;
    });
    document.getElementById('canvas').addEventListener('mousemove', function (e) {
      e.preventDefault();
      e.stopPropagation();

      if (!isDown) {
        return;
      }

      ctx.clearRect(0, 0, redraw_canvas.width, redraw_canvas.height);

      // mouseX = parseInt(e.clientX - offsetX);
      // mouseY = parseInt(e.clientY - offsetY);
      destX = parseInt(e.clientX);
      destY = parseInt(e.clientY);

      var width = destX - startX;
      var height = destY - startY;

      ctx.drawImage(image, 0, 0, image.width, image.height);
      ctx.strokeRect(startX, startY, width, height);

      if (startX > destX) {
        xmin = destX;
        xmax = startX;
      } else {
        xmin = startX;
        xmax = destX;
      }

      if (startY > destY) {
        ymin = destY;
        ymax = startY;
      } else {
        ymin = startY;
        ymax = destY;
      }

      // xmin = startX;
      // ymin = startY;
      // xmax = Math.abs(width);
      // ymax = Math.abs(height);

      console.log("strokeRect", xmin, ymin, xmax, ymax);
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

function showPreview(dataURL, cur_box) {
  let image = new Image();
  image.addEventListener("load", () => {
    let context = preview.getContext('2d');

    const canvas_w = 720;
    const canvas_h = 720 * image.height / image.width;
    const screenshot_w = image.width;
    const screenshot_h = image.height;

    preview.width = canvas_w;
    preview.height = canvas_h;
    context.drawImage(image, 0, 0, image.width, image.height, 0, 0, canvas_w, canvas_h);

    context.globalAlpha = 0.4;
    const x = cur_box.xmin * canvas_w / screenshot_w;
    const y = cur_box.ymin * canvas_h / screenshot_h;
    const w = (cur_box.xmax - cur_box.xmin) * canvas_w / screenshot_w;
    const h = (cur_box.ymax - cur_box.ymin) * canvas_h / screenshot_h;
    context.fillStyle = "red";
    context.fillRect(x, y, w, h);
  });
  image.src = dataURL; // will occur load event
}

document.addEventListener('DOMContentLoaded', function () {

  let selector_type_1 = document.getElementById("type-selector-1");
  let selector_type_2 = document.getElementById("type-selector-2");
  let selector_type_3 = document.getElementById("type-selector-3");
  let selector_type_4 = document.getElementById("type-selector-4");

  textarea_type = document.getElementById("type-textarea");
  button_ok = document.getElementById("ok-button");
  button_cancel = document.getElementById("cancel-button");
  button_redraw = document.getElementById("redraw-button");
  redraw_canvas = document.getElementById("canvas");
  preview = document.getElementById("preview");

  let label = null;
  let isBndboxRedrawed = false;

  let sessionState = backgroundPageView.getSessionState();
  let imageDataURL, bndbox;

  if (sessionState.imageDataURL && sessionState.cur_bndbox) {
    imageDataURL = sessionState.imageDataURL;
    bndbox = sessionState.cur_bndbox;
    showPreview(imageDataURL, bndbox);
  }

  selector_type_1.addEventListener("change", function () {textarea_type.textContent = selector_type_1.options[selector_type_1.selectedIndex].text;});
  selector_type_2.addEventListener("change", function () {textarea_type.textContent = selector_type_2.options[selector_type_2.selectedIndex].text;});
  selector_type_3.addEventListener("change", function () {textarea_type.textContent = selector_type_3.options[selector_type_3.selectedIndex].text;});
  selector_type_4.addEventListener("change", function () {textarea_type.textContent = selector_type_4.options[selector_type_4.selectedIndex].text;});

  button_redraw.addEventListener("click", function () {
    // backgroundPageView.redrawCurBndbox();
    isBndboxRedrawed = true;

    preview.setAttribute("style", "display: none");
    redrawCurBndbox(imageDataURL);
  });

  window.addEventListener("beforeunload", function () {
    if (isBndboxRedrawed) {
      backgroundPageView.bndboxUpdated(xmin, xmax, ymin, ymax);
    }
    backgroundPageView.labelPopupClosed(label);
  });

  button_ok.addEventListener("click", function () {
    if (textarea_type.textContent) {
      label = textarea_type.textContent;
    }
    window.close();
  });

  button_cancel.addEventListener("click", function () {
    label = null;
    window.close();
  });

});
