var browser = browser || chrome;

browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.event) return;
    console.log(request);
    if (request.hasOwnProperty("action")) {
        let result;
        if (request.action === "info") {
            result = info();
        } else {
            result = executeOnPage(request.action, request.value);
        }
        sendResponse(result);
    }
});

function info() {
    return {
        volume: {
            muted: executeOnPage("isMuted"),
            volume: executeOnPage("getVolume"),
        },
        time: {
            duration: executeOnPage("getDuration"),
            current_time: executeOnPage("getCurrentTime"),
        },
        url: executeOnPage("getVideoUrl"),
        state: executeOnPage("getPlayerState"),
    };
}

function executeOnPage(action, value) {
    const scriptContent = `document.body.setAttribute('tmp_${action}', document.getElementById("movie_player").${action}(${value}));`
    const script = document.createElement('script');
    script.id = `tmpScript_${action}`;
    script.appendChild(document.createTextNode(scriptContent));
    (document.body || document.head || document.documentElement).appendChild(script);

    const result = document.body.getAttribute(`tmp_${action}`);

    document.body.removeAttribute(`tmp_${action}`);

    return result;
}

// const youtube = {
//     play: document.getElementById("movie_player").playVideo,
//     // play: () => {
//     //     const button = document.getElementsByClassName("ytp-play-button")[0];
//     //     if (button.getAttribute("aria-label") === "Play") {
//     //         button.click();
//     //         return {
//     //             success: true,
//     //             message: "Video paused",
//     //         };
//     //     } else {
//     //         return {
//     //             success: false,
//     //             message: "Video already playing"
//     //         };
//     //     }
//     // },
//     pause: document.getElementById("movie_player").pauseVideo,
//     stop: document.getElementById("movie_player").stopVideo,
//     seekTo: document.getElementById("movie_player").seekTo,
//     loadVideoByUrl: document.getElementById("movie_player").loadVideoByUrl,
//     loadVideoById: document.getElementById("movie_player").loadVideoById,
//     next: document.getElementById("movie_player").nextVideo,
//     previous: document.getElementById("movie_player").previousVideo,
//     info: () => {
//         return {
//             volume: {
//                 muted: executeOnPage("isMuted"),
//                 volume: executeOnPage("getVolume"),
//             },
//             time: {
//                 duration: executeOnPage("getDuration"),
//                 current_time: executeOnPage("getCurrentTime"),
//             },
//             url: executeOnPage("getVideoUrl"),
//             state: executeOnPage("getPlayerState"),
//         };
//     }
//     //https://suggestqueries.google.com/complete/search?client=youtube&ds=yt&client=firefox&q=${}
// };
