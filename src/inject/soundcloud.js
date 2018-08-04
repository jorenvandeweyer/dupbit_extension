var browser = browser || chrome;

browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.event) return;
    console.log(request);
    if (request.hasOwnProperty("action")) {
        let result;
        if (request.action === "info") {
            result = soundcloud.info();
        } else {
            result = soundcloud[request.action](request.value);
        }
        sendResponse(result);
    }
});

const soundcloud = {
    info: function () {
        return {
        	volume: {
        		muted: this.isMuted(),
                volume: this.getVolume(),
            },
        	time: {
                duration: this.getDuration(),
                current_time: this.getCurrentTime(),
        	},
        	url: this.getUrl(),
        	state: this.getPlayerState(),
        };
    },
    isPlaying: function() {
        return document.querySelector(".playControls__play").classList.contains("playing");;
    },
    playVideo: function() {
        if (!this.isPlaying()) {
            return document.querySelector(".playControls__play").click()
        } else {
            return false;
        }
    },
    pauseVideo: function() {
        if (this.isPlaying()) {
            return document.querySelector(".playControls__play").click()
        } else {
            return false;
        }
    },
    isMuted: function() {
        return document.querySelector(".playControls__volume .volume").classList.contains("muted");
    },
    getVolume: function() {
        return document.querySelector(".playControls__volume .volume").getAttribute("data-level")*10;
    },
    setVolume: function(volume) {
        return false;
    },
    nextVideo: function() {
        return document.querySelector(".skipControl__next").click();
    },
    previousVideo: function() {
        return document.querySelector(".skipControl__previous").click();
    },
    getPlayerState: function() {
        return this.isPlaying() ? "1" : "2";
    },
    getDuration: function() {
        return document.querySelector(".playbackTimeline__progressWrapper").getAttribute("aria-valuemax");
    },
    getCurrentTime: function() {
        return document.querySelector(".playbackTimeline__progressWrapper").getAttribute("aria-valuenow");
    },
    getUrl: function() {
        return document.querySelector(".playbackSoundBadge a").href;
    }
}
