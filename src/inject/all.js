chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.event === "ping") return sendResponse({event: "pong"});
    if (events.hasOwnProperty(request.event)) {
        const data = events[request.event]();
        console.log(data);
        sendResponse(data);
    }
});

console.log("running");

const events = {
    hasMedia: () => {
        return supported.hasOwnProperty(location.host);
    },
    getSongInfo: () => {
        if (events.hasMedia()) return supported[location.host]();
        return null;
    }
};

const supported = {
    "www.youtube.com": () => {
        const videoTitle = document.querySelector(".title .ytd-video-primary-info-renderer").innerText;
        const [artist, title] = parseVideoTitle(videoTitle);

        return {
            url: location.href,
            title,
            artist,
            provider: "youtube",
        };
    },
    "soundcloud.com": () => {
        const videoTitle = document.querySelector(".playbackSoundBadge__titleLink").title;
        const [artist, title] = parseVideoTitle(videoTitle);

        return {
            url: document.querySelector(".playbackSoundBadge a").href,
            title,
            artist,
            provider: "soundcloud",
        };
    }
};

function parseVideoTitle(t) {
    t = t.replace(/[\\\/:*?"<>|]/g, "");
    const artist = t.includes(" - ") ? t.split(" - ")[0] : "";
    const title = t.includes(" - ") ? t.split(" - ")[1] : t;

    return [artist, title];
}
