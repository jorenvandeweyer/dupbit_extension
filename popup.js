class YouTube {
    constructor(tab, session) {
        if (session.level < 2) return;

        this.valid = tab.url.includes("youtube.com");
        if (this.valid) this.init(tab);
    }

    init(tab) {
        this.tab = tab;
        this.url = tab.url;
        this.youtube = chrome.extension.getBackgroundPage().youtube;

        this.titleField = document.getElementById("title"),
        this.artistField = document.getElementById("artist"),
        this.queueTable = document.getElementById("queueTable");

        this.getQueue();
        if (this.url.includes("watch?v=")) this.showDownload();
    }

    getQueue() {
        this.queue = this.youtube.queue;
        for (let qid in this.queue) {
            const item = this.queue[qid];
            this.addToQueue(qid, item.artist, item.title, item.readyState);
        }
        this.showQueue();

        this.youtube.on("addToQueue", (data) => {
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
        const row = document.createElement("tr");
        row.id = `qid_${qid}`;
        row.innerHTML = `<td>${artist}</td><td>${title}</td><td><img width='16px' src='images/${imgSrc}'/></td>`;
        this.queueTable.prepend(row);
        this.showQueue();
    }

    updateQueueReadyState(qid) {
        this.queueTable.querySelector(`#qid_${qid} img`).setAttribute("src", "images/ready.png");
    }

    showDownload() {
        const name = this.tab.title.replace(" - YouTube", "").replace(/[\\\/:*?"<>|]/g, "");

        this.artistField.value = name.includes(" - ") ? name.split(" - ")[0] : "";
        this.titleField.value = name.includes(" - ") ? name.split(" - ")[1] : name;

        document.getElementById("download").style.display = "block";
        this.titleField.select();
    }

    async download() {
        console.log("download");
        const artist = this.artistField.value.replace(/[\\\/:*?"<>|]/g, "");
        const title = this.titleField.value.replace(/[\\\/:*?"<>|]/g, "");

        const result = await this.youtube.download(this.url, title, artist).then((result) => {
            this.updateQueueReadyState(result.qid);
        });

        return false;
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
    const session = chrome.extension.getBackgroundPage().session;
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
        document.getElementById("submit").classList.remove("disabled");
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

chrome.tabs.query({active: true, currentWindow: true}, async (tabList) => {
    const tab = tabList[0];

    const session = await init(tab);
    const youtube = new YouTube(tab, session);

    console.log(session);
    console.log(youtube);

    document.getElementById("login_form").onsubmit = async () => {
        document.getElementById("submit").classList.add("disabled");
        const username = document.getElementById("username").value
        const password = document.getElementById("password").value;

        session.login(username, password).then(() => {
            if (session.isLoggedIn) document.getElementById("login").style.display = "none";
        });

        return false;
    };

    document.getElementById("youtube_download_form").onsubmit = async (e) => {
        e.preventDefault();
        console.log("XXX");
        youtube.download();
        return false;
    }
});
