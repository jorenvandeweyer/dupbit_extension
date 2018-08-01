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
    constructor (host) {
        super();
        this.host = host;
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

        this.ws = new WebSocket(`wss://${this.host}`);

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

        this.ws.onerror = (event) => {
            console.log(event);
        }

        this.ws.onclose = (event) => {
            console.log("connection was closed");
            if (!this.noRetry) this.reconnect();
        }
    }

    async checkStatus() {
        return await Request.get(`https://${this.host}/api/account/status`);
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
