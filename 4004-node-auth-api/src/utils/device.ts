import UAParser from 'ua-parser-js';

export interface DeviceInfo {
  device_type: string;
  device_model: string | null;
  os: string;
  browser: string;
  os_version: string | null;
  browser_version: string | null;
}

export function parseUserAgent(ua: string | undefined): DeviceInfo {
  const parser = new UAParser(ua || '');
  const device = parser.getDevice();
  const os = parser.getOS();
  const browser = parser.getBrowser();

  let deviceType = 'other';
  const type = device.type?.toLowerCase();
  if (type === 'mobile') deviceType = 'mobile';
  else if (type === 'tablet') deviceType = 'tablet';
  else if (type === 'smarttv') deviceType = 'tv';
  else if (type === 'wearable') deviceType = 'wearable';
  else deviceType = 'desktop';

  return {
    device_type: deviceType,
    device_model: device.model || null,
    os: [os.name, os.version].filter(Boolean).join(' ') || 'unknown',
    browser: [browser.name, browser.version].filter(Boolean).join(' ') || 'unknown',
    os_version: os.version || null,
    browser_version: browser.version || null,
  };
}

export function buildDeviceFingerprint(info: DeviceInfo, userAgent: string): string {
  const base = `${info.os}|${info.browser}|${info.device_type}|${info.device_model || ''}`;
  let hash = 0;
  const str = base + '|' + (userAgent || '');
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return `fp_${Math.abs(hash).toString(36)}`;
}

export function getClientIp(req: { headers: Record<string, string | string[] | undefined>; ip?: string }): string {
  const xff = req.headers['x-forwarded-for'];
  if (xff) {
    const first = (Array.isArray(xff) ? xff[0] : xff).split(',')[0].trim();
    if (first) return first;
  }
  const realIp = req.headers['x-real-ip'];
  if (realIp) {
    return Array.isArray(realIp) ? realIp[0] : realIp;
  }
  return req.ip || '0.0.0.0';
}
