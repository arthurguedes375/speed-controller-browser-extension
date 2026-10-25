(() => {
    'use strict';

    const NORMAL_SPEED = 1.0;
    const FAST_SPEED = 2.0;
    const MIN_SPEED = 0.2;
    const SPEED_STEP = 0.1;
    const EDGE_GAP = 12;
    const MIN_VIDEO_WIDTH = 70;
    const MIN_VIDEO_HEIGHT = 40;

    /**
     * One state per video.
     * The original video element is never reparented or given
     * layout-changing styles.
     */
    const videoStates = new Map();
    const observedRoots = new WeakSet();

    let selectedVideo = null;
    let playSequence = 0;
    let positionFrame = 0;
    let resizeObserver = null;

    const approximatelyEqual = (a, b) => Math.abs(a - b) < 0.001;

    function setImportantStyle(element, property, value) {
        element.style.setProperty(property, value, 'important');
    }

    /**
     * Check whether a video is visible and large enough to control.
     */
    function isVideoVisible(video) {
        if (!video.isConnected) return false;

        const rect = video.getBoundingClientRect();

        if (rect.width < MIN_VIDEO_WIDTH ||
            rect.height < MIN_VIDEO_HEIGHT) {
            return false;
        }

        if (rect.bottom <= 0 ||
            rect.top >= window.innerHeight ||
            rect.right <= 0 ||
            rect.left >= window.innerWidth) {
            return false;
        }

        const style = window.getComputedStyle(video);

        return style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            style.visibility !== 'collapse' &&
            Number(style.opacity) !== 0;
    }

    /**
     * Create an independent overlay.
     *
     * The overlay is not inserted into the video's parent and does not
     * wrap or move the video. Its Shadow DOM isolates its internal CSS.
     */
    function createOverlay(video) {
        const host = document.createElement(
            'speed-controller-overlay'
        );

        setImportantStyle(host, 'all', 'initial');
        setImportantStyle(host, 'position', 'fixed');
        setImportantStyle(host, 'left', '0px');
        setImportantStyle(host, 'top', '0px');
        setImportantStyle(host, 'transform', 'translateX(0)');
        setImportantStyle(host, 'z-index', '2147483647');
        setImportantStyle(host, 'display', 'block');
        setImportantStyle(host, 'width', 'max-content');
        setImportantStyle(host, 'height', 'auto');
        setImportantStyle(host, 'margin', '0');
        setImportantStyle(host, 'padding', '0');
        setImportantStyle(host, 'border', '0');
        setImportantStyle(host, 'background', 'transparent');
        setImportantStyle(host, 'pointer-events', 'none');
        setImportantStyle(host, 'user-select', 'none');
        setImportantStyle(host, 'visibility', 'visible');
        setImportantStyle(host, 'opacity', '1');

        const shadow = host.attachShadow({
            mode: 'open'
        });

        const style = document.createElement('style');

        style.textContent = `
            :host {
                contain: layout style;
            }

            .badge {
                box-sizing: border-box;
                display: inline-flex;
                align-items: center;

                padding: 5px 10px;
                border: 0;
                border-radius: 10px;

                background: rgba(0, 0, 0, 0.5);
                color: rgba(255, 255, 255, 0.5);

                font: 600 15px/1.2 system-ui, -apple-system,
                    BlinkMacSystemFont, sans-serif;

                white-space: nowrap;
/*                 box-shadow: 0 1px 4px rgba(0, 0, 0, 0.25); */
                pointer-events: none;
                user-select: none;
                -webkit-user-select: none;
            }
        `;

        const badge = document.createElement('span');

        badge.className = 'badge';
        badge.textContent =
            `${Number(video.playbackRate).toFixed(1)}×`;

        shadow.append(style, badge);

        return {
            host,
            badge
        };
    }

    /**
     * When a player wrapper is fullscreen, mount the overlay inside that
     * fullscreen subtree. Otherwise, mount it under documentElement.
     */
    function getOverlayMountPoint(video) {
        const fullscreenElement = document.fullscreenElement;

        if (
            fullscreenElement &&
            fullscreenElement !== video &&
            fullscreenElement.contains(video)
        ) {
            return fullscreenElement;
        }

        return document.documentElement;
    }

    /**
     * Position a single overlay at its video's top-right corner.
     */
    function updateOneOverlay(video, state) {
        const { host } = state;

        /*
         * If the video element itself is fullscreen, ordinary DOM siblings
         * cannot reliably appear above it. Hide the overlay in that case.
         */
        if (document.fullscreenElement === video) {
            setImportantStyle(host, 'display', 'none');
            return;
        }

        const mountPoint = getOverlayMountPoint(video);

        if (host.parentNode !== mountPoint) {
            mountPoint.appendChild(host);
        }

        if (!isVideoVisible(video)) {
            setImportantStyle(host, 'display', 'none');
            return;
        }

        const rect = video.getBoundingClientRect();

        const left = Math.max(
            EDGE_GAP,
            rect.left + EDGE_GAP
        );

        const top = Math.max(
            EDGE_GAP,
            rect.top + EDGE_GAP
        );

        setImportantStyle(host, 'display', 'block');
        setImportantStyle(host, 'left', `${left}px`);
        setImportantStyle(host, 'top', `${top}px`);
    }

    /**
     * Update the position of every registered overlay.
     */
    function updateAllOverlays() {
        for (const [video, state] of videoStates) {
            updateOneOverlay(video, state);
        }
    }

    /**
     * Determine whether any visible video is currently playing.
     */
    function hasVisiblePlayingVideo() {
        for (const video of videoStates.keys()) {
            if (
                !video.paused &&
                !video.ended &&
                isVideoVisible(video)
            ) {
                return true;
            }
        }

        return false;
    }

    /**
     * Schedule one animation-frame update.
     *
     * While a visible video is playing, continue tracking layout changes.
     */
    function schedulePositionUpdate() {
        if (positionFrame) return;

        positionFrame = window.requestAnimationFrame(() => {
            positionFrame = 0;

            updateAllOverlays();

            if (hasVisiblePlayingVideo()) {
                schedulePositionUpdate();
            }
        });
    }

    /**
     * Set playback speed and update the badge.
     */
    function setPlaybackRate(video, state, speed) {
        if (!Number.isFinite(speed) || speed <= 0) {
            return;
        }

        try {
            if (!approximatelyEqual(video.playbackRate, speed)) {
                video.playbackRate = speed;
            }
        } catch (error) {
            console.warn(
                '[Speed Controller] Could not set playback rate:',
                error
            );
        }

        state.badge.textContent =
            `${Number(video.playbackRate).toFixed(1)}×`;
    }

    /**
     * Toggle between a preset and the previously saved custom speed.
     *
     * G and R share the same saved restore speed.
     *
     * Example:
     *   Start at 3.5
     *   G -> 2.0
     *   R -> 1.0
     *   R -> 3.5
     *
     * Switching between G and R never overwrites the saved 3.5 speed.
     */
    function togglePreset(video, state, targetSpeed) {
        const currentSpeed = video.playbackRate;

        if (approximatelyEqual(currentSpeed, targetSpeed)) {
            const restoreSpeed = Number.isFinite(state.restoreSpeed)
                ? state.restoreSpeed
                : NORMAL_SPEED;

            state.presetActive = false;

            setPlaybackRate(
                video,
                state,
                restoreSpeed
            );

            return;
        }

        /*
         * Save the speed only when entering preset mode.
         * Switching between G and R preserves this value.
         */
        if (!state.presetActive) {
            state.restoreSpeed = currentSpeed;
        }

        state.presetActive = true;

        setPlaybackRate(
            video,
            state,
            targetSpeed
        );
    }

    /**
     * Increase or decrease playback speed.
     */
    function adjustSpeed(video, state, delta) {
        const nextSpeed = Math.max(
            MIN_SPEED,
            Math.round(
                (video.playbackRate + delta) * 10
            ) / 10
        );

        state.restoreSpeed = nextSpeed;
        state.presetActive = false;

        setPlaybackRate(
            video,
            state,
            nextSpeed
        );
    }

    /**
     * Register a video and install only the event listeners it needs.
     *
     * This function never moves the video element in the DOM.
     */
    function registerVideo(video) {
        if (
            !video ||
            video.tagName !== 'VIDEO' ||
            videoStates.has(video)
        ) {
            return;
        }

        const { host, badge } = createOverlay(video);

        const state = {
            host,
            badge,

            restoreSpeed:
                Number(video.playbackRate) || NORMAL_SPEED,

            presetActive: false,
            playOrder: 0,

            onRateChange: null,
            onPlay: null,
            onPause: null
        };

        state.onRateChange = () => {
            badge.textContent =
                `${Number(video.playbackRate).toFixed(1)}×`;
        };

        state.onPlay = () => {
            state.playOrder = ++playSequence;
            schedulePositionUpdate();
        };

        state.onPause = () => {
            schedulePositionUpdate();
        };

        videoStates.set(video, state);

        if (resizeObserver) {
            resizeObserver.observe(video);
        }

        video.addEventListener(
            'ratechange',
            state.onRateChange
        );

        video.addEventListener(
            'play',
            state.onPlay
        );

        video.addEventListener(
            'playing',
            state.onPlay
        );

        video.addEventListener(
            'pause',
            state.onPause
        );

        video.addEventListener(
            'ended',
            state.onPause
        );

        if (!video.paused && !video.ended) {
            state.playOrder = ++playSequence;
        }

        schedulePositionUpdate();
    }

    /**
     * Remove event listeners and overlays belonging to videos that have
     * been removed from the document.
     */
    function removeDisconnectedVideos() {
        for (const [video, state] of videoStates) {
            if (video.isConnected) {
                continue;
            }

            video.removeEventListener(
                'ratechange',
                state.onRateChange
            );

            video.removeEventListener(
                'play',
                state.onPlay
            );

            video.removeEventListener(
                'playing',
                state.onPlay
            );

            video.removeEventListener(
                'pause',
                state.onPause
            );

            video.removeEventListener(
                'ended',
                state.onPause
            );

            if (resizeObserver) {
                resizeObserver.unobserve(video);
            }

            state.host.remove();
            videoStates.delete(video);

            if (selectedVideo === video) {
                selectedVideo = null;
            }
        }
    }

    /**
     * Search a subtree for video elements.
     *
     * Open Shadow DOM roots are also inspected.
     * Closed Shadow DOM roots cannot be inspected this way.
     */
    function scanSubtree(rootNode) {
        const stack = [];

        if (rootNode instanceof Element) {
            stack.push(rootNode);
        } else if (
            rootNode instanceof Document ||
            rootNode instanceof DocumentFragment
        ) {
            for (const child of rootNode.children || []) {
                stack.push(child);
            }
        } else {
            return;
        }

        while (stack.length) {
            const element = stack.pop();

            if (element.tagName === 'VIDEO') {
                registerVideo(element);
            }

            if (element.shadowRoot) {
                observeRoot(element.shadowRoot);

                for (const child of element.shadowRoot.children) {
                    stack.push(child);
                }
            }

            for (const child of element.children) {
                stack.push(child);
            }
        }
    }

    /**
     * One observer handles the document and any discoverable open
     * Shadow DOM roots.
     */
    const mutationObserver = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                scanSubtree(node);
            }
        }

        removeDisconnectedVideos();
        schedulePositionUpdate();
    });

    /**
     * Observe a document or Shadow DOM root exactly once.
     */
    function observeRoot(root) {
        if (observedRoots.has(root)) {
            return;
        }

        observedRoots.add(root);

        mutationObserver.observe(root, {
            childList: true,
            subtree: true
        });

        scanSubtree(root);
    }

    /**
     * Check whether an element is an editable input or text field.
     */
    function isEditableElement(element) {
        if (!(element instanceof Element)) {
            return false;
        }

        if (
            element.matches(
                'input, textarea, select, [role="textbox"]'
            )
        ) {
            return true;
        }

        if (element.isContentEditable) {
            return true;
        }

        const editableAncestor = element.closest(
            '[contenteditable]:not([contenteditable="false"])'
        );

        return Boolean(editableAncestor);
    }

    /**
     * Avoid changing playback when the user is typing.
     *
     * composedPath() also helps detect editable elements inside open
     * Shadow DOM roots.
     */
    function isTypingContext(event) {
        if (
            document.designMode &&
            document.designMode.toLowerCase() === 'on'
        ) {
            return true;
        }

        const path =
            typeof event.composedPath === 'function'
                ? event.composedPath()
                : [event.target];

        if (path.some(isEditableElement)) {
            return true;
        }

        return isEditableElement(document.activeElement);
    }

    /**
     * Check whether a point falls inside a visible video.
     */
    function isVideoAtPoint(video, x, y) {
        if (!isVideoVisible(video)) {
            return false;
        }

        const rect = video.getBoundingClientRect();

        return (
            x >= rect.left &&
            x <= rect.right &&
            y >= rect.top &&
            y <= rect.bottom
        );
    }

    /**
     * Find the video under the pointer.
     *
     * First prefer an actual video element in elementsFromPoint().
     * If the site's controls cover it, fall back to the smallest visible
     * video rectangle containing the pointer.
     */
    function findVideoAtPoint(x, y) {
        for (const element of document.elementsFromPoint(x, y)) {
            if (
                element.tagName === 'VIDEO' &&
                videoStates.has(element) &&
                isVideoAtPoint(element, x, y)
            ) {
                return element;
            }
        }

        let bestVideo = null;
        let bestArea = Infinity;

        for (const video of videoStates.keys()) {
            if (!isVideoAtPoint(video, x, y)) {
                continue;
            }

            const rect = video.getBoundingClientRect();
            const area = rect.width * rect.height;

            if (area < bestArea) {
                bestArea = area;
                bestVideo = video;
            }
        }

        return bestVideo;
    }

    /**
     * Track which video the user most recently clicked.
     *
     * Capture phase allows us to identify the video even when a site's
     * own player controls handle the pointer event.
     *
     * The handler deliberately does not cancel or stop mouse events.
     */
    document.addEventListener(
        'pointerdown',
        (event) => {
            if (isTypingContext(event)) {
                return;
            }

            selectedVideo = findVideoAtPoint(
                event.clientX,
                event.clientY
            );
        },
        true
    );

    /**
     * Choose the video affected by keyboard shortcuts.
     *
     * Preference:
     * 1. The video the user most recently selected by clicking.
     * 2. The most recently started visible video still playing.
     */
    function getShortcutVideo() {
        if (
            selectedVideo &&
            videoStates.has(selectedVideo) &&
            isVideoVisible(selectedVideo)
        ) {
            return selectedVideo;
        }

        let newestVideo = null;
        let newestOrder = -1;

        for (const [video, state] of videoStates) {
            if (
                video.paused ||
                video.ended ||
                !isVideoVisible(video)
            ) {
                continue;
            }

            if (state.playOrder > newestOrder) {
                newestOrder = state.playOrder;
                newestVideo = video;
            }
        }

        return newestVideo;
    }

    /**
     * Install exactly one keyboard handler for the whole extension.
     */
    document.addEventListener(
        'keydown',
        (event) => {
            /*
             * Do not intercept:
             * - Auto-repeated keys
             * - IME composition
             * - Ctrl, Alt, or Meta shortcuts
             * - Typing in an input or editable field
             */
            if (
                // event.repeat ||
                event.isComposing ||
                event.ctrlKey ||
                event.altKey ||
                event.metaKey ||
                isTypingContext(event)
            ) {
                return;
            }


            const key = event.key.toLowerCase();

            if (!['g', 'r', 'd', 's'].includes(key)) {
                return;
            }

            // Does not toggle very fast between 'g' and 'r'
            if (event.repeat && ['g', 'r'].includes(key)) {
                return
            }

            const video = getShortcutVideo();

            if (!video) {
                return;
            }

            const state = videoStates.get(video);

            if (!state) {
                return;
            }

            switch (key) {
                case 'g':
                    togglePreset(
                        video,
                        state,
                        FAST_SPEED
                    );
                    break;

                case 'r':
                    togglePreset(
                        video,
                        state,
                        NORMAL_SPEED
                    );
                    break;

                case 'd':
                    adjustSpeed(
                        video,
                        state,
                        SPEED_STEP
                    );
                    break;

                case 's':
                    adjustSpeed(
                        video,
                        state,
                        -SPEED_STEP
                    );
                    break;
            }

            /*
             * Consume recognized shortcuts only after a video has been
             * selected. Mouse and video-control events remain untouched.
             */
            event.preventDefault();
            event.stopPropagation();
        },
        true
    );

    /**
     * Update overlay positioning when the page scrolls, resizes, or
     * changes fullscreen state.
     */
    window.addEventListener(
        'scroll',
        schedulePositionUpdate,
        true
    );

    window.addEventListener(
        'resize',
        schedulePositionUpdate,
        true
    );

    document.addEventListener(
        'fullscreenchange',
        schedulePositionUpdate,
        true
    );

    document.addEventListener(
        'webkitfullscreenchange',
        schedulePositionUpdate,
        true
    );

    if (window.visualViewport) {
        window.visualViewport.addEventListener(
            'scroll',
            schedulePositionUpdate
        );

        window.visualViewport.addEventListener(
            'resize',
            schedulePositionUpdate
        );
    }

    /**
     * Observe video size changes without altering page layout.
     */
    resizeObserver = new ResizeObserver(
        schedulePositionUpdate
    );

    console.log('[Speed Controller] Loaded');

    /**
     * Scan all existing videos and observe future additions.
     */
    observeRoot(document);
    schedulePositionUpdate();
})();
