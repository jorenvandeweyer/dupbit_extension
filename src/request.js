class Request {
    static get(url, data={}) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open("GET", `${url}?${encodeData(data)}`, true);
            xhr.withCredentials = true;
            xhr.onload = () => resolve(checkResponse(xhr));
            xhr.onerror = () => reject(xhr.statusText);
            xhr.send();
        }).catch(() => null);
    }

    static post(url, data={}) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open("POST", url, true);
            xhr.withCredentials = true;
            xhr.onload = () => resolve(checkResponse(xhr));
            xhr.onerror = () => reject(xhr.statusText);
            xhr.send(encodeData(data));
        }).catch(() => null);
    }
}

Request.GET = Request.get;
Request.POST = Request.post;

RequestMirror = Request;

function encodeData(data) {
    return Object.keys(data).map(function(k) {
        return encodeURIComponent(k) + "=" + encodeURIComponent(data[k]);
    }).join('&');
}

function checkResponse(xhr) {
    if (xhr.status < 200 || xhr.status >= 300) return null;

    const contentType = xhr.getResponseHeader("Content-Type");

    if (contentType === "application/json") {
        return JSON.parse(xhr.responseText);
    } else {
        return null;
    }
}
