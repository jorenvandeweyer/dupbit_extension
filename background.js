session = "";
ws = "";
youtube = "";
actions = "";

host = "dupbit.com";

function setup() {
    session = new Session();
    ws = new WS(host);
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

        const result = await Request.post(`https://${host}/api/music/convert`, {
            remote: true,
            url,
            title,
            artist,
            provider: "youtube",
        });

        chrome.downloads.download({
            url: `https://${host}${result.downloadUrl}`,
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
        const result = await Request.get(`https://${host}/api/account/status`, {
            origin: chrome.runtime.id
        });
        Object.assign(this, result);
    }

    async login(username, password) {
        const result = await Request.post(`https://${host}/api/account/login`, {
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
