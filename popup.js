var browser = browser || chrome;

const vm = new Vue({
    el: "#app",
    data() {
        return {
            message: '',
            credentials: {
                username: "",
                password: "",
            },
            media: browser.extension.getBackgroundPage().media,
            queue: browser.extension.getBackgroundPage().media.queue,
            mediaInfo: {},
            dupbit: browser.extension.getBackgroundPage().dupbit,
        }
    },
    methods: {
        login: async function() {
            const result = await this.dupbit.login(this.credentials.username, this.credentials.password);
            console.log(result);
            await this.dupbit.reconnect();
        },
        download: function() {
            this.mediaInfo.artist = this.mediaInfo.artist.replace(/[\\/:*?"<>|]/g, "");
            this.mediaInfo.title = this.mediaInfo.title.replace(/[\\/:*?"<>|]/g, "");
            console.log(this.mediaInfo);
            this.media.download(this.mediaInfo);
        },
        shortenString(string, length=27) {
            if (string.length > length) {
                return string.substring(0,length-3) + "...";
            } else {
                return string;
            }
        },
        setFocus: function() {
            this.$refs.artist.select();
            this.$refs.artist.focus();
        },
        showScreenMessage: function() {
            return this.message.length;
        },
        showScreenDownload: function() {
            return !this.showScreenLogin() && Object.keys(this.mediaInfo).length;
        },
        showScreenQueue: function() {
            return !this.showScreenLogin() && this.queue.length;
        },
        showScreenLogin: function() {
            return !(this.dupbit && this.dupbit.authenticated);
        }
    },
});

function injectScript(tab) {
    return new Promise((resolve) => {
        browser.tabs.sendMessage(tab.id, {event: "ping"}, async (response) => {
            if (response && response.event === "pong") {
                console.log("injected in:", tab.url);
                resolve();
            } else {
                console.log(tab);
                await browser.tabs.executeScript(tab.id, {
                    file: "src/inject/all.js",
                });
                resolve(injectScript(tab));
            }
        });
    });
}

browser.tabs.query({active: true, currentWindow: true}, async (tabList) => {
    const tab = tabList[0];
    await vm.dupbit._validateToken();

    if (tab.url.includes("chrome://")) return console.log("not injected on:", tab.url);

    await injectScript(tab);
    browser.tabs.sendMessage(tab.id, {event: "getSongInfo"}, (response) => {
        if (response) {
            vm.mediaInfo = response;
            vm.setFocus();
        }
    });
});

