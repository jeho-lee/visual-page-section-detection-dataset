
"use strict";

let panels = null;
let cur_bndbox = null;
let screenshot = null;
let imageDataURL = null;
let activeTabId = null;
let isNowLabeling = false;

/**
 * @Interface_to_Popup
 */
let portToPopup = null;

chrome.runtime.onConnect.addListener(function (port) {
    portToPopup = port;
    // console.log("port to popup opened!");

    portToPopup.onMessage.addListener(function (msg) {

    });

    portToPopup.onDisconnect.addListener(function () {
        // console.log("port to popup closed!");

        portToPopup = null;
    });
});

function getSessionState() {
    // return current state of DUI session to popup script

    return {
        isNowLabeling: isNowLabeling,
        imageDataURL: imageDataURL,
        panels: panels,
        cur_bndbox: cur_bndbox,
        screenshot: screenshot
    }
}

function startAnnotation(tabId, dataURL) {
    activeTabId = tabId;
    console.log("ActiveTabId is now ", activeTabId);

    // init
    cur_bndbox = null;
    panels = null;
    screenshot = null;
    imageDataURL = dataURL;
    isNowLabeling = true;
}

function labelPopupClosed(type) {
    if (type) {
        console.log("selected type:" + type);

        chrome.tabs.executeScript(activeTabId, {
            code: `setCurrentLabeling("${type}")`,
            runAt: "document_end"
        });
    } else {
        chrome.tabs.executeScript(activeTabId, {
            code: "discardCurrentLabeling()",
            runAt: "document_end"
        });
    }
}

function setCurrentBndbox(params) {
    let bndbox = params.cur_bndbox;
    cur_bndbox = bndbox;
}

function bndboxUpdated(xmin, xmax, ymin, ymax) {
    chrome.tabs.executeScript(activeTabId, {
        code: `setCurrentBndbox(${xmin}, ${xmax}, ${ymin}, ${ymax})`,
        runAt: "document_end"
    });
}

function redrawCurBndbox() {
    chrome.tabs.create({
        url: chrome.extension.getURL('box_labeling_tab.html')
        // url: url
    }, function (tab) {

    });
}

let hostname = null;

function screenAnnotationCompleted(params) { 
    let _panels = params.panels;
    let _screenshot = params.screenshot;
    console.log("annotation over", params);
    
    let filename = hostname + "_" + generateFileName();
    // let filename = generateFileName();

    // Store screenshot image file
    download(_screenshot.dataURL, filename + ".jpg");

    // Store annotation xml file
    let xmlDoc = createAnnotationXMLfile(_panels, _screenshot.width, _screenshot.height, filename + ".jpg");
    var serializer = new XMLSerializer();
    var xmlString = serializer.serializeToString(xmlDoc);
    console.log(xmlString);
    let blob = new Blob([xmlString], {type: 'text/plain'});
    download(blob, filename + ".xml");

    isNowLabeling = false;

    // To show annotated data on popup window
    screenshot = _screenshot;
    panels = _panels;

    // inform to popup
    if (portToPopup) {
        portToPopup.postMessage({ method: "screenDataCreated" });
    }
}

function createAnnotationXMLfile(panels, w, h, fname) {
    let doc = document.implementation.createDocument(null, null);
    let annotation = doc.createElement("annotation");

    let folder = doc.createElement("folder");
    folder.textContent = "Unknown";
    let filename = doc.createElement("filename");
    filename.textContent = fname;
    let path = doc.createElement("path");
    path.textContent = "Unknown";
    let source = doc.createElement("source");
    let database = doc.createElement("database");
    database.textContent = "Unknown";
    source.appendChild(database);

    let size = doc.createElement("size");
    let width = doc.createElement("width");
    width.textContent = `${w}`;
    let height = doc.createElement("height");
    height.textContent = `${h}`;
    let depth = doc.createElement("depth");
    depth.textContent = "3";
    size.appendChild(width);
    size.appendChild(height);
    size.appendChild(depth);
    let segmented = doc.createElement("segmented");
    segmented.textContent = "0";

    annotation.appendChild(folder);
    annotation.appendChild(filename);
    annotation.appendChild(path);
    annotation.appendChild(source);
    annotation.appendChild(size);
    annotation.appendChild(segmented);

    panels.forEach(function (panel) {
        let object = doc.createElement("object");
        let name = doc.createElement("name");
        let pose = doc.createElement("pose");
        let truncated = doc.createElement("truncated");
        let difficult = doc.createElement("difficult");
        let bndbox = doc.createElement("bndbox");
        let xmin = doc.createElement("xmin");
        let ymin = doc.createElement("ymin");
        let xmax = doc.createElement("xmax");
        let ymax = doc.createElement("ymax");
        name.textContent = panel.type;
        pose.textContent = "Unspecified";
        truncated.textContent = panel.truncated;
        difficult.textContent = "0";
        xmin.textContent = panel.xmin;
        ymin.textContent = panel.ymin;
        xmax.textContent = panel.xmax;
        ymax.textContent = panel.ymax;
        bndbox.appendChild(xmin);
        bndbox.appendChild(ymin);
        bndbox.appendChild(xmax);
        bndbox.appendChild(ymax);

        object.appendChild(name);
        object.appendChild(pose);
        object.appendChild(truncated);
        object.appendChild(difficult);
        object.appendChild(bndbox);

        annotation.appendChild(object);
    });

    doc.appendChild(annotation);

    return doc;
}

chrome.runtime.onMessage.addListener(
    function (request, sender, sendResponse) {
        if (request.method === "screenAnnotationCompleted") {
            screenAnnotationCompleted(request.params);
        } else if (request.method === "contentScriptLoaded") {
            // init
            panels = null;
            screenshot = null;
            activeTabId = null;
            isNowLabeling = false;

            hostname = request.params.hostname.replace('www.','');;
            console.log(hostname);
            
        } else if (request.method === "setCurrentBndbox") {
            setCurrentBndbox(request.params);
        }

        return true;
    }
);

function generateFileName() {
    function s4() {
        return ((1 + Math.random()) * 0x10000 | 0).toString(16).substring(1);
    }
    return s4() + "_" + s4();
}


//download.js v4.21, by dandavis; 2008-2018. [MIT] see http://danml.com/download.html for tests/usage
// v1 landed a FF+Chrome compatible way of downloading strings to local un-named files, upgraded to use a hidden frame and optional mime
// v2 added named files via a[download], msSaveBlob, IE (10+) support, and window.URL support for larger+faster saves than dataURLs
// v3 added dataURL and Blob Input, bind-toggle arity, and legacy dataURL fallback was improved with force-download mime and base64 support. 3.1 improved safari handling.
// v4 adds AMD/UMD, commonJS, and plain browser support
// v4.1 adds url download capability via solo URL argument (same domain/CORS only)
// v4.2 adds semantic variable names, long (over 2MB) dataURL support, and hidden by default temp anchors
// https://github.com/rndme/download
function download(data, strFileName, strMimeType) {

    var self = window, // this script is only for browsers anyway...
        defaultMime = "application/octet-stream", // this default mime also triggers iframe downloads
        mimeType = strMimeType || defaultMime,
        payload = data,
        url = !strFileName && !strMimeType && payload,
        anchor = document.createElement("a"),
        toString = function (a) { return String(a); },
        myBlob = (self.Blob || self.MozBlob || self.WebKitBlob || toString),
        fileName = strFileName || "download",
        blob,
        reader;
    myBlob = myBlob.call ? myBlob.bind(self) : Blob;

    if (String(this) === "true") { //reverse arguments, allowing download.bind(true, "text/xml", "export.xml") to act as a callback
        payload = [payload, mimeType];
        mimeType = payload[0];
        payload = payload[1];
    }


    if (url && url.length < 2048) { // if no filename and no mime, assume a url was passed as the only argument
        fileName = url.split("/").pop().split("?")[0];
        anchor.href = url; // assign href prop to temp anchor
        if (anchor.href.indexOf(url) !== -1) { // if the browser determines that it's a potentially valid url path:
            var ajax = new XMLHttpRequest();
            ajax.open("GET", url, true);
            ajax.responseType = 'blob';
            ajax.onload = function (e) {
                download(e.target.response, fileName, defaultMime);
            };
            setTimeout(function () { ajax.send(); }, 0); // allows setting custom ajax headers using the return:
            return ajax;
        } // end if valid url?
    } // end if url?


    //go ahead and download dataURLs right away
    if (/^data:([\w+-]+\/[\w+.-]+)?[,;]/.test(payload)) {

        if (payload.length > (1024 * 1024 * 1.999) && myBlob !== toString) {
            payload = dataUrlToBlob(payload);
            mimeType = payload.type || defaultMime;
        } else {
            return navigator.msSaveBlob ?  // IE10 can't do a[download], only Blobs:
                navigator.msSaveBlob(dataUrlToBlob(payload), fileName) :
                saver(payload); // everyone else can save dataURLs un-processed
        }

    } else {//not data url, is it a string with special needs?
        if (/([\x80-\xff])/.test(payload)) {
            var i = 0, tempUiArr = new Uint8Array(payload.length), mx = tempUiArr.length;
            for (i; i < mx; ++i) tempUiArr[i] = payload.charCodeAt(i);
            payload = new myBlob([tempUiArr], { type: mimeType });
        }
    }
    blob = payload instanceof myBlob ?
        payload :
        new myBlob([payload], { type: mimeType });


    function dataUrlToBlob(strUrl) {
        var parts = strUrl.split(/[:;,]/),
            type = parts[1],
            indexDecoder = strUrl.indexOf("charset") > 0 ? 3 : 2,
            decoder = parts[indexDecoder] == "base64" ? atob : decodeURIComponent,
            binData = decoder(parts.pop()),
            mx = binData.length,
            i = 0,
            uiArr = new Uint8Array(mx);

        for (i; i < mx; ++i) uiArr[i] = binData.charCodeAt(i);

        return new myBlob([uiArr], { type: type });
    }

    function saver(url, winMode) {

        if ('download' in anchor) { //html5 A[download]
            anchor.href = url;
            anchor.setAttribute("download", fileName);
            anchor.className = "download-js-link";
            anchor.innerHTML = "downloading...";
            anchor.style.display = "none";
            anchor.addEventListener('click', function (e) {
                e.stopPropagation();
                // this.removeEventListener('click', arguments.callee);
            });
            document.body.appendChild(anchor);
            setTimeout(function () {
                anchor.click();
                document.body.removeChild(anchor);
                if (winMode === true) { setTimeout(function () { self.URL.revokeObjectURL(anchor.href); }, 250); }
            }, 66);
            return true;
        }

        // handle non-a[download] safari as best we can:
        if (/(Version)\/(\d+)\.(\d+)(?:\.(\d+))?.*Safari\//.test(navigator.userAgent)) {
            if (/^data:/.test(url)) url = "data:" + url.replace(/^data:([\w\/\-\+]+)/, defaultMime);
            if (!window.open(url)) { // popup blocked, offer direct download:
                if (confirm("Displaying New Document\n\nUse Save As... to download, then click back to return to this page.")) { location.href = url; }
            }
            return true;
        }

        //do iframe dataURL download (old ch+FF):
        var f = document.createElement("iframe");
        document.body.appendChild(f);

        if (!winMode && /^data:/.test(url)) { // force a mime that will download:
            url = "data:" + url.replace(/^data:([\w\/\-\+]+)/, defaultMime);
        }
        f.src = url;
        setTimeout(function () { document.body.removeChild(f); }, 333);

    }//end saver




    if (navigator.msSaveBlob) { // IE10+ : (has Blob, but not a[download] or URL)
        return navigator.msSaveBlob(blob, fileName);
    }

    if (self.URL) { // simple fast and modern way using Blob and URL:
        saver(self.URL.createObjectURL(blob), true);
    } else {
        // handle non-Blob()+non-URL browsers:
        if (typeof blob === "string" || blob.constructor === toString) {
            try {
                return saver("data:" + mimeType + ";base64," + self.btoa(blob));
            } catch (y) {
                return saver("data:" + mimeType + "," + encodeURIComponent(blob));
            }
        }

        // Blob but not URL support:
        reader = new FileReader();
        reader.onload = function (e) {
            saver(this.result);
        };
        reader.readAsDataURL(blob);
    }
    return true;
} /* end download() */

