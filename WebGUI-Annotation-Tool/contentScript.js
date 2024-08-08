console.log("contentScriptLoaded");

chrome.runtime.sendMessage({
    method: "contentScriptLoaded",
    params: {
        url: location.href,
        hostname: location.hostname
    }
}, function (response) {
    // blank
    return;
});