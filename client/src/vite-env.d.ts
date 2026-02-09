/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_API_BASE_URL: string;
    readonly VITE_APP_NAME: string;
    readonly VITE_APP_VERSION: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
interface Window {
    __APP_CONFIG__: {
        API_ROUTE_PREFIX: string;
        BASE_PATH: string;
    }
}
