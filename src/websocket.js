class EventEmitter {
    constructor () {
        this.listeners = new Map();
    }

    emit (type, message) {
        if (this.listeners.has(type)) {
            this.listeners.get(type)(message);
        }
    }

    on (type, fn) {
        this.listeners.set(type, fn);
    }
}

const retrySeconds =  [0, 1, 5, 15, 30, 60, 180, 240];

class WS extends EventEmitter{
    constructor () {
        super();
        this.retry = 0;
        this.noRetry = false;
        this.connect();
    }

    async connect () {
        this.noRetry = false;

        const session = await this.checkStatus();

        if (!session) {
            return this.reconnect();
        }

        if (!session.isLoggedIn) {
            return this.emit("login");
        }

        this.ws = new WebSocket(`wss://dupbit.com`);

        this.ws.onopen = (event) => {
            this.retry = 0;
            this.ws.send(JSON.stringify({
                action: "message",
                content: "Client Connected!"
            }));
        };

        this.ws.onmessage = (event) => {
            this.emit(event.type, JSON.parse(event.data));
        };

        this.ws.onclose = (event) => {
            console.log("connection was closed");
            if (!this.noRetry) this.reconnect();
        }
    }

    async checkStatus() {
        return await getURL("https://dupbit.com/api/loginStatus");
    }

    send(msg) {
        this.ws.send(JSON.stringify(msg));
    }

    reconnect () {
        this.retry++;
        if (this.retry >= retrySeconds.length) this.retry = retrySeconds.length - 1;
        const delay = retrySeconds[this.retry];

        this.emit("reconnecting", delay);

        setTimeout(() => {
            this.connect();
        }, delay*1000);
    }

    logout() {
        this.noRetry = true;
        this.send({
            action: "logout",
        });
        this.close();
        this.emit("login");
    }

}

function newWebSocket() {
    return new WS();
}

function getURL(url, data={}) {
    const getParams = Object.keys(data).map(function(k) {
        return encodeURIComponent(k) + "=" + encodeURIComponent(data[k]);
    }).join('&')

    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("GET", `${url}?${getParams}`, true);
        xhr.withCredentials = true;
        xhr.onload = () => resolve(JSON.parse(xhr.responseText));
        xhr.onerror = () => reject(xhr.statusText);
        xhr.send();
    }).catch((e) => {
        return null;
    });
}
