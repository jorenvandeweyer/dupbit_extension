var retrySeconds = [0, 1, 5, 15, 30, 60, 180, 240];

var Default_options = {
    host: "local.dupbit.com",
    browser: "api-lib",
    browser_version: "1.0.0",
    app_type: "api-lib",
};

(function() {
    if (typeof document !== 'undefined') {
        this.platform = "Browser";
    } else if (typeof navigator !== 'undefined' && navigator.product === 'ReactNative') {
        this.platform = "ReactNative";
    } else if (typeof module !== 'undefined') {
        this.platform = "Node";
    } else {
        throw("NOT SUPPORTING THIS PLATFORM")
    }

    if (this.platform === "Browser" || this.platform === "ReactNative") {
        this.EventEmitter = class {
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
        this.WS = class extends this.EventEmitter {
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
    } else if (this.platform === "Node") {
        this.EventEmitter = require("events");
        this.WS = require("ws");
    }

    console.log(this.platform);

    if (this.platform === "Browser") {
        if (typeof UAParser !== "undefined") {
            this.parser = new UAParser();
        } else {
            console.log("didn't find UAParser");
            this.parser = {
                getBrowser: () => {
                    return {
                        name: "unknown",
                        version: "unknown",
                    };
                },
                getDevice: () => {
                    return {
                        model: "unknown",
                        type: "unknown",
                        vendor: "unknown",  
                    };
                },
                getOS: () => {
                    return {
                        name: "unknown",
                        version: "unknown",
                    };
                },
            };
        }
    } else if (this.platform === "Node"){
        this.parser = {
            getBrowser: () => {
                return {
                    name: Default_options.browser,
                    version: Default_options.browser_version,
                }
            },
            getDevice: () => {
                return {
                    model: "unknown",
                    type: "unknown",
                    vendor: "unknown",
                }
            },
            getOS: async () => {
                const os = require("os").platform();
                if (os === "darwin") {
                    const plist = require('plist');
                    const fs = require("fs");
                    let versionInfo = plist.parse(fs.readFileSync('/System/Library/CoreServices/SystemVersion.plist', 'utf8'));
                    return {
                        platform: os,
                        name: versionInfo.ProductName,
                        version: versionInfo.ProductVersion
                    };
                } else if (os === "linux") {
                    const util = require("util");
                    const getos = util.promisify(require("getos"));
                    const result = await getos();
                    return {
                        platform: os,
                        name: result.dist || result.os,
                        version: result.release || "unknown",
                    };
                } else if (os === "win32") {
                    return {
                        platform: os,
                        name: "Windows",
                        version: "unknown",
                    }
                } else {
                    return {
                        platform: os,
                        name: "unknown",
                        version: "unknown",
                    }
                }
            },
        }
    } else if (this.platform === "ReactNative") {
        const {Platform}  = require('react-native');
        this.parser = {
            getBrowser: () => {
                return {
                    name: Default_options.browser,
                    version: Default_options.browser_version,
                }
            },
            getDevice: () => {
                return {
                    model: "unknown",
                    type: "unknown",
                    vendor: "unknown",
                }
            },
            getOS: () => {
                return {
                    name: Platform.OS,
                    version: Platform.Version,
                }
            },
        }
    }
})();


class Dupbit_API extends EventEmitter{

    static updateConstants(constants) {
        Object.assign(Default_options, constants);
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

    constructor(options={}, force) {
        super();

        this.retry = 0;
        this.noRetry = false;
        this.socket = true;
        this.token = undefined;
        this.ready = false;

        Object.assign(this, Default_options);
        Object.assign(this, options);

        if (this.token || force) {
            this._connect();
        }
    }

    async _connect() {
        await this._validateToken();


        if (this.session) {
            if (this.authenticated) {
                if (this.socket && !this.ws && !this.noRetry) {
                    this._connectSocket();
                } else {
                    !this.ready && this.emit(Dupbit_API.events.READY) && (this.ready = true);
                }
            } else {
                this.emit(Dupbit_API.events.ERROR, {
                    type: Dupbit_API.error.INVALID_CREDENTIALS,
                });
            }
        } else {
            if (!this.noRetry) {
                const delay = retrySeconds[this.retry];
                this.retry++;
                if (this.retry >= retrySeconds.length) this.retry = retrySeconds.length - 1;
                console.log("reconnecting in:", delay);
                this.emit(Dupbit_API.events.RECONNECTING, delay);
                setTimeout(() => {
                    this._connect();
                }, delay*1000 );
            }
        }
    }

    async reconnect() {
        this.noRetry = false;
        this.retry = 0;
        return this._connect();
    }

    async disconnect() {
        if (this.ws) {
            this.noRetry = true;
            this.ws.close();
        }
    }

    async _connectSocket() {
        this.ws = new WS(`wss://${this.host}`, {
            headers: {
                authentication: this.token,
            },
        });

        this.ws.on("error", (e) => {
            this.emit(Dupbit_API.events.ERROR, {
                type: Dupbit_API.error.SOCKET_ERROR,
            });
            this._validateToken();
            console.log(e);
        });

        this.ws.on("open", () => {
            this.retry = 0;
            !this.ready && this.emit(Dupbit_API.events.READY) && (this.ready = true);
            this.emit(Dupbit_API.events.CONNECTED);
        });

        this.ws.on("message", (data) => {
            data = JSON.parse(data);
            this.emit(Dupbit_API.events.MESSAGE, {
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
            console.log("SOCKET CLOSED");
            this.emit(Dupbit_API.events.DISCONNECTED);

            this.ws = undefined;

            this._connect();
        });
    }

    async login(username, password) {
        this.retry = 0;
        const result = await Dupbit_API.login(username, password);
        if (result && result.success) {
            this.token = result.token;
            await this.reconnect();
        } 
        return result;
    }

    async logout() {
        this.noRetry = true;

        const result = await Request({
            token: this.token,
            path: "/api/account/token",
            method: "DELETE",
        });
        
        if (this.ws) {
            this.ws.close(); //should already be closed by the server
        }
        if (result && result.success) {
            return this._validateToken(); //update session
        }
    }

    async _validateToken() {
        //null: cant connect to server
        //object: fetched from server
        this.session = await Request({
            token: this.token,
            path: `/api/account/status`,
            host: this.host,
        });

        if (this.session && !this.session.isLoggedIn) {
            this.token = undefined;
        }
        return this.session;
    }

    async list() {
        if (!this.authenticated) return this.emit(Dupbit_API.events.ERROR, {
            type: Dupbit_API.error.INVALID_CREDENTIALS,
        });

        return Request({
            token: this.token,
            path: "/api/connect/open",
        });
    }

    async sendAPICall(options, override) {
        if (!this.authenticated) return this.emit(Dupbit_API.events.ERROR, {
            type: Dupbit_API.error.INVALID_CREDENTIALS,
        });

        return Request({
            token: this.token,
            path: "/api/connect/open",
            body: options,
            method: "POST",
            ...override
        });
    }

    get authenticated() {
        return !!(this.session && this.session.isLoggedIn);
    }

    get connected() {
        return !!this.ws;
    }

    static get error() {
        return {
            "SOCKET_ERROR": "socket_error",
            "INVALID_CREDENTIALS": "invalid_credentials",
        };
    }

    static get events() {
        return {
            "READY": "ready",
            "MESSAGE": "message",
            "LOGIN": "login",
            "LOGOUT": "logout",
            "CONNECTED": "connected",
            "DISCONNECTED": "disconnected",
            "RECONNECTING": "reconnecting",
            "ERROR": "error",
        }
    }
}

async function Request(options) {
    options = {
        method: "GET",
        headers: {
            authorization: options.token || "",
            "content-type": "application/json",
        },
        host: Default_options.host,
        ...options,
    };

    if (this.platform === "Node") {
        const response = await Node_Request(options).catch((result) => {
            return null;  
        });
        return response && response.data;
    } else {
        const response = await Browser_Request(options).catch((result) => {
            return null;  
        });
    
        return response && response.data;
    }
}

async function Node_Request(options) {
    const https = require("https");
    const result = {
        statusCode: 200,
        statusMessage: "OK",
        data: {},
        json: true,
    };
    const response = await new Promise((resolve, reject) => {
        const request = https.request(options, (res) => resolve(res));
        request.write(JSON.stringify(options.body) || "");
        request.end();
        request.on('error', reject);
    });
    return new Promise((resolve, reject) => {
        let data = "";
        response.on("data", (d) => {
            data+=d;
        });
        response.on("end", () => {
            if (response.headers["content-type"].includes("application/json")) {
                result.data = JSON.parse(data);
            } else {
                result.data = data;
                result.json = false;
            }
            if (response.statusCode < 200 || response.statusCode >= 300) {
                result.statusCode = response.statusCode;
                result.statusMessage = response.statusMessage;
            }
            resolve(result);
        });
    });
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
            const contentType = xhr.getResponseHeader("content-type");
            if (contentType.includes("application/json")) {
                result.data = JSON.parse(xhr.responseText);
            } else {
                result.data = xhr.responseText;
                result.json = false;
            }

            if (xhr.status < 200 || xhr.status >=300) {
                result.statusCode = xhr.status;
                result.statusMessage = xhr.statusText;
            }

            resolve(result);
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

if (platform === "Node" || platform === "ReactNative") {
    module.exports = Dupbit_API;
} else {
    this.Dupbit_API = Dupbit_API;
}

