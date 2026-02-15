// Domain-based timezone guessing
// Maps TLDs and common domains to likely timezones

const DOMAIN_TIMEZONE_MAP = {
  // Europe
  '.pl': 'Europe/Warsaw',      // Poland
  '.de': 'Europe/Berlin',      // Germany
  '.fr': 'Europe/Paris',       // France
  '.it': 'Europe/Rome',        // Italy
  '.es': 'Europe/Madrid',      // Spain
  '.uk': 'Europe/London',      // United Kingdom
  '.nl': 'Europe/Amsterdam',   // Netherlands
  '.be': 'Europe/Brussels',    // Belgium
  '.at': 'Europe/Vienna',     // Austria
  '.ch': 'Europe/Zurich',     // Switzerland
  '.se': 'Europe/Stockholm',  // Sweden
  '.no': 'Europe/Oslo',      // Norway
  '.dk': 'Europe/Copenhagen',  // Denmark
  '.fi': 'Europe/Helsinki',    // Finland
  '.gr': 'Europe/Athens',     // Greece
  '.pt': 'Europe/Lisbon',     // Portugal
  
  // North America
  '.com': 'America/New_York', // US (default)
  '.us': 'America/New_York', // US
  '.ca': 'America/Toronto',   // Canada
  '.mx': 'America/Mexico_City', // Mexico
  
  // Asia
  '.jp': 'Asia/Tokyo',        // Japan
  '.kr': 'Asia/Seoul',        // Korea
  '.cn': 'Asia/Shanghai',      // China
  '.hk': 'Asia/Hong_Kong',    // Hong Kong
  '.sg': 'Asia/Singapore',    // Singapore
  '.in': 'Asia/Kolkata',       // India
  '.th': 'Asia/Bangkok',      // Thailand
  '.ph': 'Asia/Manila',       // Philippines
  '.id': 'Asia/Jakarta',      // Indonesia
  
  // Australia & Pacific
  '.au': 'Australia/Sydney',  // Australia
  '.nz': 'Pacific/Auckland',  // New Zealand
  
  // South America
  '.br': 'America/Sao_Paulo', // Brazil
  '.ar': 'America/Argentina/Buenos_Aires', // Argentina
  '.cl': 'America/Santiago',  // Chile
  '.co': 'America/Bogota',   // Colombia
  '.pe': 'America/Lima',     // Peru
  
  // Africa
  '.za': 'Africa/Johannesburg', // South Africa
  '.eg': 'Africa/Cairo',      // Egypt
  
  // Middle East
  '.il': 'Asia/Jerusalem',   // Israel
  '.tr': 'Europe/Istanbul',   // Turkey
  '.ae': 'Asia/Dubai',      // UAE
  
  // Common platforms with specific timezones
  'github.com': 'America/Los_Angeles', // GitHub HQ
  'google.com': 'America/Los_Angeles', // Google HQ
  'microsoft.com': 'America/Los_Angeles', // Microsoft HQ
  'amazon.com': 'America/Los_Angeles', // Amazon HQ
  'facebook.com': 'America/Los_Angeles', // Meta HQ
  'twitter.com': 'America/Los_Angeles', // X/Twitter HQ
  'linkedin.com': 'America/Los_Angeles', // LinkedIn HQ
  'apple.com': 'America/Los_Angeles', // Apple HQ
  'netflix.com': 'America/Los_Angeles', // Netflix HQ
  'youtube.com': 'America/Los_Angeles', // YouTube HQ
  'instagram.com': 'America/Los_Angeles', // Instagram HQ
  'tiktok.com': 'Asia/Shanghai', // TikTok HQ
  'reddit.com': 'America/Los_Angeles', // Reddit HQ
  'wikipedia.org': 'America/Los_Angeles', // Wikipedia Foundation
  'stackoverflow.com': 'America/New_York', // Stack Overflow HQ
  'medium.com': 'America/Los_Angeles', // Medium HQ
  'substack.com': 'America/Los_Angeles' // Substack HQ
};

/**
 * Extract domain from URL
 */
function extractDomain(url) {
  try {
    if (!url) return null;
    
    // Remove protocol and www
    let domain = url.replace(/^https?:\/\//i, '')
                    .replace(/^www\./i, '')
                    .split('/')[0]
                    .toLowerCase();
    
    // Handle international domains (e.g., co.uk)
    const parts = domain.split('.');
    if (parts.length >= 2) {
      const tld = '.' + parts[parts.length - 1];
      const sld = parts[parts.length - 2];
      
      // Check for common second-level domains
      if (parts.length >= 3 && ['co', 'com', 'net', 'org'].includes(sld)) {
        return '.' + sld + '.' + parts[parts.length - 1];
      }
      
      return tld;
    }
    
    return domain;
  } catch (e) {
    if (DEBUG) console.error('[Domain TZ] Error extracting domain:', e);
    return null;
  }
}

/**
 * Get timezone from domain
 */
function getTimezoneFromDomain(url) {
  const domain = extractDomain(url);
  if (!domain) return null;
  
  // Direct match
  if (DOMAIN_TIMEZONE_MAP[domain]) {
    return DOMAIN_TIMEZONE_MAP[domain];
  }
  
  // Try to match by TLD
  const tldMatch = domain.match(/(\.[a-z]{2,3})$/i);
  if (tldMatch && DOMAIN_TIMEZONE_MAP[tldMatch[1]]) {
    return DOMAIN_TIMEZONE_MAP[tldMatch[1]];
  }
  
  return null;
}

/**
 * Get timezone from meta tags (og:locale, html lang, etc.)
 */
function getTimezoneFromMeta() {
  try {
    // Check HTML lang attribute
    const htmlLang = document.documentElement?.lang;
    if (htmlLang) {
      const lang = htmlLang.toLowerCase().split('-')[0];
      const langTimezones = {
        'en': 'Europe/London', // Default to UK for English
        'pl': 'Europe/Warsaw',
        'de': 'Europe/Berlin',
        'fr': 'Europe/Paris',
        'it': 'Europe/Rome',
        'es': 'Europe/Madrid',
        'pt': 'Europe/Lisbon',
        'ja': 'Asia/Tokyo',
        'ko': 'Asia/Seoul',
        'zh': 'Asia/Shanghai',
        'ru': 'Europe/Moscow',
        'ar': 'Asia/Riyadh',
        'hi': 'Asia/Kolkata',
        'th': 'Asia/Bangkok',
        'vi': 'Asia/Ho_Chi_Minh',
        'id': 'Asia/Jakarta',
        'ms': 'Asia/Kuala_Lumpur',
        'tl': 'Asia/Manila',
        'tr': 'Europe/Istanbul',
        'he': 'Asia/Jerusalem'
      };
      
      if (langTimezones[lang]) {
        return langTimezones[lang];
      }
    }
    
    // Check og:locale meta tag
    const ogLocale = document.querySelector('meta[property="og:locale"]')?.getAttribute('content');
    if (ogLocale) {
      const locale = ogLocale.toLowerCase().split('-')[0];
      const localeTimezones = {
        'en': 'Europe/London',
        'pl': 'Europe/Warsaw',
        'de': 'Europe/Berlin',
        'fr': 'Europe/Paris',
        'it': 'Europe/Rome',
        'es': 'Europe/Madrid',
        'pt': 'Europe/Lisbon',
        'ja': 'Asia/Tokyo',
        'ko': 'Asia/Seoul',
        'zh': 'Asia/Shanghai',
        'ru': 'Europe/Moscow'
      };
      
      if (localeTimezones[locale]) {
        return localeTimezones[locale];
      }
    }
  } catch (e) {
    if (DEBUG) console.error('[Domain TZ] Error getting meta timezone:', e);
  }
  
  return null;
}

/**
 * Get best guess timezone from context
 */
function getContextTimezone(url = null) {
  const domainTimezone = url ? getTimezoneFromDomain(url) : null;
  const metaTimezone = getTimezoneFromMeta();
  
  // Prefer domain-specific timezone over meta
  if (domainTimezone) {
    if (DEBUG) console.log('[Domain TZ] Using domain timezone:', domainTimezone);
    return domainTimezone;
  }
  
  if (metaTimezone) {
    if (DEBUG) console.log('[Domain TZ] Using meta timezone:', metaTimezone);
    return metaTimezone;
  }
  
  return null;
}

// Export for use in content script
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getTimezoneFromDomain,
    getTimezoneFromMeta,
    getContextTimezone,
    extractDomain
  };
}
