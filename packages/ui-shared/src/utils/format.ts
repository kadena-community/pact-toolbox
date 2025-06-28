/**
 * Truncate an address or string in the middle
 */
export function truncateAddress(address: string, start = 6, end = 4): string {
  if (address.length <= start + end) return address;
  return `${address.slice(0, start)}...${address.slice(-end)}`;
}

/**
 * Get initials from a name or address
 */
export function getInitials(name: string): string {
  if (!name) return '';
  
  // If it looks like an address (starts with k:), use first 2 chars after k:
  if (name.startsWith('k:')) {
    return name.slice(2, 4).toUpperCase();
  }
  
  // Otherwise get first letter of each word
  const words = name.trim().split(/\s+/);
  const initials = words
    .map(word => word[0])
    .filter(Boolean)
    .join('')
    .toUpperCase();
  
  return initials.slice(0, 2);
}

/**
 * Format a number with commas
 */
export function formatNumber(num: number | string, decimals?: number): string {
  const n = typeof num === 'string' ? parseFloat(num) : num;
  if (isNaN(n)) return '0';
  
  if (decimals !== undefined) {
    return n.toLocaleString(undefined, { 
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals 
    });
  }
  
  return n.toLocaleString();
}

/**
 * Format bytes to human readable format
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}