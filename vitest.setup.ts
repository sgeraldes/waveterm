// Polyfill window.matchMedia for jsdom (not implemented by jsdom)
if (typeof window !== "undefined" && !window.matchMedia) {
    Object.defineProperty(window, "matchMedia", {
        writable: true,
        value: (query: string) => ({
            matches: false,
            media: query,
            onchange: null,
            addListener: () => {},
            removeListener: () => {},
            addEventListener: () => {},
            removeEventListener: () => {},
            dispatchEvent: () => false,
        }),
    });
}

// Mock Electron preload API (window.api) for tests that import components
// using getApi(). Uses a Proxy to return no-op functions for any method.
if (typeof window !== "undefined" && !(window as any).api) {
    const noopFn = () => {};
    (window as any).api = new Proxy(
        {},
        {
            get(_target, prop) {
                if (prop === "then") return undefined; // prevent Promise-like behavior
                return noopFn;
            },
        }
    );
}
