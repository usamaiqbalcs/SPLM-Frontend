/**
 * URL path segment (first segment under `/`) → permission required to view the page.
 * Derived from `config/splm-navigation.ts` — do not duplicate; edit navigation config instead.
 */
import { SPLM_ROUTE_PERMISSIONS } from '@/config/splm-navigation';

export const routeSegmentRequiresPermission: Record<string, string> = SPLM_ROUTE_PERMISSIONS;
