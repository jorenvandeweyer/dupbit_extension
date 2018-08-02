var browser = browser || chrome;

session = "";
ws = "";
media = "";
actions = "";

host = "dupbit.com";

function setup() {
    session = new Session();
    ws = new WS(host);
    media = new Media();

    actions = browser.extension.getBackgroundPage().Actions;
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

class Media extends EventEmitter {
    constructor() {
        super();
        this.queue = [];
    }

    async download(mediaInfo) {
        const qid = this.queue.length;
        this.queue.push({
            qid,
            artist: mediaInfo.artist,
            title: mediaInfo.title,
            readyState: false
        });

        this.emit("addToQueue", this.queue[qid]);

        const result = await Request.post(`https://${host}/api/music/convert`, mediaInfo);

        browser.downloads.download({
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
            origin: browser.runtime.id
        });
        Object.assign(this, result);
    }

    async login(username, password) {
        const result = await Request.post(`https://${host}/api/account/login`, {
            username,
            password,
            remote: "extension",
            origin: browser.runtime.id,
        });

        if (result.success && result.login) {
            await this.updateStatus();
        }
    }
}

setTimeout(setup, 500);
