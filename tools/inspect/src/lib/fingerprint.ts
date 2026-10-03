/**
 * Nhận diện engine/thư viện/SDK từ nội dung JS/HTML và từ biến global của trang.
 * Mỗi signature là một regex. Một match chỉ là "dấu hiệu", nên báo cáo luôn ghi kèm số lần khớp.
 */

export interface Signature {
  id: string;
  category: 'engine' | 'ui' | 'network' | 'serialization' | 'sdk' | 'payment' | 'build';
  label: string;
  patterns: RegExp[];
}

export const SIGNATURES: Signature[] = [
  // Game engine
  { id: 'cocos-creator', category: 'engine', label: 'Cocos Creator', patterns: [/cc\.ENGINE_VERSION/, /CCClass|cc\._decorator|cc\.Component/, /cocos2d-js|CocosEngine|cc\.game\.run/] },
  { id: 'laya', category: 'engine', label: 'LayaAir', patterns: [/\bLaya\.init\b/, /laya\.core\.js|LayaAir/, /Laya\.stage/] },
  { id: 'egret', category: 'engine', label: 'Egret', patterns: [/\begret\.(runEgret|DisplayObject|Sprite)\b/, /egret\.web\./] },
  { id: 'phaser', category: 'engine', label: 'Phaser', patterns: [/Phaser\.(Game|Scene|AUTO)\b/, /phaser\.min\.js|Phaser v\d/] },
  { id: 'pixi', category: 'engine', label: 'PixiJS', patterns: [/PIXI\.(Application|Sprite|VERSION|Container)\b/, /pixi\.min\.js|pixi\.js - v\d/] },
  { id: 'unity-webgl', category: 'engine', label: 'Unity WebGL', patterns: [/createUnityInstance|UnityLoader\.instantiate/, /\.(data|wasm|framework\.js)(\.br|\.gz|\.unityweb)?["']/] },
  { id: 'threejs', category: 'engine', label: 'three.js', patterns: [/THREE\.WebGLRenderer|three\.module\.js|REVISION\s*=\s*["']\d+/] },
  { id: 'babylon', category: 'engine', label: 'Babylon.js', patterns: [/BABYLON\.(Engine|Scene)\b/] },
  { id: 'createjs', category: 'engine', label: 'CreateJS', patterns: [/createjs\.(Stage|Ticker)\b/] },
  { id: 'spine', category: 'engine', label: 'Spine runtime', patterns: [/spine\.(Skeleton|AnimationState)\b|sp\.Skeleton|\.skel["']/] },
  { id: 'dragonbones', category: 'engine', label: 'DragonBones', patterns: [/dragonBones\.\w+|_ske\.json|_tex\.json/] },
  // UI framework (cổng web / launcher)
  { id: 'expo', category: 'ui', label: 'Expo / React Native Web', patterns: [/\/_expo\/static\/|expo-router|__expo|EXPO_PUBLIC_|react-native-web/] },
  { id: 'react', category: 'ui', label: 'React', patterns: [/react-dom|__REACT_DEVTOOLS_GLOBAL_HOOK__|createElement\("div"/] },
  { id: 'vue', category: 'ui', label: 'Vue', patterns: [/__VUE__|createApp\(|Vue\.component|data-v-[0-9a-f]{8}/] },
  { id: 'jquery', category: 'ui', label: 'jQuery', patterns: [/jQuery v\d|jquery(\.min)?\.js/] },
  { id: 'nextjs', category: 'ui', label: 'Next.js', patterns: [/__NEXT_DATA__|\/_next\/static\//] },
  { id: 'nuxt', category: 'ui', label: 'Nuxt', patterns: [/__NUXT__|\/_nuxt\//] },
  // Network / protocol
  { id: 'websocket', category: 'network', label: 'WebSocket thuần', patterns: [/new WebSocket\(/] },
  { id: 'socketio', category: 'network', label: 'Socket.IO', patterns: [/socket\.io|EIO=\d/] },
  { id: 'pomelo', category: 'network', label: 'Pomelo (NetEase)', patterns: [/pomelo\.(init|request|notify)\b/] },
  { id: 'colyseus', category: 'network', label: 'Colyseus', patterns: [/colyseus/i] },
  { id: 'signalr', category: 'network', label: 'SignalR', patterns: [/signalr|HubConnectionBuilder/] },
  // Serialization
  { id: 'protobuf', category: 'serialization', label: 'Protocol Buffers', patterns: [/protobuf(js)?|\.proto["']|\$protobuf/] },
  { id: 'msgpack', category: 'serialization', label: 'MessagePack', patterns: [/msgpack/i] },
  { id: 'pako', category: 'serialization', label: 'pako (zlib)', patterns: [/\bpako\b|inflateRaw|deflateRaw/] },
  { id: 'jszip', category: 'serialization', label: 'JSZip', patterns: [/JSZip/] },
  // SDK / analytics / ads
  { id: 'google-analytics', category: 'sdk', label: 'Google Analytics / gtag', patterns: [/googletagmanager\.com|google-analytics\.com|gtag\(/] },
  { id: 'facebook-sdk', category: 'sdk', label: 'Facebook SDK / Pixel', patterns: [/connect\.facebook\.net|fbq\(|FB\.init/] },
  { id: 'firebase', category: 'sdk', label: 'Firebase', patterns: [/firebaseapp\.com|firebase\.initializeApp|firebaseio\.com/] },
  { id: 'adjust', category: 'sdk', label: 'Adjust', patterns: [/adjust\.com|Adjust\.initSdk/] },
  { id: 'appsflyer', category: 'sdk', label: 'AppsFlyer', patterns: [/appsflyer/i] },
  { id: 'sentry', category: 'sdk', label: 'Sentry', patterns: [/sentry\.io|Sentry\.init/] },
  { id: 'baidu-tongji', category: 'sdk', label: 'Baidu Tongji', patterns: [/hm\.baidu\.com/] },
  { id: 'cnzz', category: 'sdk', label: 'CNZZ / Umeng', patterns: [/cnzz\.com|umeng/i] },
  { id: 'recaptcha', category: 'sdk', label: 'reCAPTCHA / hCaptcha / Turnstile', patterns: [/recaptcha|hcaptcha|challenges\.cloudflare\.com\/turnstile/] },
  // Payment (VN và quốc tế)
  { id: 'momo', category: 'payment', label: 'MoMo', patterns: [/momo\.vn|momo/i] },
  { id: 'vnpay', category: 'payment', label: 'VNPay', patterns: [/vnpay/i] },
  { id: 'zalopay', category: 'payment', label: 'ZaloPay', patterns: [/zalopay/i] },
  { id: 'card-topup', category: 'payment', label: 'Thẻ cào / nạp thẻ', patterns: [/napthe|nap_the|thecao|the-cao|card_?charge|telco|viettel|mobifone|vinaphone/i] },
  { id: 'paypal', category: 'payment', label: 'PayPal', patterns: [/paypal\.com/] },
  { id: 'stripe', category: 'payment', label: 'Stripe', patterns: [/js\.stripe\.com|Stripe\(/] },
  // Build tooling
  { id: 'webpack', category: 'build', label: 'webpack', patterns: [/__webpack_require__|webpackChunk/] },
  { id: 'vite', category: 'build', label: 'Vite', patterns: [/\/@vite\/client|__vite__|vite\/modulepreload-polyfill/] },
  { id: 'metro', category: 'build', label: 'Metro bundler (React Native)', patterns: [/__d\(function|__r\(\d+\)|__METRO_GLOBAL_PREFIX__/] },
  { id: 'js-obfuscator', category: 'build', label: 'javascript-obfuscator (string array)', patterns: [/function _0x[0-9a-f]{4,}\(\)\{const _0x[0-9a-f]+=\[/] },
  { id: 'sourcemap', category: 'build', label: 'Có source map', patterns: [/\/\/# sourceMappingURL=(?!data:)/] },
];

export interface FingerprintHit {
  id: string;
  label: string;
  category: Signature['category'];
  matches: number;
  files: string[];
}

/** Chạy toàn bộ signature trên danh sách (tên file, nội dung). */
export function fingerprintTexts(sources: { name: string; text: string }[]): FingerprintHit[] {
  const hits = new Map<string, FingerprintHit>();
  for (const sig of SIGNATURES) {
    for (const { name, text } of sources) {
      let count = 0;
      for (const pattern of sig.patterns) {
        const global = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g');
        count += Math.min(text.match(global)?.length ?? 0, 10_000);
      }
      if (count === 0) continue;
      const hit = hits.get(sig.id) ?? { id: sig.id, label: sig.label, category: sig.category, matches: 0, files: [] };
      hit.matches += count;
      if (hit.files.length < 10) hit.files.push(name);
      hits.set(sig.id, hit);
    }
  }
  return [...hits.values()].sort((a, b) => a.category.localeCompare(b.category) || b.matches - a.matches);
}

/**
 * Hàm chạy TRONG trình duyệt (page.evaluate): dò biến global của engine và liệt kê
 * các global "lạ" so với baseline của một trang trống.
 */
export function browserProbe(baselineKeys: string[]) {
  const w = window as unknown as Record<string, any>;
  const baseline = new Set(baselineKeys);
  const engines: Record<string, unknown> = {
    cocos: w.cc ? (w.cc.ENGINE_VERSION ?? true) : undefined,
    laya: w.Laya ? (w.Laya.version ?? true) : undefined,
    egret: w.egret ? (w.egret.Capabilities?.engineVersion ?? true) : undefined,
    pixi: w.PIXI ? (w.PIXI.VERSION ?? true) : undefined,
    phaser: w.Phaser ? (w.Phaser.VERSION ?? true) : undefined,
    unity: w.createUnityInstance || w.UnityLoader || w.unityInstance ? true : undefined,
    three: w.THREE ? (w.THREE.REVISION ?? true) : undefined,
    babylon: w.BABYLON ? (w.BABYLON.Engine?.Version ?? true) : undefined,
    createjs: w.createjs ? true : undefined,
    spine: w.spine || w.sp ? true : undefined,
    vue: w.Vue || w.__VUE__ || document.querySelector('[data-v-app]') ? true : undefined,
    react: w.React || document.querySelector('[data-reactroot]') ? true : undefined,
    jquery: w.jQuery ? (w.jQuery.fn?.jquery ?? true) : undefined,
    socketio: w.io && typeof w.io === 'function' ? true : undefined,
    protobuf: w.protobuf || w.$protobuf ? true : undefined,
  };
  const customGlobals = Object.keys(w)
    .filter((k) => !baseline.has(k) && !/^(webkit|on)/.test(k))
    .slice(0, 400)
    .map((k) => {
      let type: string = typeof w[k];
      try {
        if (type === 'object' && w[k] !== null) type = `object(${Object.keys(w[k]).length} keys)`;
      } catch {
        type = 'object(?)';
      }
      return { name: k, type };
    });
  const canvases = [...document.querySelectorAll('canvas')].map((c) => ({
    id: c.id,
    width: c.width,
    height: c.height,
    context: (c as HTMLCanvasElement & { __ctx?: string }).__ctx ?? null,
  }));
  const meta = [...document.querySelectorAll('meta')].map((m) => ({
    name: m.getAttribute('name') ?? m.getAttribute('property') ?? m.getAttribute('http-equiv') ?? '',
    content: m.getAttribute('content') ?? '',
  }));
  const links = [...document.querySelectorAll('a[href]')].map((a) => (a as HTMLAnchorElement).href).slice(0, 500);
  const scripts = [...document.querySelectorAll('script[src]')].map((s) => (s as HTMLScriptElement).src);
  const styles = [...document.querySelectorAll('link[rel="stylesheet"]')].map((l) => (l as HTMLLinkElement).href);
  return {
    href: location.href,
    title: document.title,
    lang: document.documentElement.lang,
    engines: Object.fromEntries(Object.entries(engines).filter(([, v]) => v !== undefined)),
    customGlobals,
    canvases,
    meta,
    links,
    scripts,
    styles,
    localStorageKeys: (() => {
      try {
        return Object.keys(localStorage);
      } catch {
        return [];
      }
    })(),
    visibleText: (document.body?.innerText ?? '').slice(0, 5000),
  };
}

export type ProbeResult = ReturnType<typeof browserProbe>;
