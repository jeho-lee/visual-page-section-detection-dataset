
'use strict';

// console.log(chrome.runtime.id);

let backgroundPageView = chrome.extension.getBackgroundPage();

let view_segment_buttons, view_screenshot;
let button_screenshot, button_clear, button_done;

document.addEventListener('DOMContentLoaded', function () {
    // take screenshot on scroll top of the web page
    // chrome.tabs.executeScript(null, {
    //     code: "window.scrollTo(0, 0);",
    //     runAt: "document_end"
    // });

    button_screenshot = document.getElementById('screen-capture');
    view_screenshot = document.getElementById('screenshot-view');
    button_clear = document.getElementById("clear-annotation");
    button_done = document.getElementById("finish-annotation");

    let sessionState = backgroundPageView.getSessionState();
    popupViewUpdate(sessionState);
});

function popupViewUpdate(sessionState) {
    let isNowLabeling = sessionState.isNowLabeling;
    // let panels = sessionState.panels;
    // let screenshot = sessionState.screenshot;

    if (isNowLabeling) {
        button_clear.addEventListener("click", function () {
            chrome.tabs.executeScript(null, {
                code: "clearSelectedPanels()",
                runAt: "document_end"
            });
        });

        button_done.addEventListener("click", function () {
            chrome.tabs.executeScript(null, {
                code: "finishAnnotation()",
                runAt: "document_end"
            }, function (result) {
                // get UIsegments object
                // let sessionState = backgroundPageView.getSessionState();
                // initUIsegmentsView(sessionState);
            });
        });
    }
    else {
        button_screenshot.addEventListener("click", startScreenAnnotation);
    }
}

function showAnnotationResults(sessionState) {
    let panels = sessionState.panels;
    let screenshot = sessionState.screenshot;

    // let canvas = document.createElement("canvas");
    // let context = canvas.getContext('2d');
    let image = new Image();
    image.addEventListener("load", () => {
        let canvas = document.createElement("canvas");
        let context = canvas.getContext('2d');

        const canvas_w = 600;
        const canvas_h = 600 * image.height / image.width;
        const screenshot_w = image.width;
        const screenshot_h = image.height;

        canvas.width = canvas_w;
        canvas.height = canvas_h;
        context.drawImage(image, 0, 0, image.width, image.height, 0, 0, canvas_w, canvas_h);

        context.globalAlpha = 0.4;
        panels.forEach((panel, index) => {
            const x = panel.xmin * canvas_w / screenshot_w;
            const y = panel.ymin * canvas_h / screenshot_h;
            const w = (panel.xmax - panel.xmin) * canvas_w / screenshot_w;
            const h = (panel.ymax - panel.ymin) * canvas_h / screenshot_h;
            context.fillStyle = panel.color;
            context.fillRect(x, y, w, h);
        });

        view_screenshot.append(canvas);
    });
    image.src = screenshot.dataURL; // will occur load event
}

function startScreenAnnotation() {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        var currTab = tabs[0];
        if (currTab) {
            console.log("Active Tab", currTab, currTab.id, currTab.url);
            // backgroundPageView.startAnnotation(currTab.id);

            chrome.tabs.captureVisibleTab(null, { format: "jpeg", quality: 100 }, function (data) {
                // console.log(data);
                let canvas = document.createElement("canvas");
                let context = canvas.getContext('2d');
                let image = new Image();
                let imageWidth, imageHeight;
                image.addEventListener("load", () => {
                    context.drawImage(image, 0, 0);
                    console.log("image", image.width, image.height);
                    imageWidth = image.width;
                    imageHeight = image.height;
                    image.style.width = '100%';
                    view_screenshot.append(image);

                    // background
                    backgroundPageView.startAnnotation(currTab.id, data);

                    // active tab
                    chrome.tabs.executeScript(null, {
                        file: "select_UI_segments.js",
                        runAt: "document_end",
                    }, function (results) {
                        chrome.tabs.executeScript(null, {
                            code: `setScreenshot("${data}", ${imageWidth}, ${imageHeight})`,
                            runAt: "document_end"
                        });
                    });
                });
                image.src = data; // will occur load event
            });
        }
    });
}

/**
 * @Interface to p2p-data (background)
 */
let portToBackground = chrome.runtime.connect({
    name: "channelToBackground"
});

portToBackground.onMessage.addListener(function (msg) {
    if (msg.method === "screenDataCreated") {
        let sessionState = backgroundPageView.getSessionState();
        showAnnotationResults(sessionState);
    }
});