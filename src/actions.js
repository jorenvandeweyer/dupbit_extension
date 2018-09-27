var browser = browser || chrome;

Actions = {
    allPlayers: () => {
        return _allPlayers();
    },
    createPlayer: (data) => {
        browser.tabs.create({ url: data.body.url });
    },
    controlPlayer: (data) => {
        const body = data.body;
        console.log(body.action, body.value, body.tabId);
        return new Promise((resolve, reject) => {
            browser.tabs.sendMessage(body.tabId, {
                action: body.action, 
                value: body.value
            }, (response) => {
                resolve(response);
            });
        });
    }
};

function _allPlayers() {
    const supported = ["youtube.com", "soundcloud.com"];

    return new Promise((resolve, reject) => {
        const tabs = [];
        browser.windows.getAll({ populate:true}, (windows) => {
            windows.forEach((window) => {
                window.tabs.forEach((tab) => {
                    supported.forEach((domain) => {
                        if (tab.url.includes(domain)) {
                            tabs.push({id: tab.id, url: tab.url, playing: tab.audible});
                        }
                    })
                });
            });
            resolve(tabs);
        });
    });
}

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
