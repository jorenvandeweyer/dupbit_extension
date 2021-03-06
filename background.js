var browser = browser || chrome;

const host = "dupbit.com";

Dupbit_API.updateConstants({
    host,
    app_type: "browser",
});

dupbit = "";
media = "";
actions = "";

async function messageHandler(msg) {
    if (typeof msg !== "object") return false;
    if ("message" in msg.data) {
        console.log(msg.data);
    } else if ("call" in msg.data) {
        if (msg.data.call in actions) {
            const fn = actions[msg.data.call];
            const result = await fn(msg.data);
            console.log("execution...: ", result);
            msg.reply(result);
        } else {
            console.log("not an action:", msg.data.call);
            msg.reply({
                success: false,
            });
        }
    } else if("update" in msg.data) {
        const update = msg.data.update;
        if (typeof update.qid !== "undefined") {
            const qid = update.qid;
            if (update.data && update.data.state && update.data.state === 2 && update.data.info) {
                const info = update.data.info;
                media.queue[qid].progress = info.percent;
                media.emit("forceUpdate");
            }
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
        mediaInfo.qid = qid;
        this.queue.push({
            completed: false,
            progress: 0,
            qid,
            artist: mediaInfo.artist,
            title: mediaInfo.title,
        });
        this.emit("forceUpdate");

        const result = await dupbit.sendAPICall(mediaInfo, {
            method: "POST",
            path: "/api/music/convert",
            host,
        });

        browser.downloads.download({
            url: `https://${host}${result.downloadUrl}`,
            filename: result.filename,
        });

        this.queue[qid].completed = true;
        this.queue[qid].progress = 100;

        this.emit("forceUpdate");

        return this.queue[qid];
    }
}

function setup() {
    media = new Media();
    dupbit = new Dupbit_API({
        host,
    }, true);
    dupbit.on("ready", () => console.log("ready"));
    dupbit.on("message", messageHandler);
    dupbit.on("error", console.log);
    
    actions = browser.extension.getBackgroundPage().Actions;
}

setTimeout(setup, 500);
