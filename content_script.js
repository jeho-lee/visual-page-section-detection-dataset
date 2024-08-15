'use strict';

let globalDOMLoadedTime = 0;
let globalOnRenderTime = 0;
let globalOnLoadTime = 0;
let globalOnModelExtractedTime = 0;

let globalDetectionStartTime = 0;
let globalDetectionEndTime = 0;

/**
 * @UTILITIES
 */
function getRandomColor() {
    let letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 4; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color + 'EE';
}

/**
 * @function getXpathOfElement
 * @param {HTMLElement} elt
 * https://dzone.com/articles/get-xpath-string-expression
 */
function getXpathOfElement(elt) {
    let xpath = "";
    for (; elt && elt.nodeType == 1; elt = elt.parentNode) {
        let count = 1;
        for (let sib = elt.previousSibling; sib; sib = sib.previousSibling) {
            if (sib.nodeType == 1 && sib.tagName == elt.tagName) count++;
        }
        let xname = elt.tagName;
        if (count > 1) xname += "[" + count + "]";
        xpath = "/" + xname + xpath;
    }

    return xpath;
}

function getElementByXpath(path) {
    return document.evaluate(path, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
}

let GUI_SEGMENTS = null;

/**@GUI_SEGMENT_OBJECT */
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
//      navCollection = {
//      is_nested: is_nested,
//      is_uniform: is_uniform,
//      dominant_pattern: dominant_pattern,
//      collectionTree: [[collectionObject], ...[collectionObject, ...]] => collectionObject = {
//                                                                             node: collectionNode,
//                                                                             nodeXpath: getXpathOfElement(collectionNode),
//                                                                             nodeRect: collectionNodeRect,
//                                                                             navItems: [
//                                                                                          item: {
//                                                                                        node: 
//                                                                                        nodeXpath:
//                                                                                        nodeRect:
//                                                                                        }
//                                                                                        link: {
//                                                                                            node: 
//                                                                                            nodeXpath:
//                                                                                            nodeRect:
//                                                                                        }  
//                                                                                      ]
//      flattenNavItems: flattenNavItems
//      }
//      searchInput = {
//          node:
//          nodeXpath:
//          nodeRect:
//      }
//
//      label


class SemanticEvent {
    constructor(type) {
        this.type = type; // Semantic Event Type Name

        this.targetSegment = null; // Target Section

        this.targetDOMNode = null; // Target DOM Element

        this.targetDOMRect = null;

        this.defaultHandler = null; // Function

        this.defaultPrevented = false;

    }

    // initSemanticEvent(targetSegment, targetDOMNode) {
    //     this.targetSegment = targetSegment;
    //     this.targetDOMNode = targetDOMNode;
    // }

    // stopPropagation()

    preventDefault() {
        this.defaultPrevented = true;
    }

}

class TextInputEvent extends SemanticEvent {
    constructor(type, char) {
        super(type);
        this.char = char;
    }
}

class SelectEvent extends SemanticEvent {
    constructor(type) {
        super(type);
    }
}

// Type: "search", "form"
class SubmitEvent extends SemanticEvent {
    constructor(type) {
        super(type);
    }
}

class DefaultEventHandler {
    constructor() {

    }

    dispatchPointClick(targetRect) {
        const point_x = (targetRect.xmin + targetRect.xmax) / 2;
        const point_y = (targetRect.ymin + targetRect.ymax) / 2;

        chrome.runtime.sendMessage({
            method: "devtoolsProtocol",
            params: {
                request: "dispatchPointClick",
                coordinates: { x: point_x, y: point_y }
            }
        }, function (response) {
            console.log("Cilck emulation done in background");
            return;
        });
    }

    dispatchTextInput(text) {
        chrome.runtime.sendMessage({
            method: "devtoolsProtocol",
            params: {
                request: "dispatchTextInput",
                text: text
            }
        }, function (response) {
            console.log("TextInput emulation done in background");
            return;
        });
    }

    dispatchEnterInput() {
        chrome.runtime.sendMessage({
            method: "devtoolsProtocol",
            params: {
                request: "dispatchEnterInput"
            }
        }, function (response) {
            console.log("EnterInput emulation done in background");
            return;
        });
    }
}

// most generic class
class Segment {

    constructor(segment_object = null) {

        if (segment_object) this.initSegment(segment_object); // is not a root sement

        // Child Nodes
        this.childSegments = [];

        // Parent Node
        this.parentSegment = null;

        // Adjacent Nodes
        this.alignLeftSegment = null;
        this.alignRightSegment = null;
        this.alignTopSegment = null;
        this.alignBottomSegment = null;

        // Semantic Event Target
        this.listeners = {};

        this.innerFocused = false;
    }

    initSegment(segment_object) {
        this.matchedNode = segment_object.matched.node;

        this.matchedNodeRect = segment_object.matched.nodeRect;

        this.UIType = segment_object.detection.name;

        if (segment_object.label) this.label = segment_object.label;
    }

    addSemanticEventListener(type, callback) {
        if (!(type in this.listeners)) {
            this.listeners[type] = [];
        }

        this.listeners[type].push(callback);
    }

    handleSemanticEvent(event) {

        // Invoking added callback
        if (event.type in this.listeners) {
            let stack = this.listeners[event.type].slice();

            for (let i = 0; i < stack.length; i++) {
                stack[i].call(this, event); // TODO Check

            }
        }

        // If event listener call preventDefault() function -> event.defaultPrevented is now set to true
        if (event.defaultPrevented) return false;

        // Execute default handler
        if (event.defaultHandler) {
            event.defaultHandler.call(this, event);
            return true;
        }
    }

    removeSemanticEventListener(type, callback) {
        if (!(type in this.listeners)) {
            return;
        }
        let stack = this.listeners[type];
        for (let i = 0; i < stack.length; i++) {
            if (stack[i] === callback) {
                stack.splice(i, 1);
                return;
            }
        }
    }
}

/**
 * Web GUI: Collection-related Segment
 */
 class CollectionSegment extends Segment {
    constructor(segment_object, itemObjects) {
        super(segment_object);

        this.items = new Array();

        if (itemObjects) {
            for (const itemObject of itemObjects) {
                const itemSegment = new GUIModelMap.typeMap["basic-item"]({
                    matched: {
                        node: itemObject.node,
                        nodeRect: itemObject.nodeRect
                    },
                    detection: {
                        name: "basic-item"
                    },
                    label: null
                });
                this.items.push(itemSegment);
            }
        }
    }
}

class ItemSegment extends Segment {
    constructor(segment_object) {
        super(segment_object);
    }
}

class NavCollectionSegment extends Segment {
    constructor(segment_object, navItemObjects) {
        super(segment_object);

        this.navItems = new Array();

        if (navItemObjects) {
            for (const navItemObject of navItemObjects) {
                const navItem = new GUIModelMap.typeMap["nav-item"]({
                    matched: {
                        node: navItemObject.item.node,
                        nodeRect: navItemObject.item.nodeRect
                    },
                    detection: {
                        name: "nav-item"
                    },
                    label: null
                }, (navItemObject.link) ? navItemObject.link : null);

                // Hierarchical relationship between nav item and nav collection
                // navItemSegment.parentSegment = this;
                // this.childSegments.push(navItemSegment);

                this.navItems.push(navItem);
            }
        }

    }
}

class NavItemSegment extends Segment {
    constructor(segment_object, link) {
        super(segment_object);

        if (link) {
            this.linkNode = link.node,
            this.linkNodeRect = link.nodeRect;
        }
        else {
            // TODO - just item node
        }

        // TODO button
    }

    dispatchSemanticEvent(event) {
        // Init Event object properties which will be used in callback function or default event handler
        event.targetSegment = this;

        switch (event.type) {
            case "select": {
                event.targetDOMNode = this.linkNode;
                event.targetDOMRect = this.linkNodeRect;

                event.defaultHandler = function (event) {
                    const handler = new DefaultEventHandler();
                    handler.dispatchPointClick(event.targetDOMRect);
                }

                break;
            }
        }

        this.handleSemanticEvent(event);
    }
}

/**
 * Web GUI: Navigation Role
 */
 class NavigationSegment extends Segment {

    constructor(segment_object) {
        super(segment_object);

        this.navCollection = null;

        if (segment_object.navCollection) this.setNavCollection(segment_object.navCollection);
    }

    setNavCollection(navCollectionObject) {
        /*
        navCollection = {
            is_nested: is_nested,
            is_uniform: is_uniform,
            dominant_pattern: dominant_pattern,
            collectionTree: collectionObjectTree,
        }
                collectionObject = {
                    node: collectionNode,
                    nodeXpath: getXpathOfElement(collectionNode),
                    nodeRect: collectionNodeRect,
                    navItems: navItems
                }
        */

        this.is_nested = navCollectionObject.is_nested;
        this.is_uniform = navCollectionObject.is_uniform;
        this.dominant_pattern = navCollectionObject.dominant_pattern;

        this.navCollection = null;
        this.flattedNavCollections = new Array; // for tree construction later
        this.flattedNavItems = new Array;

        /**
         * Collection instanciation
         */
        const collectionObjectTree = navCollectionObject.collectionTree;
        const rootCollectionObject = collectionObjectTree[0][0];

        this.navCollection = new GUIModelMap.typeMap["nav-collection"]({
            matched: {
                node: rootCollectionObject.node,
                nodeRect: rootCollectionObject.nodeRect
            },
            detection: {
                name: "nav-collection"
            },
            label: null
        }, rootCollectionObject.navItems); // Root collection (Entry point of collection tree)

        // Hierarchical relationship b.t.w. root collection and segment
        // this.navCollection.parentSegment = this;
        // this.childSegments.push(this.navCollection);

        this.flattedNavCollections.push(this.navCollection);

        if (this.is_nested) {
            const subCollectionObjects = collectionObjectTree[collectionObjectTree.length - 1]; // Last layer
            for (const subCollectionObject of subCollectionObjects) {

                const subCollection = new GUIModelMap.typeMap["nav-collection"]({
                    matched: {
                        node: subCollectionObject.node,
                        nodeRect: subCollectionObject.nodeRect
                    },
                    detection: {
                        name: "nav-collection"
                    },
                    label: null
                }, subCollectionObject.navItems);

                // Hierarchical relationship b.t.w. collections
                // subCollection.parentSegment = this.navCollection;
                // this.navCollection.childSegments.push(subCollection);

                this.flattedNavCollections.push(subCollection);

                // Make flatted navigation items of sub-collections
                this.flattedNavItems = this.flattedNavItems.concat(subCollection.navItems);
            }
        } else {
            // Make flatted navigation items of the root collection
            this.flattedNavItems = this.navCollection.navItems;
        }
    }
}

class TabBarSegment extends NavigationSegment {
    constructor(segment_object) {
        super(segment_object);

    }
}

class MenuSegment extends NavigationSegment {
    constructor(segment_object) {
        super(segment_object);

    }
}

class ContentsSegment extends NavigationSegment {
    constructor(segment_object) {
        super(segment_object);

    }
}

/**
 * Web GUI: Form Role
 */
class FormSegment extends Segment {
    constructor(segment_object) {
        super(segment_object);

    }

    action() {

    }
}

class LoginSegment extends FormSegment {
    constructor(segment_object) {
        super(segment_object);

    }
}

class SearchSegment extends FormSegment {

    constructor(segment_object) {
        super(segment_object);

        const searchInputObject = segment_object.searchInput;
        this.searchInputNode = searchInputObject.node;
        this.searchInputNodeRect = searchInputObject.nodeRect;
    }
    
    dispatchSemanticEvent(event) {
        // Init Event object properties which will be used in callback function or default event handler
        event.targetSegment = this;

        switch (event.type) {
            case "select": {
                event.targetDOMNode = this.searchInputNode;
                event.targetDOMRect = this.searchInputNodeRect;

                // Default handler of select event on search segment retarget the event to search input node
                event.defaultHandler = function (event) {
                    const handler = new DefaultEventHandler();
                    handler.dispatchPointClick(event.targetDOMRect);
                }
                this.innerFocused = true;
                break;
            }

            case "keyinput": {
                const char = event.char;
                event.targetDOMNode = this.searchInputNode;
                event.targetDOMRect = this.searchInputNodeRect;

                // If search input is not selected, select and dispatch key input for initial text key input
                if (!this.innerFocused) {
                    event.defaultHandler = function (event) {
                        const handler = new DefaultEventHandler();
                        handler.dispatchPointClick(event.targetDOMRect);
                        handler.dispatchTextInput(char);
                    }
                    this.innerFocused = true;
                }

                break;
            }

            case "submit": {
                event.targetDOMNode = this.searchInputNode;
                event.targetDOMRect = this.searchInputNodeRect;

                if (this.innerFocused) {
                    event.defaultHandler = function (event) {
                        const handler = new DefaultEventHandler();
                        handler.dispatchEnterInput();
                    }
                } else {
                    event.defaultHandler = function (event) {
                        const handler = new DefaultEventHandler();
                        handler.dispatchPointClick(event.targetDOMRect);
                        handler.dispatchEnterInput();
                    }
                }
                this.innerFocused = false;
                break;
            }
        }

        this.handleSemanticEvent(event);
    }
}

/**
 * Web GUI: Content Role
 */
class MediaSegment extends Segment {
    constructor(segment_object) {
        super(segment_object);

    }
}

class PostsSegment extends Segment { // Posts segment itself is also a collection segment
    constructor(segment_object) {
        super(segment_object);

        this.basicCollection = null;

        if (segment_object.basicCollection) {
            this.basicCollection = this.initCollection(segment_object.basicCollection, "posts");
        }
    }

    initCollection(basicCollectionObject, label) {
        /*basicCollection = {
            node
            nodeXpath
            nodeRect
            items
        }*/
        const segment_object = {
            matched: {
                node: basicCollectionObject.node,
                nodeRect: basicCollectionObject.nodeRect
            },
            detection: {
                name: "basic-collection"
            },
            label: label
        }
        const basicCollection = new GUIModelMap.typeMap["basic-collection"](segment_object, basicCollectionObject.items);
        return basicCollection;
    }
}

class ArticleSegment extends Segment {
    constructor(segment_object) {
        super(segment_object);

    }
}

class ContentSummarySegment extends Segment {
    constructor(segment_object) {
        super(segment_object);

    }
}

/**
 * Web GUI: Widget Role
 */
class WidgetSegment extends Segment {
    constructor(segment_object) {
        super(segment_object);
    }

    initCollection(basicCollectionObject, label) {
        /*basicCollection = {
            node
            nodeXpath
            nodeRect
            items
        }*/
        const segment_object = {
            matched: {
                node: basicCollectionObject.node,
                nodeRect: basicCollectionObject.nodeRect
            },
            detection: {
                name: "basic-collection"
            },
            label: label
        }
        const basicCollection = new GUIModelMap.typeMap["basic-collection"](segment_object, basicCollectionObject.items);
        return basicCollection;
    }
}

class CommentsSegment extends WidgetSegment {
    constructor(segment_object) {
        super(segment_object);

        this.messageInput = null;
        this.basicCollection = null;

        if (segment_object.basicCollection) {
            this.basicCollection = this.initCollection(segment_object.basicCollection, "comments");
        }
    }
}

class ChatBoxSegment extends WidgetSegment {
    constructor(segment_object) {
        super(segment_object);

        this.messageInput = null;
        this.basicCollection = null;

        if (segment_object.basicCollection) {
            this.basicCollection = this.initCollection(segment_object.basicCollection, "chats");
        }
    }
}

class ToolBarSegment extends WidgetSegment {
    constructor(segment_object) {
        super(segment_object);

        this.basicCollection = null;

        if (segment_object.basicCollection) {
            this.basicCollection = this.initCollection(segment_object.basicCollection, "tools");
        }
    }
}

class OptionsSegment extends WidgetSegment {
    constructor(segment_object) {
        super(segment_object);

        this.basicCollection = null;

        if (segment_object.basicCollection) {
            this.basicCollection = this.initCollection(segment_object.basicCollection, "option-containers");
        }
    }
}

class SideSegment extends WidgetSegment {
    constructor(segment_object) {
        super(segment_object);

        this.basicCollection = null;

        if (segment_object.basicCollection) {
            this.basicCollection = this.initCollection(segment_object.basicCollection, "side-containers");
        }
    }
}

class GUIModelMap {

    // check via "typeof"
    static typeMap = {
        "tab-bar": TabBarSegment,
        "menu-bar": MenuSegment,
        "menu-panel": MenuSegment,
        "content-list": ContentsSegment, // content-list
        "content-grid": ContentsSegment, // content-grid

        "login": LoginSegment,
        "form": FormSegment,
        "search": SearchSegment,

        "comments": CommentsSegment,
        "chat-panel": ChatBoxSegment,
        "tool-bar": ToolBarSegment, // Tool-bar
        "options-panel": OptionsSegment,
        "side-panel": SideSegment,
        
        "media": MediaSegment,
        "article": ArticleSegment,
        "posts": PostsSegment,
        "contentsummary": ContentSummarySegment,
 
        "nav-collection": NavCollectionSegment,
        "nav-item": NavItemSegment,
        
        "basic-collection": CollectionSegment,
        "basic-item": ItemSegment
    }

    static roleMap = {
        "tab-bar": "navigation",
        "menu-bar": "navigation",
        "menu-panel": "navigation",
        "content-list": "navigation",
        "content-grid": "navigation",

        "login": "form",
        "form": "form",
        "search": "form",

        "comments": "widget",
        "chat-panel": "widget",
        "tool-bar": "widget",
        "options-panel": "widget",
        "side-panel": "widget",

        "media": "content",
        "article": "content",
        "posts": "content",
        "contentsummary": "content",
    }
}

class SegmentedScreen extends Segment {

    constructor() {
        super(null);

        /**
         * @Array
         * A list of segments which have top-level semantics (e.g., Tab-bar, Article, ..)
         */
        this.topSemanticSegmentList = new Array();

        /**
         * @Array
         * A list of all segments including top-level segments and their inner segments
         */
        this.totalSegmentList = new Array();

    }

    getSegmentsByLabel(label) {
        let _segments = [];
        for (const segment of this.topSemanticSegmentList) {
            if (segment.label && segment.label == label) {
                _segments.push(segment);
            }
        }
        return _segments;
    }

    getSegmentsByUIType(type) {
        let _segments = [];
        for (const segment of this.topSemanticSegmentList) {
            if (segment.UIType && segment.UIType === type) {
                _segments.push(segment);
            }
        }
        return _segments;
    }

    getLargestSegmentIndex(segments) {
        if (segments.length == 1) return 0;
        const matched = {
            area: -1000,
            index: -1
        }
        segments.forEach((segment, index) => {
            const area = (segment.matchedNodeRect.xmax - segment.matchedNodeRect.xmin)
                * (segment.matchedNodeRect.ymax - segment.matchedNodeRect.ymin);

            if (area > matched.area) {
                matched.area = area;
                matched.index = index;
            }
        });

        return matched.index;
    }

    segmentsFromPoint(x, y) {
        const elements = document.elementsFromPoint(x, y);

        const matchedSegments = new Array();
        for (const element of elements) {
            for (const segment of this.totalSegmentList) {
                if (element === segment.matchedNode) {
                    matchedSegments.push(segment);
                }
            }
        }
        
        return matchedSegments;
    }
}

/**
 * GUI Model Extraction
 */
class GUIModelExtractor {

    constructor() {
        this.detections = null;
        this.screen_width = null;
        this.screen_height = null;
        this.prevActionTargetSegment = null;

        /**
         * @Object
         * Entry point of GUI segments and its methods
         */
        this.segmentedScreen = new SegmentedScreen();

        // Callback
        this.screenParsedCallback = null;
    }

    /**
     * @function restoreSegmentsInstance restore DOM element instance after receive the segments obj from background
     * @param {*} _segments Array of segment object, which has each node's xpaths
     */
    restoreSegmentsInstance(_segments) {
        const segments = _segments;

        for (let i = 0; i < segments.length; i++) {
            let segment = segments[i];

            if (segment.matched.nodeXpath && getElementByXpath(segment.matched.nodeXpath)) {
                segment.matched.node = getElementByXpath(segment.matched.nodeXpath);
            } else {
            }

            // If container node exists
            if (segment.navCollection.nodeXpath && getElementByXpath(segment.navCollection.nodeXpath)) {
                segment.navCollection.node = getElementByXpath(segment.navCollection.nodeXpath);

                if (segment.navCollection.items) {
                    for (let itemObject of segment.navCollection.items) {
                        if (itemObject.item.nodeXpath && getElementByXpath(itemObject.item.nodeXpath)) {
                            itemObject.item.node = getElementByXpath(itemObject.item.nodeXpath);
                        }
                        if (itemObject.link.nodeXpath && getElementByXpath(itemObject.link.nodeXpath)) {
                            itemObject.link.node = getElementByXpath(itemObject.link.nodeXpath);
                        }
                    }
                }
            }

            if (segment.searchInput.nodeXpath && getElementByXpath(segment.searchInput.nodeXpath)) {
                segment.searchInput.node = getElementByXpath(segment.searchInput.nodeXpath);
            }
        }

        return segments;
    }

    getIoU_detBox(sourceDet, targetDet) {
        const source_area = (sourceDet.xmax - sourceDet.xmin) * (sourceDet.ymax - sourceDet.ymin); 
        const target_area = (targetDet.xmax - targetDet.xmin) * (targetDet.ymax - targetDet.ymin);

        // Overlap area
        const overlap_width = Math.max(0, (Math.min(sourceDet.xmax, targetDet.xmax) - Math.max(sourceDet.xmin, targetDet.xmin)));
        const overlap_height = Math.max(0, (Math.min(sourceDet.ymax, targetDet.ymax) - Math.max(sourceDet.ymin, targetDet.ymin)));
        const overlap_area = overlap_width * overlap_height; // the value will be minus when the two do not overlap

        // Union area
        const union_area = (source_area + target_area) - overlap_area;

        // Calculate IoU (intersection over union, a.k.a. Jaccard index)
        const iou_score = overlap_area / union_area;

        return iou_score;
    }

    getIoU_DOMRect(sourceElement, targetElement, only_for_screen_viewport) {
        if (sourceElement.style.display == "none" || sourceElement.style.opacity == "0" ||
            targetElement.style.display == "none" || targetElement.style.opacity == "0") {
            return 0;
        }

        const sourceRect = sourceElement.getBoundingClientRect();
        const targetRect = targetElement.getBoundingClientRect();

        let source_xmin, source_xmax, source_ymin, source_ymax, target_xmin, target_xmax, target_ymin, target_ymax;
        if (only_for_screen_viewport) {
            source_xmin = sourceRect.left;
            source_xmax = sourceRect.right > this.screen_width ? this.screen_width : sourceRect.right;
            source_ymin = sourceRect.top;
            source_ymax = sourceRect.bottom > this.screen_height ? this.screen_height : sourceRect.bottom;

            target_xmin = targetRect.left;
            target_xmax = targetRect.right > this.screen_width ? this.screen_width : targetRect.right;
            target_ymin = targetRect.top;
            target_ymax = targetRect.bottom > this.screen_height ? this.screen_height : targetRect.bottom;
        } else {
            source_xmin = sourceRect.left, source_xmax = sourceRect.right, source_ymin = sourceRect.top, source_ymax = sourceRect.bottom;
            target_xmin = targetRect.left, target_xmax = targetRect.right, target_ymin = targetRect.top, target_ymax = targetRect.bottom;
        }
        
        const source_area = (source_xmax - source_xmin) * (source_ymax - source_ymin); 
        const target_area = (target_xmax - target_xmin) * (target_ymax - target_ymin);

        // Overlap area
        const overlap_width = Math.max(0, (Math.min(source_xmax, target_xmax) - Math.max(source_xmin, target_xmin)));
        const overlap_height = Math.max(0, (Math.min(source_ymax, target_ymax) - Math.max(source_ymin, target_ymin)));
        const overlap_area = overlap_width * overlap_height; // the value will be minus when the two do not overlap

        // Union area
        const union_area = (source_area + target_area) - overlap_area;

        // Calculate IoU (intersection over union, a.k.a. Jaccard index)
        const iou_score = overlap_area / union_area;

        return iou_score;
    }

    getElementByLargestIoU(xmin, xmax, ymin, ymax, candidates) {
        const IOU_THRESHOLD = 0.2;
        const targetBox_area = (xmax - xmin) * (ymax - ymin);

        let matched = {
            index: null,
            iou_score: -1000
        }

        candidates.forEach((candidate, index) => {
            if (candidate == document.documentElement || candidate == document.body ||
                candidate.style.display == "none" || candidate.style.opacity == "0") {
                return;
            }

            const rect = candidate.getBoundingClientRect();
            const candidate_xmin = rect.left;
            const candidate_ymin = rect.top;

            const candidate_xmax = rect.right > this.screen_width ? this.screen_width : rect.right;
            const candidate_ymax = rect.bottom > this.screen_height ? this.screen_height : rect.bottom;

            // Overlap area between target box and candidate rect
            const overlap_width = Math.max(0, (Math.min(xmax, candidate_xmax) - Math.max(xmin, candidate_xmin)));
            const overlap_height = Math.max(0, (Math.min(ymax, candidate_ymax) - Math.max(ymin, candidate_ymin)));
            const overlap_area = overlap_width * overlap_height;

            // Union area including target box and candidate rect
            const candidateRect_area = (candidate_xmax - candidate_xmin) * (candidate_ymax - candidate_ymin);
            const union_area = targetBox_area + candidateRect_area - overlap_area;

            // Calculate IoU (intersection over union, a.k.a. Jaccard index)
            const iou_score = overlap_area / union_area;

            // If IOU score is same, set matched to the node with higher order of DOM tree
            if (matched.iou_score <= iou_score && iou_score >= IOU_THRESHOLD) {
                matched.index = index;
                matched.iou_score = iou_score;
            }
        });

        // DEBUG
        console.log("matched element: ", candidates[matched.index], "with the score ", matched.iou_score);

        if (!candidates[matched.index]) return null;
        return candidates[matched.index];
    }

    getMatchedNode(xmin, xmax, ymin, ymax) {
        // predicted GUI segment's bounding box
        const midpoint_x = xmin + (xmax - xmin) / 2;
        const midpoint_y = ymin + (ymax - ymin) / 2;

        // Elements are stored in an ascending order (last element is a body)
        // ElementsFromPoint method do not detects elements with display=none but detects elements with opacity=0 
        const candidateElements = document.elementsFromPoint(midpoint_x, midpoint_y);

        const matchedNode = this.getElementByLargestIoU(xmin, xmax, ymin, ymax, candidateElements);
        return matchedNode;
    }

    /**
     * Check the element is type of collection
     * @param {*} element 
     * @returns collection tree object that include the collection-related informations
     */
    isCollection(element) {
        const MINIMUM_COLLECTION_LENGTH = 2;
        // const MINIMUM_CONTAINER_IOU = 0.3;

        let hit = false;
        let maxPattern = null;
        const maxPatternChildren = [];

        /** @Collection_identification_Heuristics */

        // (1) Continue only if the current node is visible
        if (element.style.display == "none" || element.style.opacity == "0") return;

        // (2) if the current node is <ul> or <ol> element -> Directly revealed semantics
        const children = Array.from(element.children);
        if (element.tagName == "UL" || element.tagName == "OL") {
            for (const child of children) {
                if (child.tagName === "LI" || child.getAttribute("role") === "listitem") {
                    maxPattern = child.tagName + (typeof child.className === 'string' ? child.className.split(" ")[0] : "");
                    hit = true;
                    break;
                }
            }
        }
        // (3) check child nodes
        else {
            const validChildren = new Array();
            for (const child of children) {
                // do not count invisible and unreacheble child node
                if (child.style.display == "none" || child.style.opacity == "0" ||
                    child.nodeType !== Node.ELEMENT_NODE || child.tagName == "SCRIPT" ||
                    (child.getBoundingClientRect().width * child.getBoundingClientRect().height <= 5)) continue;

                validChildren.push(child);
            }

            const maxCalcLength = (validChildren.length > 20) ? 20 : validChildren.length;
            let countMap = new Map();
            for (let i = 0; i < maxCalcLength; i++) {
                const child = validChildren[i];

                const tag_class_string = child.tagName + (typeof child.className === 'string' ? child.className.split(" ")[0] : "");
                if (countMap.get(tag_class_string)) countMap.set(tag_class_string, countMap.get(tag_class_string) + 1);
                else countMap.set(tag_class_string, 1); // first time
            }

            countMap.forEach((count, key) => {
                if (count >= MINIMUM_COLLECTION_LENGTH && count >= maxCalcLength / 2) {
                    maxPattern = key;
                    hit = true;

                    // Store children related to maxPattern
                    for (const child of validChildren) {
                        const tag_class_string = child.tagName + (typeof child.className === 'string' ? child.className.split(" ")[0] : "");
                        if (tag_class_string === maxPattern) {
                            maxPatternChildren.push(child);
                        }
                    }
                }
            });
        }

        if (!hit) return null;
        return {
            element: element,
            pattern: maxPattern,
            children: maxPatternChildren
        }
    }

    getCollectionTree(element) {

        const root_collection = this.isCollection(element);
        
        if (!root_collection) return null;

        // Make candidate container tree start from this element
        const root_collection_pattern = root_collection.pattern;
        const root_collection_children = root_collection.children;

        const candidateTree = {
            is_nested: false,
            is_uniform: false,
            dominant_pattern: root_collection_pattern,
            tree: new Array() // two dimensional array
        }
        candidateTree.tree.push([element]); // Store root collection element

        const subCollections = []; // {element, pattern, children}
        for (const child of root_collection_children) {

            // BFS from the child
            const queue = [];
            queue.unshift(child);
            while (queue.length != 0) {
                const cur_element = queue.shift();

                const sub_collection = this.isCollection(cur_element);
                if (sub_collection) {
                    subCollections.push(sub_collection);
                    break;
                }
                
                const children = cur_element.children;
                for (const child of children) {
                    queue.push(child);
                }
            }
        }
        
        /** @Nested_Collections_identification_Heuristics */
        const MINIMUM_NESTING_IOU = 0.5;

        // Check IoU between root collection and sub-collections exceed certain threshold
        let iou_sum = 0;
        for (const subCollection of subCollections) {
            iou_sum = iou_sum + this.getIoU_DOMRect(element, subCollection.element, false);
        }

        // If less than the threshold, return candidate only with root collection
        if (iou_sum < MINIMUM_NESTING_IOU) {
            return candidateTree;
        }

        // This candidate is nested collection
        candidateTree.is_nested = true;
        
        // Add sub-collections in the candidate tree
        const subCollectionNodes = [];
        for (const subCollection of subCollections) subCollectionNodes.push(subCollection.element);
        candidateTree.tree.push(subCollectionNodes);

        // Check sub-collections are uniform
        const countMap = new Map();
        for (const subCollection of subCollections) {
            const pattern = subCollection.pattern;
            if (countMap.get(pattern)) countMap.set(pattern, countMap.get(pattern) + 1);
            else countMap.set(pattern, 1); // first time
        }

        let dominant_pattern = null;
        countMap.forEach((count, key) => {
            // Loose matching
            // if (count >= 2 && count >= candidates.length / 2) {
            //     dominant_pattern = key;
            // }

            // Strict matching
            if (count == subCollections.length) dominant_pattern = key;
        });

        if (dominant_pattern) {
            // This candidate is uniform collection
            candidateTree.is_uniform = true;
            candidateTree.dominant_pattern = dominant_pattern;
        }

        return candidateTree;
    }

    /**
     * find best fit collection tree while traversing from the matched node in a BFS
     * @param {*} matchedNode matchedNode of detection 
     */
    findNavCollectionTree(matchedNode) {
        const MINIMUM_COLLECTION_IOU = 0.001;
        // const MINIMUM_COLLECTION_IOU = 0.3;

        let best_iou = -1000;
        let best_collectionTree = null;

        const queue = [];
        queue.unshift(matchedNode);
        while (queue.length != 0) {
            const cur_element = queue.shift();
            const candidateTree = this.getCollectionTree(cur_element);

            // Calculate IoU score between the root collection node of candidate tree and matched node
            if (candidateTree) {
                const rootCollectionNode = candidateTree.tree[0][0];
                
                // Return the collection candidate if the collection is larger than matced node
                const collectionNodeRect = rootCollectionNode.getBoundingClientRect();
                const matchedNodeRectRect = matchedNode.getBoundingClientRect();
                const collectionNodeArea = collectionNodeRect.width * collectionNodeRect.height;
                const matchedNodeRectArea = matchedNodeRectRect.width * matchedNodeRectRect.height;
                if (collectionNodeArea >= matchedNodeRectArea) {
                    best_collectionTree = candidateTree;
                    break;
                }

                let cur_iou = 0;
                // Some children may placed on below-the-fold, calculate IoU not only for the screen viewport
                for (const child of Array.from(rootCollectionNode.children))
                    cur_iou = cur_iou + this.getIoU_DOMRect(matchedNode, child, true);

                // const cur_iou = this.getIoU_DOMRect(matchedNode, rootCollectionNode, false);
                if (cur_iou > MINIMUM_COLLECTION_IOU && cur_iou > best_iou) {
                    console.log("candidateTree", candidateTree);
                    best_iou = cur_iou;
                    best_collectionTree = candidateTree;
                }
            }

            // Further finding candidate collection tree
            const children = cur_element.children;
            for (const child of children) {
                queue.push(child);
            }
        }

        return best_collectionTree;
    }

    findBasicCollection(matchedNode) {
        const MINIMUM_COLLECTION_IOU = 0.6;

        let best_iou = -1000;
        let best_collection = null;

        const queue = [];
        queue.unshift(matchedNode);
        while (queue.length != 0) {
            const cur_element = queue.shift();

            if (this.getIoU_DOMRect(matchedNode, cur_element, false) < best_iou) {
                break;
            }

            const candidateCollection = this.isCollection(cur_element);

            // Calculate IoU score between the root collection node of candidate tree and matched node
            if (candidateCollection) {
                // IoU on above-the-fold
                const cur_iou = this.getIoU_DOMRect(matchedNode, candidateCollection.element, true);
                if (cur_iou > best_iou) {
                    best_iou = cur_iou;
                    best_collection = candidateCollection;
                }
            }
            
            // Further finding candidate collection tree
            const children = cur_element.children;
            for (const child of children) {
                queue.push(child);
            }
        }

        return best_collection;
    }

    findRepresentativeLink(itemNode) { // Same with finding where to click

        const ATTRIBUTE_SCORE = {
            /** Tag names */
            // Header level tags
            "H1": 6.6, "H2": 6.5, "H3": 6.4, "H4": 6.3, "H5": 6.2, "H6": 6.1, // tagName always return as capital
            // Text level tags
            "STRONG": 3,
            "B": 3,
            "EM": 3,
            "I": 3
        }

        let cur_score = 0;
        let matched = {
            score: -1000,
            index: null,
            node: null
        }

        function findTagsForChildren(element) {
            if (ATTRIBUTE_SCORE.hasOwnProperty(element.tagName) && cur_score < ATTRIBUTE_SCORE[element.tagName]) {
                cur_score = ATTRIBUTE_SCORE[element.tagName];
            }

            const children = Array.from(element.children);

            // Recursive calls to current element's children
            children.forEach((child) => {
                findTagsForChildren(child);
            });
        }

        function findTagsForParentPath(element) {
            let cur_parent = element.parentNode;
            while (cur_parent !== itemNode && cur_parent) {
                if (ATTRIBUTE_SCORE.hasOwnProperty(cur_parent.tagName) && cur_score < ATTRIBUTE_SCORE[cur_parent.tagName]) {
                    cur_score = ATTRIBUTE_SCORE[cur_parent.tagName];
                }
                cur_parent = cur_parent.parentNode;
            }
        }

        // Return the item node itself, if the node is a <a> element
        if (itemNode.tagName == "A") return itemNode;

        const linkNodes = itemNode.getElementsByTagName("A");
        Array.from(linkNodes).forEach((candidateLinkNode, index) => {

            // Only for the reachable link nodes
            if (candidateLinkNode.style.display == "none" || candidateLinkNode.style.opacity == "0" ||
                (candidateLinkNode.getBoundingClientRect().width * candidateLinkNode.getBoundingClientRect().height <= 5)) return;

            cur_score = 0;

            // Matching tag name for link node's children
            findTagsForChildren(candidateLinkNode);

            // Matching tag name for link node's parent path (e.g., heading element could contain the link node)
            findTagsForParentPath(candidateLinkNode);

            if (matched.score === cur_score) {
                // Compare area
                const prevMatchedArea = matched.node.getBoundingClientRect().width * matched.node.getBoundingClientRect().height;
                const curArea = candidateLinkNode.getBoundingClientRect().width * candidateLinkNode.getBoundingClientRect().height;
                if (curArea > prevMatchedArea) {
                    matched.score = cur_score;
                    matched.index = index;
                    matched.node = candidateLinkNode;
                }
            }

            if (matched.score < cur_score) {
                matched.score = cur_score;
                matched.index = index;
                matched.node = candidateLinkNode;
            }
        }); // if all link nodes has same score, first node will be selected

        return matched.node;
    }
    
    /**
     * @function getItemsAndLinksArray
     * @param {*} collectionNode
     * @returns container items each including item node and representative link node
     */
    getItemsAndLinksArray(collectionNode) {
        let navItemObjects = [];
        Array.from(collectionNode.children).forEach((itemNode, index) => { // for each container's item

            /**
             * Pick the navItems in the navCollection node
             */
            if (itemNode.style.display == "none" || itemNode.style.opacity == "0" ||
            itemNode.nodeType !== Node.ELEMENT_NODE || itemNode.tagName == "SCRIPT" ||
            (itemNode.getBoundingClientRect().width * itemNode.getBoundingClientRect().height <= 5)) return;

            const matchedLinkNode = this.findRepresentativeLink(itemNode);

            // Store
            const itemRect = itemNode.getBoundingClientRect();
            const itemObject = {
                item: {
                    node: itemNode,
                    nodeXpath: getXpathOfElement(itemNode),
                    nodeRect: { xmin: itemRect.left, xmax: itemRect.right, ymin: itemRect.top, ymax: itemRect.bottom }
                }
            }

            if (matchedLinkNode) {
                const linkRect = matchedLinkNode.getBoundingClientRect();
                itemObject.link = {
                    node: matchedLinkNode,
                    nodeXpath: getXpathOfElement(matchedLinkNode),
                    nodeRect: { xmin: linkRect.left, xmax: linkRect.right, ymin: linkRect.top, ymax: linkRect.bottom }
                }
            } else {
                // TODO

            }

            navItemObjects.push(itemObject);
        });

        return navItemObjects;
    }

    findSearchInputNode(matchedNode) {

        const ATTRIBUTE_SCORE = {
            // Attribute Name
            "search": 2,
            "text": 1,
            "contenteditable": 0.5,
            "placeholder": 0.5,

            // Tag Name
            "INPUT": 3,
            "TEXTAREA": 3
        }

        let cur_score = 0;
        let matched = {
            score: 0,
            node: null
        }

        function findSearchInputCandidates(node) {
            cur_score = 0;

            if (ATTRIBUTE_SCORE.hasOwnProperty(node.tagName)) {
                cur_score = cur_score + ATTRIBUTE_SCORE[node.tagName];
            }
            if (node.getAttribute("type")) {
                cur_score = cur_score + ATTRIBUTE_SCORE[node.getAttribute("type")];
            }
            if (node.getAttribute("contenteditable") == "true") {
                cur_score = cur_score + ATTRIBUTE_SCORE["contenteditable"];
            }
            if (node.getAttribute("placeholder")) {
                cur_score = cur_score + ATTRIBUTE_SCORE["placeholder"];
            }
            if (node.style.display == "none" || node.style.opacity == "0" || node.getAttribute("type") == "hidden" ||
                (node.getBoundingClientRect().width * node.getBoundingClientRect().height <= 4)) {
                cur_score = -1000;
            }

            if (matched.score < cur_score) {
                matched.score = cur_score;
                matched.node = node;
            }

            // Recursive calls to current element's children
            Array.from(node.children).forEach((child) => {
                findSearchInputCandidates(child);
            });
        }

        findSearchInputCandidates(matchedNode);
        return matched.node; // returns node or null
    }

    webGUISegmentation() {
        const detections = this.detections;
        const numDets = detections.length;
        const segments = [];

        for (let index = 0; index < detections.length; index++) {
            const detection = detections[index];

            // DEBUG
            console.log("@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@");
            console.log("[detection]", detection.name, detection.score);

            const matchedNode = this.getMatchedNode(detection.xmin, detection.xmax, detection.ymin, detection.ymax);

            if (!matchedNode) continue;

            const rect = matchedNode.getBoundingClientRect();
            const matchedNodeRect = { xmin: rect.left, xmax: rect.right, ymin: rect.top, ymax: rect.bottom };

            // GUI segment object with parsed information
            const segment = {
                detection: detection,
                matched: {
                    node: matchedNode,
                    nodeXpath: getXpathOfElement(matchedNode),
                    nodeRect: matchedNodeRect
                }
            }
            
            /**
             * @Collection_Identification for Navigation role
             */
            if (GUIModelMap.roleMap[detection.name] === "navigation") {

                // Get collection tree
                const collectionTree = this.findNavCollectionTree(matchedNode);

                if (collectionTree) {
                    const collectionNodeTree = collectionTree.tree;
                    const is_nested = collectionTree.is_nested;
                    const is_uniform = collectionTree.is_uniform;
                    const dominant_pattern =  collectionTree.dominant_pattern;
    
                    // Convert each collection tree node to object
                    const collectionObjectTree = [];
                    for (let layer_index = 0; layer_index < collectionNodeTree.length; layer_index++) {
                        const collections = collectionNodeTree[layer_index];
                        const collectionObjects = [];
    
                        for (const collectionNode of collections) {
                            const rect = collectionNode.getBoundingClientRect();
                            const collectionNodeRect = { xmin: rect.left, xmax: rect.right, ymin: rect.top, ymax: rect.bottom };
                            
                            let navItems = null;
                            if (layer_index == collectionNodeTree.length - 1) { // Last layer of the tree
                                navItems = this.getItemsAndLinksArray(collectionNode);
                            }
                            const collectionObject = {
                                node: collectionNode,
                                nodeXpath: getXpathOfElement(collectionNode),
                                nodeRect: collectionNodeRect,
                                navItems: navItems
                            }
                            collectionObjects.push(collectionObject);
                        }
    
                        collectionObjectTree.push(collectionObjects);
                    }
    
                    segment.navCollection = {
                        is_nested: is_nested,
                        is_uniform: is_uniform,
                        dominant_pattern: dominant_pattern,
                        collectionTree: collectionObjectTree
                    }
                }
            }

            /**
             * @Collection_Identification for other role
             */
            if (GUIModelMap.roleMap[detection.name] === "widget" || detection.name === "posts") {
                // find basic collection
                const basicCollection = this.findBasicCollection(matchedNode);

                if (basicCollection) {
                    const basicCollectionNode = basicCollection.element
                    const rect = basicCollectionNode.getBoundingClientRect();
                    const basicCollectionNodeRect = { xmin: rect.left, xmax: rect.right, ymin: rect.top, ymax: rect.bottom };

                    const itemObjects = [];
                    for (const childNode of Array.from(basicCollectionNode.children)) {
                        if (childNode.style.display == "none" || childNode.style.opacity == "0" ||
                            childNode.nodeType !== Node.ELEMENT_NODE || childNode.tagName == "SCRIPT" ||
                            (childNode.getBoundingClientRect().width * childNode.getBoundingClientRect().height <= 5)) continue;

                        const itemRect = childNode.getBoundingClientRect();
                        const itemObject = {
                            node: childNode,
                            nodeXpath: getXpathOfElement(childNode),
                            nodeRect: { xmin: itemRect.left, xmax: itemRect.right, ymin: itemRect.top, ymax: itemRect.bottom }
                        }
                        itemObjects.push(itemObject);
                    }

                    segment.basicCollection = {
                        node: basicCollectionNode,
                        nodeXpath: getXpathOfElement(basicCollectionNode),
                        nodeRect: basicCollectionNodeRect,
                        items: itemObjects
                    }
                }
            }

            // GUI segments of search
            if (["search"].includes(detection.name)) {

                // Find inputNode of search-bar, if any matched input node exists, assume as the node itself
                const searchInputNode = this.findSearchInputNode(matchedNode);

                if (!searchInputNode) continue;

                const rect = searchInputNode.getBoundingClientRect();
                const searchInputNodeRect = { xmin: rect.left, xmax: rect.right, ymin: rect.top, ymax: rect.bottom };
                segment.searchInput = {
                    node: searchInputNode,
                    nodeXpath: getXpathOfElement(searchInputNode),
                    nodeRect: searchInputNodeRect
                }
            }

            segments.push(segment);
        };

        return segments;
    }

    semanticNMS(segments) {
        const ROLE_NMS_IOU_THRESHOLD = 0.05;
        const MERGE_IOU_THRESHOLD = 0.5;

        /**
         * 1. NMS for the ovelapped boxes with the same functional role of GUI
         */
        const segmentsByRole = { // Sort GUI segments having the same functional role in a descending order of confidence score
            "navigation": [],
            "form": [],
            "widget": [],
            "content": []
        }
        for (const segment of segments) {
            const type = segment.detection.name;
            segmentsByRole[GUIModelMap.roleMap[type]].push(segment);
        }

        const NMS_1_output_segments = [];
        for (const role in segmentsByRole) { // for each segments of same functional role
            let cur_segments = segmentsByRole[role];
            
            while(cur_segments.length > 0) {
                // Remove the top scored segment and push to outputs array
                let topScoredSegment = cur_segments.shift();
                NMS_1_output_segments.push(topScoredSegment);

                const afterNMS = [];

                // Left only the segment which has lower IoU than the threshold
                for (let i = 0; i < cur_segments.length; i++) {
                    const cur_segment = cur_segments[i];
                    
                    // Calculate the IoU of predicted bounding box, not the matched node
                    // const IoU = this.getIoU_detBox(topScoredSegment.detection, cur_segment.detection);
                    const IoU = this.getIoU_DOMRect(topScoredSegment.matched.node, cur_segment.matched.node, true);
                    
                    if (IoU < ROLE_NMS_IOU_THRESHOLD) { // Not overlapped
                    // if (IoU < ROLE_NMS_IOU_THRESHOLD || GUIModelMap.roleMap[cur_segment.detection.name] === "content") { // Not overlapped
                        afterNMS.push(cur_segment);
                    }
                    else if (IoU >= MERGE_IOU_THRESHOLD) { // highly overlapped detection boxes
                        const sourceNode = topScoredSegment.matched.node;
                        const targetNode = cur_segment.matched.node;

                        // Compare parent/child relationship
                        if (targetNode.contains(sourceNode)) {
                            // Switch the top scored segment's DOM node
                            topScoredSegment.matched = cur_segment.matched;
                        }
                    }
                }
                cur_segments = afterNMS;
            }
        }

        const ROLE_AGNOSTIC_NMS_IOU_THRESHOLD = 0.7; 

        const NMS_2_output_segments = [];
        while(NMS_1_output_segments.length > 0) {
            const sourceSegment = NMS_1_output_segments.shift();

            let index = NMS_1_output_segments.length - 1;
            const cur_overlap_segments = [];
            while (index >= 0) {
                const targetSegment = NMS_1_output_segments[index];
                const IoU = this.getIoU_DOMRect(sourceSegment.matched.node, targetSegment.matched.node, true);
                if (IoU >= ROLE_AGNOSTIC_NMS_IOU_THRESHOLD) {
                    cur_overlap_segments.push(targetSegment);
                    NMS_1_output_segments.splice(index, 1); // Remove one segment from index
                }
                index--;
            }

            if (cur_overlap_segments.length == 0) {
                NMS_2_output_segments.push(sourceSegment);
                continue;
            }

            cur_overlap_segments.push(sourceSegment);
            let best = {
                score: -100,
                segment: null
            }
            for (const cur_segment of cur_overlap_segments) { // Find best scored segment
                let cur_score = cur_segment.detection.score;

                if (best.score < cur_score) {
                    best.score = cur_score;
                    best.segment = cur_segment;
                }
            }

            NMS_2_output_segments.push(best.segment);
        }
        
        return NMS_2_output_segments;
    }

    /**
     * @browsing_Task_Specific_Labeling
     */
    browsingTaskLabeling(segments) {
        // Set task-specific label
        if (this.prevActionTargetSegment) {
            const prevTargetName = this.prevActionTargetSegment.detection.name;
            if (prevTargetName == "search") { // Search results labelled segment should be unique on the page
                const matched = {
                    area: -1000,
                    index: -1
                }
                segments.forEach((segment, index) => {
                    if (segment.detection.name == "content-list") {
                        // TODO naive solution - get segment which has biggest area
                        const area = (segment.matched.nodeRect.xmax - segment.matched.nodeRect.xmin)
                            * (segment.matched.nodeRect.ymax - segment.matched.nodeRect.ymin);

                        if (area > matched.area) {
                            matched.area = area;
                            matched.index = index;
                        }
                    }
                });
                if (matched.index > -1) {
                    segments[matched.index].label = "search-results";
                }
            }
        }

        return segments;
    }

    /**
    * @Tree_Construction for ordered navigation (e.g., Screen Reader)
    */
    constructTree() {
        // 1. Make segments and segmentNodes have a same indexing
        const segmentList = new Array();
        const segmentNodes = new Array();
        for (const segment of this.segmentedScreen.topSemanticSegmentList) {
            segmentList.push(segment);
            this.segmentedScreen.totalSegmentList.push(segment);
            segmentNodes.push(segment.matchedNode);

            if (segment.navCollection) {
                for (const collection of segment.flattedNavCollections) {
                    if (collection.matchedNode !== segment.matchedNode 
                            && this.getIoU_DOMRect(segment.matchedNode, collection.matchedNode, true) < 0.8 ) {
                        // Push the navCollections if segment node and collection node are different
                        
                        segmentList.push(collection);
                        this.segmentedScreen.totalSegmentList.push(collection);
                        segmentNodes.push(collection.matchedNode);
                    }
                }
                for (const navItem of segment.flattedNavItems) {
                    segmentList.push(navItem);
                    this.segmentedScreen.totalSegmentList.push(navItem);
                    segmentNodes.push(navItem.matchedNode);
                }
            }

            if (segment.basicCollection) {
                if (segment.basicCollection.matchedNode !== segment.matchedNode 
                        && this.getIoU_DOMRect(segment.matchedNode, segment.basicCollection.matchedNode, true) < 0.8) {
                    
                    segmentList.push(segment.basicCollection);
                    this.segmentedScreen.totalSegmentList.push(segment.basicCollection);
                    segmentNodes.push(segment.basicCollection.matchedNode);
                }
                for (const itemSegment of segment.basicCollection.items) {
                    segmentList.push(itemSegment);
                    this.segmentedScreen.totalSegmentList.push(itemSegment);
                    segmentNodes.push(itemSegment.matchedNode);
                }
            }
        }

        // 2. Recursive call to construct the semantic tree (Top-down)
        function tree(cur_node, prev_segment) {
            let cur_segment = prev_segment;
            const index = segmentNodes.indexOf(cur_node);
            if (index > -1) {
                cur_segment = segmentList[index]; // found any segment matched to current node iteration, passing the segment to next recursive function

                // Set parent and chlid relationship
                cur_segment.parentSegment = prev_segment;
                prev_segment.childSegments.push(cur_segment);

                segmentNodes.splice(index, 1);
                segmentList.splice(index, 1);
                if (segmentNodes.length <= 0) {
                    // console.log("All segment pushed in children of root");
                    return;
                }
            }

            // Recursive calls to current node's children
            Array.from(cur_node.children).forEach((child) => {
                tree(child, cur_segment);
            });
        }

        tree(document.documentElement, this.segmentedScreen);
    }

    layout() {
        // Set adjacency relationship

        const MEANINGFUL_DIFF_THRESHOLD = 2;

        function setAdjacency(segmentList) {
            for (let i = 0; i < segmentList.length; i++) {
                let left_aligned = null, right_aligned = null, top_aligned = null, bottom_aligned = null;
                const sourceRect = segmentList[i].matchedNodeRect;
    
                for (let j = 0; j < segmentList.length; j++) {
                    if (i == j) continue; // Skip calc distance b.t.w. the same node

                    const candidateRect = segmentList[j].matchedNodeRect;
                    
                    // Left aligned segment
                    if (sourceRect.xmin >= candidateRect.xmax) { // For any left aligned segment
                        if (left_aligned) {
                            if (Math.abs(candidateRect.xmax - left_aligned.matchedNodeRect.xmax) <= MEANINGFUL_DIFF_THRESHOLD) {
                                const y_overlap_previous = Math.max(0, (Math.min(sourceRect.ymax, left_aligned.matchedNodeRect.ymax) - Math.max(sourceRect.ymin, left_aligned.matchedNodeRect.ymin)));
                                const y_overlap_new = Math.max(0, (Math.min(sourceRect.ymax, candidateRect.ymax) - Math.max(sourceRect.ymin, candidateRect.ymin)));

                                if (y_overlap_previous >= 0.1 && y_overlap_new >= 0.1) { // Both candidates are overlapped
                                    if (candidateRect.ymin < left_aligned.matchedNodeRect.ymin) { // If new candidate has smaller ymin
                                        left_aligned = segmentList[j];
                                    }
                                } else if (y_overlap_previous < 0.1 && y_overlap_new >= 0.1) { // Only new candidate is overlapped
                                    left_aligned = segmentList[j];
                                }
                            } else { // Update left aligned to the closer one in x-axis
                                if (candidateRect.xmax > left_aligned.matchedNodeRect.xmax) {
                                    left_aligned = segmentList[j];
                                }
                            }
                        }
                        else {
                            left_aligned = segmentList[j];
                        }
                    }
    
                    // Right aligned segment
                    if (sourceRect.xmax <= candidateRect.xmin) { // For any right aligned segment
                        if (right_aligned) {
                            if (Math.abs(candidateRect.xmin - right_aligned.matchedNodeRect.xmin) <= MEANINGFUL_DIFF_THRESHOLD) {
                                const y_overlap_previous = Math.max(0, (Math.min(sourceRect.ymax, right_aligned.matchedNodeRect.ymax) - Math.max(sourceRect.ymin, right_aligned.matchedNodeRect.ymin)));
                                const y_overlap_new = Math.max(0, (Math.min(sourceRect.ymax, candidateRect.ymax) - Math.max(sourceRect.ymin, candidateRect.ymin)));

                                if (y_overlap_previous >= 0.1 && y_overlap_new >= 0.1) { // Both candidates are overlapped
                                    if (candidateRect.ymin < right_aligned.matchedNodeRect.ymin) { // If new candidate has smaller ymin
                                        right_aligned = segmentList[j];
                                    }
                                } else if (y_overlap_previous < 0.1 && y_overlap_new >= 0.1) { // Only new candidate is overlapped
                                    right_aligned = segmentList[j];
                                }
                            } else { // Update right aligned to the closer one in x-axis
                                if (candidateRect.xmin < right_aligned.matchedNodeRect.xmin) {
                                    right_aligned = segmentList[j];
                                }
                            }
                        }
                        else {
                            right_aligned = segmentList[j];
                        }
                    }
    
                    // Top aligned segment
                    if (sourceRect.ymin >= candidateRect.ymax) { // For any top aligned segment
                        if (top_aligned) {
                            if (Math.abs(candidateRect.ymax - top_aligned.matchedNodeRect.ymax) <= MEANINGFUL_DIFF_THRESHOLD) {
                                const x_overlap_previous = Math.max(0, (Math.min(sourceRect.xmax, top_aligned.matchedNodeRect.xmax) - Math.max(sourceRect.xmin, top_aligned.matchedNodeRect.xmin)));
                                const x_overlap_new = Math.max(0, (Math.min(sourceRect.xmax, candidateRect.xmax) - Math.max(sourceRect.xmin, candidateRect.xmin)));

                                if (x_overlap_previous >= 0.1 && x_overlap_new >= 0.1) { // Both candidates are overlapped
                                    if (candidateRect.xmin < top_aligned.matchedNodeRect.xmin) { // If new candidate has smaller xmin
                                        top_aligned = segmentList[j];
                                    }
                                } else if (x_overlap_previous < 0.1 && x_overlap_new >= 0.1) { // Only new candidate is overlapped
                                    top_aligned = segmentList[j];
                                }
                            } else { // Update top aligned to the closer one in y-axis
                                if (candidateRect.ymax > top_aligned.matchedNodeRect.ymax) {
                                    top_aligned = segmentList[j];
                                }
                            }
                        }
                        else {
                            top_aligned = segmentList[j];
                        }
                    }
    
                    // Bottom aligned segment
                    if (sourceRect.ymax <= candidateRect.ymin) { // For any bottom aligned segment
                        if (bottom_aligned) {
                            if (Math.abs(candidateRect.ymin - bottom_aligned.matchedNodeRect.ymin) <= MEANINGFUL_DIFF_THRESHOLD) {                                 
                                const x_overlap_previous = Math.max(0, (Math.min(sourceRect.xmax, bottom_aligned.matchedNodeRect.xmax) - Math.max(sourceRect.xmin, bottom_aligned.matchedNodeRect.xmin)));
                                const x_overlap_new = Math.max(0, (Math.min(sourceRect.xmax, candidateRect.xmax) - Math.max(sourceRect.xmin, candidateRect.xmin)));

                                if (x_overlap_previous >= 0.1 && x_overlap_new >= 0.1) { // Both candidates are overlapped
                                    if (candidateRect.xmin < bottom_aligned.matchedNodeRect.xmin) { // If new candidate has smaller xmin
                                        bottom_aligned = segmentList[j];
                                    }
                                } else if (x_overlap_previous < 0.1 && x_overlap_new >= 0.1) { // Only new candidate is overlapped
                                    bottom_aligned = segmentList[j];
                                }
                            } else { // Update bottom aligned to the closer one in y-axis
                                if (candidateRect.ymin < bottom_aligned.matchedNodeRect.ymin) {
                                    bottom_aligned = segmentList[j];
                                }
                            }
                        }
                        else {
                            bottom_aligned = segmentList[j];
                        }
                    }
                }
    
                if (left_aligned) segmentList[i].alignLeftSegment = left_aligned;
                if (right_aligned) segmentList[i].alignRightSegment = right_aligned;
                if (top_aligned) segmentList[i].alignTopSegment = top_aligned;
                if (bottom_aligned) segmentList[i].alignBottomSegment = bottom_aligned;
            }
        }
        
        function semanticTreeTraverse(segment) {
            if (segment.childSegments.length < 1) return;

            setAdjacency(segment.childSegments);

            for (const childSegment of segment.childSegments) {
                semanticTreeTraverse(childSegment);
            }
        }

        semanticTreeTraverse(this.segmentedScreen);
    }

    setRelationship() {
        /**
         * Comments, Chat-panel
         */
        let targets = [];
        targets = targets.concat(this.segmentedScreen.getSegmentsByUIType("comments"));
        targets = targets.concat(this.segmentedScreen.getSegmentsByUIType("chat-panel"));

        // Find "form" segment
        loop1:
        for (const target of targets) {
            // from children
            for (const childSegment of target.childSegments) {
                if (childSegment.UIType === "form") {
                    target.messageInput = childSegment;
                    continue loop1;
                }
            }
            // from adjacency map
            for (const adjacentSegment of [target.alignTopSegment, target.alignBottomSegment, target.alignLeftSegment, target.alignRightSegment]) {
                if (adjacentSegment && adjacentSegment.UIType === "form") {
                    target.messageInput = adjacentSegment;
                    continue loop1;
                }
            }
        }
    }

    /**
     * parseGUIScreen
     */
    parseGUIScreen(detections, screen_width, screen_height, prevActionTarget) {
        this.detections = detections;
        this.screen_width = screen_width;
        this.screen_height = screen_height;
        this.prevActionTargetSegment = prevActionTarget;

        console.log('[Start parsing]');
        const GUIModelExtractionStartTime = performance.now();

        /**
         * 1. Web GUI segmentation
         */
        const segments_initial = this.webGUISegmentation();

        /**
         * 2. Semantic NMS
         */
        const segments_suppresed = this.semanticNMS(segments_initial);

        /**
         * 3. Browsing task related labeling
         */
        const segment_objects = this.browsingTaskLabeling(segments_suppresed);
        
        /**
         * 4. Class instantiation
         */
        const instances = [];
        for (const object of segment_objects) {
            // Store segment instance with higest score first
            const segment = new GUIModelMap.typeMap[object.detection.name](object);
            instances.push(segment);
        }
        this.segmentedScreen.topSemanticSegmentList = instances;

        /**
         * 5. Tree Construction
         */
        this.constructTree();

        /**
         * 6. Adjacency Map Setup
         */
        this.layout();

        /**
         * 7. Relationships
         */
        this.setRelationship();
        
        /**@Performance_Evaluation */
        globalOnModelExtractedTime = performance.now();

        console.log("[onLoad]", globalOnLoadTime);
        console.log("[onRender] ", globalOnRenderTime);

        const detectingTime = globalDetectionEndTime - globalDetectionStartTime;
        const GUImodelConstructingTime = globalOnModelExtractedTime - GUIModelExtractionStartTime;

        console.log("[GUIModelExtractionEnd]", globalOnRenderTime + detectingTime + GUImodelConstructingTime);

        console.log("@@@@@@@@@@@@@@@@@@@@@@[GUI Model Extraction Processing Time]@@@@@@@@@@@@@@@@@@@@@@");
        console.log("[detecting time]", detectingTime);
        console.log("[GUI model construction time]", GUImodelConstructingTime);

        /**@Screen_Parsed_Callback */
        if (this.screenParsedCallback) {
            this.screenParsedCallback(segment_objects, this.segmentedScreen);
        }
    }

    // Callback function as a parameter
    onScreenParsed(callback) {
        this.screenParsedCallback = callback;
    }
}

let screenRoot = null;

/**
 * @Communication_channels_with_background
 */
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    switch (request.method) {
        case "startParse": { // Need to parse
            const detections = request.params.detections;
            const screen_width = request.params.screen_width;
            const screen_height = request.params.screen_height;
            globalDetectionStartTime = request.params.globalDetectionStartTime;
            globalDetectionEndTime = request.params.globalDetectionEndTime;

            let prevActionTarget = null;
            if (request.params.prevActionTarget) prevActionTarget = request.params.prevActionTarget;

            const screenParser = new GUIModelExtractor();

            screenParser.onScreenParsed(function (segment_objects, segmentedScreen) {

                // Send parsed result to background
                chrome.runtime.sendMessage({
                    method: "screenParsed",
                    params: {
                        screen_width: screen_width,
                        screen_height: screen_height,
                        detections: detections,
                        segments: segment_objects,
                        url: location.href,
                        hostname: location.hostname,
                    }
                }, function (response) {
                    // return;
                });

                screenRoot = segmentedScreen;
                console.log("[Segmented Screen]", segmentedScreen);
            });

            screenParser.parseGUIScreen(detections, screen_width, screen_height, prevActionTarget);

            break;
        }

        case "alreadyParsed": { // Already parsed before
            const pageContext = request.params.pageContext;
            const segments = restoreSegmentsInstance(pageContext.segments);
            initSeamlisInterfaces(segments);

            GUI_SEGMENTS = segments;

            console.log("GUI_segment", segments);
            break;
        }
    }
});

/**
 * @Detect_page_changed_event
 *      1. Page load event (newly loaded or reloaded)
 *      2. Page URL changed event (also appeared in background onUpdated)
 *      3. onpopstate event (page back or forward)
 * 
 * @From_background
 *      4. chrome.tabs.onUpdated
 */
function requestScreenParse() {
    // chrome.runtime.sendMessage({
    //     method: "pageInitiallyLoaded",
    //     params: {
    //         url: location.href,
    //         hostname: location.hostname
    //     }
    // }, function (response) {
    //     return;
    // });

    chrome.runtime.sendMessage({ method: "requestScreenParse"}, function (resp) {});
}

let targetResources = new Array();
let resource_num = 0;

const resource_observer = new PerformanceObserver(function (list) {
    for (const entry of list.getEntries()) {
        // console.log('Resource entry', entry);
        targetResources.push(entry);
    }
});

const layout_shift_observer = new PerformanceObserver(function (list) {
    for (const entry of list.getEntries()) {
        // console.log('layout-shift entry', entry);
        targetResources.push(entry);
    }
});

resource_observer.observe({ entryTypes: ["resource"] });
layout_shift_observer.observe({ entryTypes: ["layout-shift"] });

window.addEventListener("DOMContentLoaded", function (event) {

    /**@Performance_Evaluation */
    globalDOMLoadedTime = performance.now();

    targetResources = new Array();
    resource_num = 0;

    const interval = setInterval(function () {
        if (targetResources.length == resource_num) {

            /**@Performance_Evaluation */
            globalOnRenderTime = performance.now();

            clearInterval(interval);
        } else {
            resource_num = targetResources.length;
        }
    }, 50);
})

window.addEventListener("load", function (event) {
    /**@Performance_Evaluation */
    globalOnLoadTime = performance.now();
    console.log("[onload event]", globalOnLoadTime);
});

// Page URL change listener
let lastUrl = location.href;
new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
        lastUrl = url;

        console.log("[URL changed - Mutation Observer]");

        targetResources = new Array();
        resource_num = 0;

        const interval = setInterval(function () {
            if (targetResources.length == resource_num) {
                clearInterval(interval);
            } else {
                resource_num = targetResources.length;
            }
        }, 100);
    }
}).observe(document, { subtree: true, childList: true });