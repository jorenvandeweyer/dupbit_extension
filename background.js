var browser = browser || chrome;

dupbit = "";
media = "";
actions = "";

host = "local.dupbit.com";

function setup() {
    media = new Media();
    dupbit = new Dupbit_API({
        host,
    });
    dupbit.on("message", messageHandler);
    dupbit.on("error", console.log);
    
    actions = browser.extension.getBackgroundPage().Actions;
}

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

        const request = new Promise((resolve, reject) => {
            let lastPos = 0;
            const xhr = new XMLHttpRequest();
            xhr.open("POST", `https://${host}/api/music/convert`, true);
            xhr.setRequestHeader("Content-Type", "application/json");
            xhr.withCredentials = true;
            xhr.onreadystatechange = () => {
                if (xhr.readyState === 3) {
                    const data = xhr.responseText.substring(lastPos);
                    this.emitProgress(qid, data);
                    lastPos = xhr.responseText.length;
                }
            };
            xhr.onload = () => resolve(checkResponse(xhr));
            xhr.onerror = () => reject(xhr.statusText);
            xhr.send(JSON.stringify(mediaInfo));
        }).catch(() => null);

        const result = await request;

        browser.downloads.download({
            url: `https://${host}${result.downloadUrl}`,
            filename: result.filename,
        })

        this.queue[qid].readyState = true;

        return this.queue[qid];
    }

    emitProgress(qid, string) {
        try {
            if (string[0] === ",") {
                string = string.substring(1);
                console.log(qid, string);
                const data = JSON.parse(string);
                console.log(data);
                if (data.state === 2) {
                    this.emit("progress", {
                        qid,
                        percentage: parseFloat(data.info.percent),
                    });
                }
            }
        } catch (e) {
            //
        }
    }
}

function checkResponse(xhr) {
    if (xhr.status < 200 || xhr.status >= 300) return null;

    const contentType = xhr.getResponseHeader("Content-Type");

    if (contentType.includes("application/json")) {
        return JSON.parse(xhr.responseText);
    } else {
        return null;
    }
}

setTimeout(setup, 500);
