# MAUI: Model-driven Development Tool for Advanced Web User Interfaces

## Web GUI Dataset

[Download_Here](https://www.dropbox.com/scl/fo/zcbd1rhxor5o792od3m33/AL_cKcqJ3mt_oQb6_eIy_k0?rlkey=k8f7hd1omnw1o0mu70wx7ebym&st=ot7i9jhg&dl=0)

We build a dataset to train the object detection model that extracts sections, important regions in a web page, from page screenshot. High-quality annotations of the bounding boxes covering the whole area of ground-truth sections effectively increase the accuracy of the trained network. To this end, we implemented a tool for labeling the exact bounding boxes of sections by selecting associated DOM elements directly on a page. As a Chrome extension program, the tool supports an intuitive selection mechanism for DOM elements by hovering and clicking via the mouse to label their bounding boxes on a page screenshot. As most pages have overlapping elements on a single point, the tool provides a method for hovering the hierarchical path of the current element (e.g., click-and-wheelup). When the user selects an element, the tool displays a pop-up to decide its GUI type. The tool automatically stores a screenshot and an annotation file after the user has finished the labeling process on a page. 

* We manually constructed a high-quality dataset using the tool and double-checked the collected and annotated data. The dataset consists of 3,452 annotated screenshots captured from web pages. Along with each image file, corresponding XML file for annotations is also included. 

* Our annotation tool can be used to further increase the dataset. The tool is implemented as a browser extension and can be easily used in any Chromium-based browsers by simply loading it on a browser.

## Model Checkpoints

We split the collected dataset into training and validation sets with a ratio of 8:2. Using the dataset, we validated the performance of multiple state-of-the-art object detection networks and selected the EfficientDet series with EfficientNet backbones considering the accuracy-latency trade-off. We fine-tuned the EfficientDet-D0 and D3 with some modifications of the training configurations (e.g., anchor box settings). For privacy-preserving in-browser deployment, we converted the trained detection network to TensorFlow.js.

Released TensorFlow.js model checkpoints
- [EfficientDet-D0](https://www.dropbox.com/scl/fo/5blfa4hzzhwhab2g88bgk/AFjD1E1Wd541MGc5qYNtm4c?rlkey=cdsvn14aer8cp8iwb18huullb&st=fxrx86k5&dl=0)
- [EfficientDet-D3](https://www.dropbox.com/scl/fo/qtxy4gy99g0oragjl0feb/AAaz8rocntnCGRyvjTszCNQ?rlkey=x8dc23s108m8kj13yuelrpcp6&st=6vksnkjz&dl=0)
