var browser = browser || chrome;

class Media {
    constructor(mediaInfo) {
        this.mediaInfo = mediaInfo;
        console.log(mediaInfo);
        this.init();
    }

    init() {
        this.media = browser.extension.getBackgroundPage().media;

        this.titleField = document.getElementById("title");
        this.artistField = document.getElementById("artist");
        this.queueTable = document.getElementById("queueTable");

        this.getQueue();
        this.showDownload();
    }

    getQueue() {
        this.queue = this.media.queue;
        for (let qid in this.queue) {
            const item = this.queue[qid];
            this.addToQueue(qid, item.artist, item.title, item.readyState);
        }
        this.showQueue();

        this.media.on("addToQueue", (data) => {
            this.addToQueue(data.qid, data.artist, data.title, data.readyState);
        });
    }

    showQueue() {
        if (this.queue.length > 0) {
            document.getElementById("queue").style.display = "block";
        }
    }

    addToQueue(qid, artist, title, readyState) {
        const imgSrc = readyState ? "ready.png" : "loading.gif";
        const row = createElement(`<tr id="qid_${qid}"><td>${artist}</td><td>${title}</td><td><img width='16px' src='images/${imgSrc}'/></td></tr>`, "tbody");
        const progressRow = createElement(`<tr id="qid_progress_${qid}"><td colspan='3'><div class='progress' style='height:10px;'><div class='progress-bar progress-bar-striped active' role='progressbar' style='width:0%'></div></div></td></tr>`, "tbody");
        this.queueTable.prepend(progressRow);
        this.queueTable.prepend(row);
        this.showQueue();
    }

    updateQueueReadyState(qid) {
        this.queueTable.querySelector(`#qid_${qid} img`).setAttribute("src", "images/ready.png");
    }

    updateProgress(qid, percentage) {
        const progressBar = this.queueTable.querySelector(`#qid_progress_${qid} .progress-bar`);
        if (percentage == 100) {
            progressBar.style.width = percentage +"%";
            progressBar.classList.remove("progress-bar-striped");
            progressBar.classList.remove("active");
            progressBar.classList.add("progress-bar-success");
        }
        else {
            progressBar.style.width = percentage +"%";
        }
    }

    showDownload() {
        this.artistField.value = this.mediaInfo.artist;
        this.titleField.value = this.mediaInfo.title;

        document.getElementById("download").style.display = "block";
        this.titleField.select();
    }

    async download() {
        const artist = this.artistField.value.replace(/[\\\/:*?"<>|]/g, "");
        const title = this.titleField.value.replace(/[\\\/:*?"<>|]/g, "");

        Object.assign(this.mediaInfo, {
            remote: true,
            artist,
            title,
        });

        const result = await this.media.download(this.mediaInfo).then((result) => {
            this.updateQueueReadyState(result.qid);
        });
    }
}

class Message {
    static show(string) {
        document.querySelector("#message span").innerText = string;
        document.getElementById("message").style.display = "block";
    }

    static hide() {
        document.getElementById("message").style.display = "none";
    }
}

async function init(tab) {
    const session = browser.extension.getBackgroundPage().session;
    await session.updateStatus();
    if (!session.isLoggedIn) {
        showScreen("login");
    }

    return session;
}

function showScreen(screen, data) {
    if (typeof screen === "string") screen = [screen];

    hideScreens();

    if (screen.includes("login")) {
        document.getElementById("loginButton").classList.remove("disabled");
        document.getElementById("login").style.display = "block";
    }

    if (screen.includes("message")) {
        document.getElementById("message_content").innerText = data.message;
    }
}

function hideScreens() {
    const screens = document.getElementsByClassName("screen");
    for (let screen of screens) {
        screen.style.display = "none";
    }
}

function injectScript(tab) {
    return new Promise((resolve, reject) => {
        browser.tabs.sendMessage(tab.id, {event: "ping"}, async (response) => {
            if (response && response.event === "pong") {
                resolve();
            } else {
                await browser.tabs.executeScript(tab.id, {
                    file: "src/inject/all.js",
                });
                resolve(injectScript(tab));
            }
        });
    });
}

function createElement(htmlString, element="div") {
    const el = document.createElement(element);
    el.innerHTML = htmlString.trim();
    return el.firstChild;
}

browser.tabs.query({active: true, currentWindow: true}, async (tabList) => {

    const tab = tabList[0];
    const session = await init(tab);
    let media;

    if (session.isLoggedIn && session.level >= 2) {
        console.log("enough perm");
        await injectScript(tab);
        browser.tabs.sendMessage(tab.id, {event: "getSongInfo"}, (response) => {
            if (response) {
                media = new Media(response);
            }
        });
    }


    document.getElementById("loginButton").onclick = () => {
        document.getElementById("loginButton").classList.add("disabled");
        const username = document.getElementById("username").value
        const password = document.getElementById("password").value;

        session.login(username, password).then(() => {
            if (session.isLoggedIn) document.getElementById("login").style.display = "none";
        });
    };

    document.getElementById("downloadButton").onclick = () => {
        //media.updateProgress(1, 100);
    }
});
