import { describe, expect, it } from 'vitest';
import { SPLM_NAV_SECTIONS, SPLM_ROUTE_PERMISSIONS } from '@/config/splm-navigation';
import { SPLM_NAV_TAB_ICONS } from '@/config/splm-nav-icons';

describe('splm-navigation', () => {
  it('every sidebar item has a Lucide icon', () => {
    for (const g of SPLM_NAV_SECTIONS) {
      for (const item of g.items) {
        expect(SPLM_NAV_TAB_ICONS[item.tabId], `missing icon for tabId=${item.tabId}`).toBeDefined();
      }
    }
  });

  it('exposes route permissions for global search', () => {
    expect(SPLM_ROUTE_PERMISSIONS.search).toBe('read');
  });
});
