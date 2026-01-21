const localStorageKeys = {
    lastVelocity: 'speed-last-velocity'
}
let lastVel = 1.0;

/**
    * @param {Element} node
    *
    */
const renderSpeedController = (node) => {
    const ATTRIBUTE_KEY = 'data-has-added'

    if (!node || node.tagName !== "VIDEO" || node.getAttribute(ATTRIBUTE_KEY)) {
        return
    }


    node.setAttribute(ATTRIBUTE_KEY, true);
    const lastVelStorageString = localStorage.getItem(localStorageKeys.lastVelocity);
    if (lastVelStorageString) {
        const parsedLast = JSON.parse(lastVelStorageString);
        lastVel = parsedLast;
        node.playbackRate = parsedLast || '1.0';
    }

    const containerDiv = document.createElement("div");
    containerDiv.style.cssText = `
width: fit-content;
height: fit-content;
position: relative;
    `;
    node.parentElement.appendChild(containerDiv)

    const controllerDiv = document.createElement('div');
    controllerDiv.style.cssText = `
    position: absolute;
    left: 300px;
    top: 25px;
    padding: 5px 10px;

    border-radius: 10px;
    background: rgba(0, 0, 0, 0.5);

    display: flex;
    flex-direction: row;
    z-index: 50;
    `;
    const playbackRateSpan = document.createElement('span');
    playbackRateSpan.style.cssText = `
font-weight: 600;
font-size: 17px;
color: rgba(255, 255, 255, 0.5);
    `;
    const updateSpeedSpan = (value) => {
        playbackRateSpan.textContent = value.toFixed(1);
    }
    updateSpeedSpan(node.playbackRate);
    lastVel = node.playbackRate;

    controllerDiv.appendChild(playbackRateSpan);

    containerDiv.appendChild(controllerDiv)
    containerDiv.appendChild(node);

    const handleChangeSpeed = (targetSpeed) => {
        const current = node.playbackRate;
        if (current == targetSpeed) {
            node.playbackRate = lastVel;
        } else {
            lastVel = current;
            node.playbackRate = targetSpeed;
        }
    }

    const saveToLocal = () => {

    }

    // Events
    node.addEventListener('ratechange', (__e) => {
        updateSpeedSpan(node.playbackRate)
    })

    document.addEventListener('keydown', (e) => {
        const handlers = {
            'R': () => {
                handleChangeSpeed(1.0)
            },
            'G': () => {
                handleChangeSpeed(2.0)
            },
            'D': () => {
                node.playbackRate += 0.1;
                lastVel = node.playbackRate;
            },
            'S': () => {
                if (node.playbackRate > 0.2) {
                    node.playbackRate -= 0.1;
                    lastVel = node.playbackRate;
                }
            }
        }
        handlers[e.key.toUpperCase()]?.();
        updateSpeedSpan(node.playbackRate);
        localStorage.setItem(localStorageKeys.lastVelocity, JSON.stringify(node.playbackRate));
    })
}

const loadVideos = () => {
    const videos = [...document.querySelectorAll('video')];
    console.log("Got videos", videos)

    for (const video of videos) {
        renderSpeedController(video);
    }
}

const observer = new MutationObserver((mutations) => {
    loadVideos();
    /* for (const mutation of mutations) {
        // If a new video tag was added
        for (const node of mutation.addedNodes) {
            console.log("Got node", node instanceof Element, node.tagName);
            if (node instanceof Element && node.tagName === 'VIDEO') {
                renderSpeedController(node)
            }
        }
    } */
})

console.log("Speed Controller Loaded");
loadVideos();


observer.observe(document.querySelector('body'), {
    childList: true,
})
