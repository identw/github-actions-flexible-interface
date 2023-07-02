class Utils {
    static uriEncodeParams(params) {
        let encodeParams = [];
        for (const key in params) {
            encodeParams.push(encodeURIComponent(key) + '=' + encodeURIComponent(params[key]));
        }
        encodeParams = encodeParams.join('&');
        return encodeParams;
    }

    static arraysEqual(a, b) {
        if (a === b) return true;
        if (a == null || b == null) return false;
        if (a.length !== b.length) return false;
    
        for (var i = 0; i < a.length; ++i) {
            if (a[i] !== b[i]) return false;
        }
        return true;
    }

    static promiseSetTimeout(timeout) {
        return new Promise((res, reject) => {
            setTimeout(() => {
                res("result");
            }, timeout)
        });
    }
}
  
export default Utils;