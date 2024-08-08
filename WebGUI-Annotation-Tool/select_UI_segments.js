
let focusedElement = null;

let cur_bndbox = {};
let cur_panel = null;

var prevStyleOfSelectedElement;
var currentColor;
var panels = [];
let screenshotDataURL = null;
let imageWidth = null;
let imageHeight = null;

let canvas = document.createElement("canvas");
let context = canvas.getContext('2d');

function getRandomColor() {
    var letters = '0123456789ABCDEF';
    var color = '#';
    for (var i = 0; i < 4; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color + 'EE';
}

function highlightNode_css(elem) {
    prevStyleOfSelectedElement = elem.getAttribute('style');
    if (prevStyleOfSelectedElement) {
        elem.setAttribute('style', prevStyleOfSelectedElement + `background-color: ${currentColor};`);
    } else {
        elem.setAttribute('style', `background-color: ${currentColor};`);
    }
}

function hideHighlight_css(elem) {
    if (prevStyleOfSelectedElement) {
        elem.setAttribute('style', prevStyleOfSelectedElement);
    } else {
        elem.removeAttribute('style');
    }
}

var targetBranch = [];
var index;
var branchLength;
var mousedowned = false;

function mouseoverHandler(event) {
    event.preventDefault();
    event.stopPropagation();
    if (event.target === document.body ||
        (focusedElement && focusedElement === event.target)) {
        return;
    }
    if (focusedElement) {
        hideHighlight_css(focusedElement);
        focusedElement = undefined;
    }
    if (event.target) {
        focusedElement = event.target;
        highlightNode_css(focusedElement);
    }
}

function mousedownHandler(e) {
    e.preventDefault();
    e.stopPropagation();

    if (!focusedElement) return;
    document.body.removeEventListener("mouseover", mouseoverHandler);

    mousedowned = true;
    var tmpElem = e.target.lastChild;
    var cur = 0;
    while (tmpElem != document.body) {
        if (tmpElem.nodeType == Node.ELEMENT_NODE) {
            targetBranch.push(tmpElem);
            if (tmpElem === e.target) index = cur;
            cur++;
            if (tmpElem.parentElement) tmpElem = tmpElem.parentElement;
        } else {
            if (tmpElem.parentElement) tmpElem = tmpElem.parentElement;
        }
    }
    branchLength = targetBranch.length;

    document.body.addEventListener('wheel', wheelHandler, { passive: false });
}

function wheelHandler(e) {
    e.preventDefault();
    if (e.deltaY > 0) { //move down
        if (index == 0) return;
        if (focusedElement) {
            hideHighlight_css(focusedElement);
        }
        focusedElement = targetBranch[--index];
        highlightNode_css(focusedElement);
    } else if (e.deltaY < 0) { //move up
        if (index == (branchLength - 1)) return;
        if (focusedElement) {
            hideHighlight_css(focusedElement);
        }
        focusedElement = targetBranch[++index];
        highlightNode_css(focusedElement);
    }
}

function mouseupHandler(e) {
    if (!mousedowned) return;
    e.preventDefault();
    e.stopPropagation();

    cur_panel = focusedElement;

    const boundRect = cur_panel.getBoundingClientRect();
    let xmin = boundRect.x;
    let xmax = boundRect.x + boundRect.width > imageWidth ? imageWidth : (boundRect.x + boundRect.width);
    let ymin = boundRect.y;
    let ymax = boundRect.y + boundRect.height > imageHeight ? imageHeight : (boundRect.y + boundRect.height);

    setCurrentBndbox(xmin, xmax, ymin, ymax);

    mousedowned = false;
    targetBranch = [];
    focusedElement = null;
    document.body.removeEventListener("wheel", wheelHandler);

    currentColor = getRandomColor();
    document.body.addEventListener("mouseover", mouseoverHandler);

    // Open popup window for labeling
    let url_ = "chrome-extension://" + chrome.runtime.id + "/popup_type_labeler.html";
    // window.open(url_, '_blank', 'toolbar=0,location=0,menubar=0,height=500,width=360');
    
    window.open(url_);

}

function setCurrentBndbox(xmin, xmax, ymin, ymax) {
    if (cur_panel) {
        cur_bndbox.xmin = Math.floor(xmin);
        cur_bndbox.xmax = Math.floor(xmax);
        cur_bndbox.ymin = Math.floor(ymin);
        cur_bndbox.ymax = Math.floor(ymax);
    }

    chrome.runtime.sendMessage({
        method: "setCurrentBndbox",
        params: { cur_bndbox: cur_bndbox}
    }, function (response) {});

    console.log("current bndbox: ", cur_bndbox);
}

function setCurrentLabeling(elementType) {
    if (cur_panel) {

        const panel = {
            element: cur_panel,
            type: elementType,
            xmin: cur_bndbox.xmin,
            xmax: cur_bndbox.xmax,
            ymin: cur_bndbox.ymin,
            ymax: cur_bndbox.ymax,
            truncated: "0",
            prevStyle: prevStyleOfSelectedElement,
            color: currentColor
        }
        panels.push(panel);
        console.log(panels);

        cur_panel = null;
        cur_bndbox = {};
    }
}

function discardCurrentLabeling() {
    if (cur_panel) {
        hideHighlight_css(cur_panel);
    }

    cur_panel = null;
}

function generateUUID() {
    function s4() {
        return ((1 + Math.random()) * 0x10000 | 0).toString(16).substring(1);
    }
    return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
}

function clearColoredView() {
    if (focusedElement) {
        hideHighlight_css(focusedElement);
    }
    panels.forEach(function (panel) {
        if (panel.prevStyle) {
            panel.element.setAttribute('style', panel.prevStyle);
        } else {
            panel.element.removeAttribute('style');
        }
    });
}

function setScreenshot(dataURL, w, h) {
    console.log("screenshot", dataURL, w, h);
    screenshotDataURL = dataURL;
    imageWidth = w;
    imageHeight = h;
}

function startUIselection() {
    currentColor = getRandomColor();
    document.body.addEventListener("mouseover", mouseoverHandler);
    document.body.addEventListener("mousedown", mousedownHandler);
    document.body.addEventListener("mouseup", mouseupHandler);
}

function clearSelectedPanels() {
    if (panels) {
        console.log("clearSelectedPanels");
        clearColoredView();
        panels = [];
    }

    screenshotDataURL = null;
    imageWidth = null;
    imageHeight = null;
}

function finishAnnotation() {
    if (panels) {
        console.log("finish Annotation");
        if (focusedElement) {
            hideHighlight_css(focusedElement);
        }

        clearColoredView();
        document.body.removeEventListener("mouseover", mouseoverHandler);
        document.body.removeEventListener("mousedown", mousedownHandler);
        document.body.removeEventListener("mouseup", mouseupHandler);
        document.body.removeEventListener("wheel", wheelHandler);

        let screenshot = {
            dataURL: screenshotDataURL,
            width: imageWidth,
            height: imageHeight
        }

        chrome.runtime.sendMessage({
            method: "screenAnnotationCompleted",
            params: { panels: panels, screenshot: screenshot }
        }, function (response) {

        });

        panels = [];
    }

    screenshotDataURL = null;
}

console.log("startUIselection");
startUIselection();