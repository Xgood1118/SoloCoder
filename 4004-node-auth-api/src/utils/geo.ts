export interface GeoInfo {
  country: string | null;
  region: string | null;
  city: string | null;
}

export async function lookupIpLocation(ip: string): Promise<GeoInfo> {
  if (!ip || ip === '::1' || ip === '127.0.0.1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
    return { country: null, region: null, city: null };
  }
  try {
    const res = await fetch(`http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,regionName,city`, {
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) return { country: null, region: null, city: null };
    const data = (await res.json()) as { status: string; country?: string; regionName?: string; city?: string };
    if (data.status !== 'success') return { country: null, region: null, city: null };
    return {
      country: data.country || null,
      region: data.regionName || null,
      city: data.city || null,
    };
  } catch {
    return { country: null, region: null, city: null };
  }
}

export function formatLocation(geo: GeoInfo): string | null {
  const parts = [geo.country, geo.region, geo.city].filter(Boolean);
  return parts.length ? parts.join('/') : null;
}
