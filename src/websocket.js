var Default_options = {
    host: "local.dupbit.com",
    socket: true,
    socketOptions: {
        retry: 0,
        noRetry: false,
    },
    browser: "api-lib",
    browser_version: "1.0.0",
    app_type: "api-lib",
};
var retrySeconds = [0, 1, 5, 15, 30, 60, 180, 240];

class EventEmitter {
    constructor() {
        this.listeners = new Map();
    }
    emit(type, message) {
        if (this.listeners.has(type)) {
            this.listeners.get(type).forEach(listener => listener(message));
        }
    }
    on(type, listener) {
        if (!this.listeners.has(type)){
            this.listeners.set(type, new Array());
        }
        this.listeners.get(type).push(listener);
    }
    removeListener(type, listener) {
        if (this.listeners.has(type)) {
            listeners = this.listeners.get(type)
            listeners.splice(listeners.indexOf(listener), 1);
        }
    }
    removeAllListeners(type) {
        if (this.listeners.has(type)) {
            this.listeners.remove(type);
        }
    }
};

class WS extends EventEmitter {
    constructor(url) {
        super();
        this.socket = new WebSocket(url);
        this.socket.onopen = (event) => { this.emit("open", event) };
        this.socket.onmessage = (event) => { this.emit(event.type, event.data) };
        this.socket.onerror = (event) => { this.emit("error", event) };
        this.socket.onclose = (event) => { this.emit("close", event) };
    }

    close() {
        this.socket.close();
    }

    send(data) {
        this.socket.send(data);
    }
}

// class WS extends EventEmitter{
//     constructor (host) {
//         super();
//         this.host = host;
//         this.retry = 0;
//         this.noRetry = false;
//         this.connect();
//     }

//     async connect () {
//         this.noRetry = false;

//         const session = await this.checkStatus();

//         if (!session) {
//             return this.reconnect();
//         }

//         if (!session.isLoggedIn) {
//             return this.emit("login");
//         }

//         this.ws = new WebSocket(`wss://${this.host}`);

//         this.ws.onopen = (event) => {
//             this.retry = 0;
//             this.ws.send(JSON.stringify({
//                 action: "message",
//                 content: "Client Connected!"
//             }));
//         };

//         this.ws.onmessage = (event) => {
//             try {
//                 const json = JSON.parse(event.data);
//                 this.emit(event.type, json);
//             } catch (e) {
//                 this.emit(event.type, event.data);
//             }
//         };

//         this.ws.onerror = (event) => {
//             console.log(event);
//         }

//         this.ws.onclose = (event) => {
//             console.log("connection was closed");
//             if (!this.noRetry) this.reconnect();
//         }
//     }

//     async checkStatus() {
//         return await Request.get(`https://${this.host}/api/account/status`);
//     }

//     send(msg) {
//         this.ws.send(JSON.stringify(msg));
//     }

//     reconnect () {
//         this.retry++;
//         if (this.retry >= retrySeconds.length) this.retry = retrySeconds.length - 1;
//         const delay = retrySeconds[this.retry];

//         this.emit("reconnecting", delay);

//         setTimeout(() => {
//             this.connect();
//         }, delay*1000);
//     }

//     logout() {
//         this.noRetry = true;
//         this.send({
//             action: "logout",
//         });
//         this.close();
//         this.emit("login");
//     }

// }

class Dupbit_API extends EventEmitter{
    constructor(options={}, search=false) {
        super();
        this.search = search;

        Object.assign(this, Default_options);
        Object.assign(this, options);

        this.connect();
    }

    static updateConstants(constants) {
        Object.assign(Default_options, constants);
    }

    async connect() {
        await this._validateToken();

        if (!this.authenticated && !this.search) return this.emit("error", "invalid token");
        
        if (this.socket) {
            this.connectSocket();
        } else {
            this.emit("ready");
        }
    }

    async connectSocket() {
        this.ws = new WS(`wss://${this.host}`);

        this.ws.on("error", (e) => {
            this.emit("error_socket", e);
            console.log(e);
        });

        this.ws.on("open", () => {
            this.socketOptions.retry = 0;
            this.emit("ready");
        });

        this.ws.on("message", (data) => {
            data = JSON.parse(data);
            this.emit("message", {
                data,
                reply: (response, cb) => {
                    this.ws.send(JSON.stringify({
                        original: data,
                        response,
                    }), (err) => {
                        if (typeof cb === "function") cb(err);
                    });
                }
            });
        });

        this.ws.on("close", (code) => {
            const SO = this.socketOptions;
            this.emit("disconnect_socket");

            if (!SO.noRetry) {
                SO.retry++;
                if (SO.retry >= retrySeconds.length) SO.retry = retrySeconds.length - 1;
                const delay = retrySeconds[SO.retry];
                console.log("reconnection in:" ,delay);
                this.emit("reconnecting_socket", delay);
                setTimeout(() => {
                    this.connectSocket();
                }, delay*1000);
            }
        })
    }

    async close() {
        if (this.ws) {
            this.SocketOptions.noRetry = true;
            this.ws.close();
        }
    }

    async list() {
        if (!this.authenticated) return this.emit("error", "invalid token");

        return Request({
            path: "/api/connect/open",
        });
    }

    async sendAPICall(options, override) {
        if (!this.authenticated) return this.emit("error", "invalid token");

        return Request({
            path: "/api/connect/open",
            body: options,
            method: "POST",
            ...override
        });
    }

    static async login(username, password) {
        return await Request({
            body: {
                username,
                password,
                info: {
                    os: await parser.getOS(),
                    device: await parser.getDevice(),
                    browser: await parser.getBrowser(),
                },
                app_type: Default_options.app_type,
            },
            path: "/api/account/login",
            method: "POST",
        });
    }

    async _validateToken() {
        this.session = await Request({
            path: `/api/account/status`,
            host: this.host,
        });
    }

    get authenticated() {
        return this.session && this.session.isLoggedIn;
    }
}

async function Request(options) {
    options = {
        method: "GET",
        headers: {
            "content-type": "application/json",
        },
        host: Default_options.host,
        ...options,
    };

    const response = await Browser_Request(options).catch((result) => {
        return null;  
    });

    return response && response.data;
}

async function Browser_Request(options) {
    const xhr = new XMLHttpRequest();
    const result = {
        statusCode: 200,
        statusMessage: "OK",
        data: {},
        json: true,
    };

    return new Promise((resolve, reject) => {
        xhr.open(options.method, "https://" + options.host + options.path + (options.method === "GET" ? "?" + encodeData(options.body) : ""), true);
        
        for (let header in options.headers) {
            xhr.setRequestHeader(header, options.headers[header]);
        }
        xhr.onload = () => {
            if (xhr.status < 200 || xhr.status >=300) {
                result.statusCode = xhr.status;
                result.json = false;
                result.statusMessage = xhr.statusText;
                reject(result);
            } else {
                const contentType = xhr.getResponseHeader("content-type");
                if (contentType.includes("application/json")) {
                    result.data = JSON.parse(xhr.responseText);
                } else {
                    result.data = xhr.responseText;
                    result.json = false;
                }
                resolve(result);
            }
        };
        xhr.onerror = () => {
            result.json = false;
            result.statusCode = xhr.status;
            result.statusMessage = xhr.statusText;
            reject(result);
        };
        xhr.send(options.method !== "GET" ? JSON.stringify(options.body) : undefined);
    });
}

function encodeData(data) {
    if (!data) return "";
    return Object.keys(data).map(function(k) {
        return encodeURIComponent(k) + "=" + encodeURIComponent(data[k]);
    }).join('&');
}
