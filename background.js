session = "";
ws = "";
youtube = "";
actions = "";

function setup() {
    session = new Session();
    ws = new WS();
    youtube = new YouTube();

    actions = chrome.extension.getBackgroundPage().Actions;
    ws.on("message", messageHandler);
}

async function messageHandler(msg) {
    console.log(msg);
    if (msg.action) {
        const action = msg.action;
        if (action.name in actions) {
            const fn = actions[action.name];
            const result = await fn(action.data.action, action.data.value);
            console.log(result);
            ws.send({
                action: action.name,
                feedback: result,
                success: true,
            });
        } else {
            ws.send({
                action: action.name,
                success: false,
            });
        }
    }
}

class YouTube extends EventEmitter {
    constructor() {
        super();
        this.queue = [];
    }

    async download(url, title, artist) {
        const qid = this.queue.length;
        this.queue.push({qid, artist, title, readyState: false});

        this.emit("addToQueue", this.queue[qid]);

        const result = await Request.post("https://dupbit.com/api/music/convert", {
            remote: true,
            url,
            title,
            artist,
        });

        chrome.downloads.download({
            url: result.downloadUrl,
            filename: result.filename,
        })

        this.queue[qid].readyState = true;

        return this.queue[qid];
    }
}

class Session {
    constructor() {
        this.updateStatus();
    }

    async updateStatus() {
        const result = await Request.get("https://dupbit.com/api/loginStatus", {
            origin: chrome.runtime.id
        });
        Object.assign(this, result);
    }

    async login(username, password) {
        const result = await Request.post("https://dupbit.com/api/login", {
            username,
            password,
            remote: "extension",
            origin: chrome.runtime.id,
        });

        if (result.success && result.login) {
            await this.updateStatus();
        }
    }
}

setTimeout(setup, 500);
