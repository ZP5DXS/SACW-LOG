import {safeEndpoint} from './connectors.js';
export const serviceConfig=Object.freeze({apiBase:'https://zp5dxs.org/sacw/',syncURL:'api/sync',qrzLookupURL:'',pollMs:15000});
export function appAPI(path){if(location.protocol==='file:')return '';const local=['localhost','127.0.0.1'].includes(location.hostname);const base=local?new URL('./',location.href||location.origin).href:serviceConfig.apiBase;return safeEndpoint(new URL(String(path).replace(/^\/+/ ,''),base).href);}
export function serviceURL(value){return value?appAPI(value):'';}
