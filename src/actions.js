var browser = browser || chrome;

Actions = {
    youtube: (action, value) => {
        return new Promise(async (resolve, reject) => {
            const yt_tab = await _findYoutube();
            if (!yt_tab) return resolve({
                success: false,
                reason: "No youtube clients open",
            });
            browser.tabs.sendMessage(yt_tab.id, {action, value}, (response) => {
                resolve(response);
            });
        });
    }
};

function _findYoutube() {
    return new Promise((resolve, reject) => {
        let youtube_tab = null;

        browser.windows.getAll({ populate:true }, (windows) => {
            windows.forEach((window) => {
                window.tabs.forEach((tab) => {
                    if (tab.url.includes("youtube.com")) {
                        if (!youtube_tab) {
                            youtube_tab = tab;
                        } else if (!youtube_tab.audible && tab.audible){
                            youtube_tab = tab;
                        }
                    }
                });
            });

            resolve(youtube_tab);
        });
    });
}
