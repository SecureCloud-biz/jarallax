
// Deferred
// thanks http://stackoverflow.com/questions/18096715/implement-deferred-object-without-using-jquery
function Deferred() {
    this._done = [];
    this._fail = [];
}
Deferred.prototype = {
    execute(list, args) {
        let i = list.length;
        args = Array.prototype.slice.call(args);
        while (i--) {
            list[i].apply(null, args);
        }
    },
    resolve() {
        this.execute(this._done, arguments);
    },
    reject() {
        this.execute(this._fail, arguments);
    },
    done(callback) {
        this._done.push(callback);
    },
    fail(callback) {
        this._fail.push(callback);
    },
};

// init events
function addEventListener(el, eventName, handler) {
    if (el.addEventListener) {
        el.addEventListener(eventName, handler);
    } else {
        el.attachEvent(`on${eventName}`, () => {
            handler.call(el);
        });
    }
}

let ID = 0;
let YoutubeAPIadded = 0;
let VimeoAPIadded = 0;
let loadingYoutubePlayer = 0;
let loadingVimeoPlayer = 0;
const loadingYoutubeDeffer = new Deferred();
const loadingVimeoDeffer = new Deferred();

class VideoWorker {
    constructor(url, options) {
        const _this = this;

        _this.url = url;

        _this.options_default = {
            autoplay: 1,
            loop: 1,
            mute: 1,
            volume: 0,
            controls: 0,

            // start / end video time in ms
            startTime: 0,
            endTime: 0,
        };

        _this.options = _this.extend({}, _this.options_default, options);

        // check URL
        _this.videoID = _this.parseURL(url);

        // init
        if (_this.videoID) {
            _this.ID = ID++;
            _this.loadAPI();
            _this.init();
        }
    }

    // Extend like jQuery.extend
    extend(out) {
        out = out || {};
        Object.keys(arguments).forEach((i) => {
            if (!arguments[i]) {
                return;
            }
            Object.keys(arguments[i]).forEach((key) => {
                out[key] = arguments[i][key];
            });
        });
        return out;
    }

    parseURL(url) {
        // parse youtube ID
        function getYoutubeID(ytUrl) {
            // eslint-disable-next-line no-useless-escape
            const regExp = /.*(?:youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=)([^#\&\?]*).*/;
            const match = ytUrl.match(regExp);
            return match && match[1].length === 11 ? match[1] : false;
        }

        // parse vimeo ID
        function getVimeoID(vmUrl) {
            // eslint-disable-next-line no-useless-escape
            const regExp = /https?:\/\/(?:www\.|player\.)?vimeo.com\/(?:channels\/(?:\w+\/)?|groups\/([^\/]*)\/videos\/|album\/(\d+)\/video\/|video\/|)(\d+)(?:$|\/|\?)/;
            const match = vmUrl.match(regExp);
            return match && match[3] ? match[3] : false;
        }

        // parse local string
        function getLocalVideos(locUrl) {
            // eslint-disable-next-line no-useless-escape
            const videoFormats = locUrl.split(/,(?=mp4\:|webm\:|ogv\:|ogg\:)/);
            const result = {};
            let ready = 0;
            videoFormats.forEach((val) => {
                // eslint-disable-next-line no-useless-escape
                const match = val.match(/^(mp4|webm|ogv|ogg)\:(.*)/);
                if (match && match[1] && match[2]) {
                    result[match[1] === 'ogv' ? 'ogg' : match[1]] = match[2];
                    ready = 1;
                }
            });
            return ready ? result : false;
        }

        const Youtube = getYoutubeID(url);
        const Vimeo = getVimeoID(url);
        const Local = getLocalVideos(url);

        if (Youtube) {
            this.type = 'youtube';
            return Youtube;
        } else if (Vimeo) {
            this.type = 'vimeo';
            return Vimeo;
        } else if (Local) {
            this.type = 'local';
            return Local;
        }

        return false;
    }

    isValid() {
        return !!this.videoID;
    }

    // events
    on(name, callback) {
        this.userEventsList = this.userEventsList || [];

        // add new callback in events list
        (this.userEventsList[name] || (this.userEventsList[name] = [])).push(callback);
    }
    off(name, callback) {
        if (!this.userEventsList || !this.userEventsList[name]) {
            return;
        }

        if (!callback) {
            delete this.userEventsList[name];
        } else {
            this.userEventsList[name].forEach((val, key) => {
                if (val === callback) {
                    this.userEventsList[name][key] = false;
                }
            });
        }
    }
    fire(name) {
        const args = [].slice.call(arguments, 1);
        if (this.userEventsList && typeof this.userEventsList[name] !== 'undefined') {
            this.userEventsList[name].forEach((val) => {
                // call with all arguments
                if (val) {
                    val.apply(this, args);
                }
            });
        }
    }

    play(start) {
        const _this = this;
        if (!_this.player) {
            return;
        }

        if (_this.type === 'youtube' && _this.player.playVideo) {
            if (typeof start !== 'undefined') {
                _this.player.seekTo(start || 0);
            }
            if (YT.PlayerState.PLAYING !== _this.player.getPlayerState()) {
                _this.player.playVideo();
            }
        }

        if (_this.type === 'vimeo') {
            if (typeof start !== 'undefined') {
                _this.player.setCurrentTime(start);
            }
            _this.player.getPaused().then((paused) => {
                if (paused) {
                    _this.player.play();
                }
            });
        }

        if (_this.type === 'local') {
            if (typeof start !== 'undefined') {
                _this.player.currentTime = start;
            }
            if (_this.player.paused) {
                _this.player.play();
            }
        }
    }

    pause() {
        const _this = this;
        if (!_this.player) {
            return;
        }

        if (_this.type === 'youtube' && _this.player.pauseVideo) {
            if (YT.PlayerState.PLAYING === _this.player.getPlayerState()) {
                _this.player.pauseVideo();
            }
        }

        if (_this.type === 'vimeo') {
            _this.player.getPaused().then((paused) => {
                if (!paused) {
                    _this.player.pause();
                }
            });
        }

        if (_this.type === 'local') {
            if (!_this.player.paused) {
                _this.player.pause();
            }
        }
    }

    getImageURL(callback) {
        const _this = this;

        if (_this.videoImage) {
            callback(_this.videoImage);
            return;
        }

        if (_this.type === 'youtube') {
            const availableSizes = [
                'maxresdefault',
                'sddefault',
                'hqdefault',
                '0',
            ];
            let step = 0;

            const tempImg = new Image();
            tempImg.onload = function () {
                // if no thumbnail, youtube add their own image with width = 120px
                if ((this.naturalWidth || this.width) !== 120 || step === availableSizes.length - 1) {
                    // ok
                    _this.videoImage = `https://img.youtube.com/vi/${_this.videoID}/${availableSizes[step]}.jpg`;
                    callback(_this.videoImage);
                } else {
                    // try another size
                    step++;
                    this.src = `https://img.youtube.com/vi/${_this.videoID}/${availableSizes[step]}.jpg`;
                }
            };
            tempImg.src = `https://img.youtube.com/vi/${_this.videoID}/${availableSizes[step]}.jpg`;
        }

        if (_this.type === 'vimeo') {
            let request = new XMLHttpRequest();
            request.open('GET', `https://vimeo.com/api/v2/video/${_this.videoID}.json`, true);
            request.onreadystatechange = function () {
                if (this.readyState === 4) {
                    if (this.status >= 200 && this.status < 400) {
                        // Success!
                        const response = JSON.parse(this.responseText);
                        _this.videoImage = response[0].thumbnail_large;
                        callback(_this.videoImage);
                    } else {
                        // Error :(
                    }
                }
            };
            request.send();
            request = null;
        }
    }

    getIframe(callback) {
        const _this = this;

        // return generated iframe
        if (_this.$iframe) {
            callback(_this.$iframe);
            return;
        }

        // generate new iframe
        _this.onAPIready(() => {
            let hiddenDiv;
            if (!_this.$iframe) {
                hiddenDiv = document.createElement('div');
                hiddenDiv.style.display = 'none';
            }

            // Youtube
            if (_this.type === 'youtube') {
                _this.playerOptions = {};
                _this.playerOptions.videoId = _this.videoID;
                _this.playerOptions.playerVars = {
                    autohide: 1,
                    rel: 0,
                    autoplay: 0,
                };

                // hide controls
                if (!_this.options.controls) {
                    _this.playerOptions.playerVars.iv_load_policy = 3;
                    _this.playerOptions.playerVars.modestbranding = 1;
                    _this.playerOptions.playerVars.controls = 0;
                    _this.playerOptions.playerVars.showinfo = 0;
                    _this.playerOptions.playerVars.disablekb = 1;
                }

                // events
                let ytStarted;
                let ytProgressInterval;
                _this.playerOptions.events = {
                    onReady(e) {
                        // mute
                        if (_this.options.mute) {
                            e.target.mute();
                        } else if (_this.options.volume) {
                            e.target.setVolume(_this.options.volume);
                        }

                        // autoplay
                        if (_this.options.autoplay) {
                            _this.play(_this.options.startTime);
                        }
                        _this.fire('ready', e);
                    },
                    onStateChange(e) {
                        // loop
                        if (_this.options.loop && e.data === YT.PlayerState.ENDED) {
                            _this.play(_this.options.startTime);
                        }
                        if (!ytStarted && e.data === YT.PlayerState.PLAYING) {
                            ytStarted = 1;
                            _this.fire('started', e);
                        }
                        if (e.data === YT.PlayerState.PLAYING) {
                            _this.fire('play', e);
                        }
                        if (e.data === YT.PlayerState.PAUSED) {
                            _this.fire('pause', e);
                        }
                        if (e.data === YT.PlayerState.ENDED) {
                            _this.fire('end', e);
                        }

                        // check for end of video and play again or stop
                        if (_this.options.endTime) {
                            if (e.data === YT.PlayerState.PLAYING) {
                                ytProgressInterval = setInterval(() => {
                                    if (_this.options.endTime && _this.player.getCurrentTime() >= _this.options.endTime) {
                                        if (_this.options.loop) {
                                            _this.play(_this.options.startTime);
                                        } else {
                                            _this.pause();
                                        }
                                    }
                                }, 150);
                            } else {
                                clearInterval(ytProgressInterval);
                            }
                        }
                    },
                };

                const firstInit = !_this.$iframe;
                if (firstInit) {
                    const div = document.createElement('div');
                    div.setAttribute('id', _this.playerID);
                    hiddenDiv.appendChild(div);
                    document.body.appendChild(hiddenDiv);
                }
                _this.player = _this.player || new window.YT.Player(_this.playerID, _this.playerOptions);
                if (firstInit) {
                    _this.$iframe = document.getElementById(_this.playerID);

                    // get video width and height
                    _this.videoWidth = parseInt(_this.$iframe.getAttribute('width'), 10) || 1280;
                    _this.videoHeight = parseInt(_this.$iframe.getAttribute('height'), 10) || 720;
                }
            }

            // Vimeo
            if (_this.type === 'vimeo') {
                _this.playerOptions = '';

                _this.playerOptions += `player_id=${_this.playerID}`;
                _this.playerOptions += '&autopause=0';

                // hide controls
                if (!_this.options.controls) {
                    _this.playerOptions += '&badge=0&byline=0&portrait=0&title=0';
                }

                // autoplay
                _this.playerOptions += `&autoplay=${_this.options.autoplay ? '1' : '0'}`;

                // loop
                _this.playerOptions += `&loop=${_this.options.loop ? 1 : 0}`;

                if (!_this.$iframe) {
                    _this.$iframe = document.createElement('iframe');
                    _this.$iframe.setAttribute('id', _this.playerID);
                    _this.$iframe.setAttribute('src', `https://player.vimeo.com/video/${_this.videoID}?${_this.playerOptions}`);
                    _this.$iframe.setAttribute('frameborder', '0');
                    hiddenDiv.appendChild(_this.$iframe);
                    document.body.appendChild(hiddenDiv);
                }

                _this.player = _this.player || new Vimeo.Player(_this.$iframe);

                // get video width and height
                _this.player.getVideoWidth().then((width) => {
                    _this.videoWidth = width || 1280;
                });
                _this.player.getVideoHeight().then((height) => {
                    _this.videoHeight = height || 720;
                });

                // set current time for autoplay
                if (_this.options.startTime && _this.options.autoplay) {
                    _this.player.setCurrentTime(_this.options.startTime);
                }

                // mute
                if (_this.options.mute) {
                    _this.player.setVolume(0);
                } else if (_this.options.volume) {
                    _this.player.setVolume(_this.options.volume);
                }

                let vmStarted;
                _this.player.on('timeupdate', (e) => {
                    if (!vmStarted) {
                        _this.fire('started', e);
                    }
                    vmStarted = 1;

                    // check for end of video and play again or stop
                    if (_this.options.endTime) {
                        if (_this.options.endTime && e.seconds >= _this.options.endTime) {
                            if (_this.options.loop) {
                                _this.play(_this.options.startTime);
                            } else {
                                _this.pause();
                            }
                        }
                    }
                });
                _this.player.on('play', (e) => {
                    _this.fire('play', e);

                    // check for the start time and start with it
                    if (_this.options.startTime && e.seconds === 0) {
                        _this.play(_this.options.startTime);
                    }
                });
                _this.player.on('pause', (e) => {
                    _this.fire('pause', e);
                });
                _this.player.on('ended', (e) => {
                    _this.fire('end', e);
                });
                _this.player.on('loaded', (e) => {
                    _this.fire('ready', e);
                });
            }

            // Local
            function addSourceToLocal(element, src, type) {
                const source = document.createElement('source');
                source.src = src;
                source.type = type;
                element.appendChild(source);
            }
            if (_this.type === 'local') {
                if (!_this.$iframe) {
                    _this.$iframe = document.createElement('video');

                    // mute
                    if (_this.options.mute) {
                        _this.$iframe.muted = true;
                    } else if (_this.$iframe.volume) {
                        _this.$iframe.volume = _this.options.volume / 100;
                    }

                    // loop
                    if (_this.options.loop) {
                        _this.$iframe.loop = true;
                    }

                    _this.$iframe.setAttribute('id', _this.playerID);
                    hiddenDiv.appendChild(_this.$iframe);
                    document.body.appendChild(hiddenDiv);

                    Object.keys(_this.videoID).forEach((key) => {
                        addSourceToLocal(_this.$iframe, _this.videoID[key], `video/${key}`);
                    });
                }

                _this.player = _this.player || _this.$iframe;

                let locStarted;
                addEventListener(_this.player, 'playing', (e) => {
                    if (!locStarted) {
                        _this.fire('started', e);
                    }
                    locStarted = 1;
                });
                addEventListener(_this.player, 'timeupdate', function () {
                    // check for end of video and play again or stop
                    if (_this.options.endTime) {
                        if (_this.options.endTime && this.currentTime >= _this.options.endTime) {
                            if (_this.options.loop) {
                                _this.play(_this.options.startTime);
                            } else {
                                _this.pause();
                            }
                        }
                    }
                });
                addEventListener(_this.player, 'play', (e) => {
                    _this.fire('play', e);
                });
                addEventListener(_this.player, 'pause', (e) => {
                    _this.fire('pause', e);
                });
                addEventListener(_this.player, 'ended', (e) => {
                    _this.fire('end', e);
                });
                addEventListener(_this.player, 'loadedmetadata', function () {
                    // get video width and height
                    _this.videoWidth = this.videoWidth || 1280;
                    _this.videoHeight = this.videoHeight || 720;

                    _this.fire('ready');

                    // autoplay
                    if (_this.options.autoplay) {
                        _this.play(_this.options.startTime);
                    }
                });
            }

            callback(_this.$iframe);
        });
    }

    init() {
        const _this = this;

        _this.playerID = `VideoWorker-${_this.ID}`;
    }

    loadAPI() {
        const _this = this;

        if (YoutubeAPIadded && VimeoAPIadded) {
            return;
        }

        let src = '';

        // load Youtube API
        if (_this.type === 'youtube' && !YoutubeAPIadded) {
            YoutubeAPIadded = 1;
            src = 'https://www.youtube.com/iframe_api';
        }

        // load Vimeo API
        if (_this.type === 'vimeo' && !VimeoAPIadded) {
            VimeoAPIadded = 1;
            src = 'https://player.vimeo.com/api/player.js';
        }

        if (!src) {
            return;
        }

        // add script in head section
        let tag = document.createElement('script');
        let head = document.getElementsByTagName('head')[0];
        tag.src = src;

        head.appendChild(tag);

        head = null;
        tag = null;
    }

    onAPIready(callback) {
        const _this = this;

        // Youtube
        if (_this.type === 'youtube') {
            // Listen for global YT player callback
            if ((typeof YT === 'undefined' || YT.loaded === 0) && !loadingYoutubePlayer) {
                // Prevents Ready event from being called twice
                loadingYoutubePlayer = 1;

                // Creates deferred so, other players know when to wait.
                window.onYouTubeIframeAPIReady = function () {
                    window.onYouTubeIframeAPIReady = null;
                    loadingYoutubeDeffer.resolve('done');
                    callback();
                };
            } else if (typeof YT === 'object' && YT.loaded === 1) {
                callback();
            } else {
                loadingYoutubeDeffer.done(() => {
                    callback();
                });
            }
        }

        // Vimeo
        if (_this.type === 'vimeo') {
            if (typeof Vimeo === 'undefined' && !loadingVimeoPlayer) {
                loadingVimeoPlayer = 1;
                const vimeoInterval = setInterval(() => {
                    if (typeof Vimeo !== 'undefined') {
                        clearInterval(vimeoInterval);
                        loadingVimeoDeffer.resolve('done');
                        callback();
                    }
                }, 20);
            } else if (typeof Vimeo !== 'undefined') {
                callback();
            } else {
                loadingVimeoDeffer.done(() => {
                    callback();
                });
            }
        }

        // Local
        if (_this.type === 'local') {
            callback();
        }
    }
}

window.VideoWorker = VideoWorker;


/*!
 * Name    : Video Background Extension for Jarallax
 * Version : 1.0.0
 * Author  : nK http://nkdev.info
 * GitHub  : https://github.com/nk-o/jarallax
 */
(function () {
    if (typeof jarallax === 'undefined') {
        return;
    }

    const Jarallax = jarallax.constructor;

    // append video after init Jarallax
    const defInit = Jarallax.prototype.init;
    Jarallax.prototype.init = function () {
        const _this = this;

        defInit.apply(_this);

        if (_this.video) {
            _this.video.getIframe((iframe) => {
                const $parent = iframe.parentNode;
                _this.css(iframe, {
                    position: _this.image.position,
                    top: '0px',
                    left: '0px',
                    right: '0px',
                    bottom: '0px',
                    width: '100%',
                    height: '100%',
                    maxWidth: 'none',
                    maxHeight: 'none',
                    margin: 0,
                    zIndex: -1,
                });
                _this.$video = iframe;
                _this.image.$container.appendChild(iframe);

                // remove parent iframe element (created by VideoWorker)
                $parent.parentNode.removeChild($parent);
            });
        }
    };

    // cover video
    const defCoverImage = Jarallax.prototype.coverImage;
    Jarallax.prototype.coverImage = function () {
        const _this = this;
        const imageData = defCoverImage.apply(_this);
        const node = _this.image.$item.nodeName;

        if (imageData && _this.video && (node === 'IFRAME' || node === 'VIDEO')) {
            let h = imageData.image.height;
            let w = h * _this.image.width / _this.image.height;
            let ml = (imageData.container.width - w) / 2;
            let mt = imageData.image.marginTop;

            if (imageData.container.width > w) {
                w = imageData.container.width;
                h = w * _this.image.height / _this.image.width;
                ml = 0;
                mt += (imageData.image.height - h) / 2;
            }

            // add video height over than need to hide controls
            if (node === 'IFRAME') {
                h += 400;
                mt -= 200;
            }

            _this.css(_this.$video, {
                width: `${w}px`,
                marginLeft: `${ml}px`,
                height: `${h}px`,
                marginTop: `${mt}px`,
            });
        }

        return imageData;
    };

    // init video
    const defInitImg = Jarallax.prototype.initImg;
    Jarallax.prototype.initImg = function () {
        const _this = this;
        const defaultResult = defInitImg.apply(_this);

        if (!_this.options.videoSrc) {
            _this.options.videoSrc = _this.$item.getAttribute('data-jarallax-video') || null;
        }

        if (_this.options.videoSrc) {
            _this.defaultInitImgResult = defaultResult;
            return true;
        }

        return defaultResult;
    };

    const defCanInitParallax = Jarallax.prototype.canInitParallax;
    Jarallax.prototype.canInitParallax = function () {
        const _this = this;
        const defaultResult = defCanInitParallax.apply(_this);

        if (!_this.options.videoSrc) {
            return defaultResult;
        }

        const video = new VideoWorker(_this.options.videoSrc, {
            startTime: _this.options.videoStartTime || 0,
            endTime: _this.options.videoEndTime || 0,
            mute: _this.options.videoVolume ? 0 : 1,
            volume: _this.options.videoVolume || 0,
        });

        if (video.isValid()) {
            // if parallax will not be inited, we can add thumbnail on background.
            if (!defaultResult) {
                if (!_this.defaultInitImgResult) {
                    video.getImageURL((url) => {
                        // save default user styles
                        const curStyle = _this.$item.getAttribute('style');
                        if (curStyle) {
                            _this.$item.setAttribute('data-jarallax-original-styles', curStyle);
                        }

                        // set new background
                        _this.css(_this.$item, {
                            'background-image': `url("${url}")`,
                            'background-position': 'center',
                            'background-size': 'cover',
                        });
                    });
                }

                // init video
            } else {
                _this.image.useImgTag = true;

                video.on('ready', () => {
                    if (_this.options.videoPlayOnlyVisible) {
                        const oldOnScroll = _this.onScroll;
                        _this.onScroll = function () {
                            oldOnScroll.apply(_this);
                            if (_this.isVisible()) {
                                video.play();
                            } else {
                                video.pause();
                            }
                        };
                    } else {
                        video.play();
                    }
                });

                video.on('started', () => {
                    _this.image.$default_item = _this.image.$item;
                    _this.image.$item = _this.$video;

                    // set video width and height
                    _this.image.width = _this.video.videoWidth || 1280;
                    _this.image.height = _this.video.videoHeight || 720;
                    _this.options.imgWidth = _this.image.width;
                    _this.options.imgHeight = _this.image.height;
                    _this.coverImage();
                    _this.clipContainer();
                    _this.onScroll();

                    // hide image
                    if (_this.image.$default_item) {
                        _this.image.$default_item.style.display = 'none';
                    }
                });

                _this.video = video;

                // set image if not exists
                if (!_this.defaultInitImgResult) {
                    if (video.type !== 'local') {
                        video.getImageURL((url) => {
                            _this.image.src = url;
                            _this.init();
                        });

                        return false;
                    }

                    // set empty image on local video if not defined
                    _this.image.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
                    return true;
                }
            }
        }

        return defaultResult;
    };

    // Destroy video parallax
    const defDestroy = Jarallax.prototype.destroy;
    Jarallax.prototype.destroy = function () {
        const _this = this;

        if (_this.image.$default_item) {
            _this.image.$item = _this.image.$default_item;
            delete _this.image.$default_item;
        }

        defDestroy.apply(_this);
    };

    // data-jarallax-video initialization
    addEventListener(window, 'DOMContentLoaded', () => {
        jarallax(document.querySelectorAll('[data-jarallax-video]'));
    });
}());
