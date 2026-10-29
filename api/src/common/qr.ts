import QRCode from 'qrcode';

/** Every QR encodes a web URL: phone cameras open the web page, the app reads the path. */
export function scanUrl(path: string) {
  const base = (
    process.env.WEB_APP_URL ??
    process.env.WEB_ORIGIN ??
    'http://localhost:3000'
  ).replace(/\/+$/, '');
  return `${base}/scan/${path}`;
}

export function qrSvg(payload: string) {
  return QRCode.toString(payload, {
    type: 'svg',
    errorCorrectionLevel: 'M',
    margin: 2,
  });
}
