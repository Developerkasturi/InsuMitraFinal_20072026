import { TABLE_COLUMNS_CONFIG } from '../constants/tableColumns';

class TableVisibilityManager {
  private rules: Record<string, Record<string, boolean>> = {}; // pageId -> colName -> isHidden
  private observer: MutationObserver | null = null;
  private styleElement: HTMLStyleElement | null = null;
  private registeredTables: Map<string, string[]> = new Map();

  public init() {
    if (this.observer) return;
    
    this.styleElement = document.createElement('style');
    this.styleElement.id = 'table-visibility-manager-styles';
    document.head.appendChild(this.styleElement);

    this.observer = new MutationObserver((mutations) => {
      let runCheck = false;
      for (const m of mutations) {
        if (m.addedNodes.length > 0) {
          runCheck = true;
          break;
        }
      }
      if (runCheck) this.scanTables();
    });

    this.observer.observe(document.body, { childList: true, subtree: true });
    
    // Check path changes if doing SPA routing
    let lastPath = window.location.pathname;
    setInterval(() => {
      if (lastPath !== window.location.pathname) {
        lastPath = window.location.pathname;
        setTimeout(() => this.scanTables(), 100);
      }
    }, 500);

    setTimeout(() => this.scanTables(), 500);
  }

  public setRules(data: { pageId: string, colName: string, isHidden: boolean }[]) {
    this.rules = {};
    data.forEach(r => {
      if (!this.rules[r.pageId]) this.rules[r.pageId] = {};
      this.rules[r.pageId][r.colName] = r.isHidden;
    });
    this.updateStyles();
  }

  private getPageIdFromPath(): string {
    const p = window.location.pathname.toLowerCase();
    if (p.includes('/contacts')) return 'contacts';
    if (p.includes('/leads')) return 'leads';
    if (p.includes('/policies')) return 'policies';
    if (p.includes('/claims')) return 'claims';
    if (p.includes('/emi')) return 'emi_tracking';
    if (p.includes('/phc')) return 'phc_tracking';
    if (p.includes('/employees') || p.includes('/attendance') || p.includes('/eod')) return 'employees';
    if (p.includes('/commissions')) return 'commissions';
    if (p.includes('/whatsapp')) return 'whatsapp';
    if (p.includes('/workspace')) return 'workspace';
    if (p.includes('/dashboard')) return 'dashboard';
    if (p.includes('/superadmin')) return 'superadmin';
    if (p.includes('/subscriptions')) return 'subscription';
    if (p.includes('/operations') || p.includes('/settings')) return 'operations';
    return 'unknown';
  }

  private scanTables() {
    const tables = document.querySelectorAll('table');
    const pageId = this.getPageIdFromPath();
    let hasNew = false;
    
    tables.forEach((table) => {
      // we generate an ID for the table based on its headers to ensure consistency
      const thead = table.querySelector('thead');
      if (!thead) return;
      
      const ths = Array.from(thead.querySelectorAll('th'));
      if (ths.length === 0) return;

      const headers = ths.map(th => th.innerText.trim());
      const hash = headers.join('|').replace(/[^a-zA-Z0-9]/g, '');
      const uniqueId = `table-col-managed-${pageId}-${hash}`;

      if (table.getAttribute('data-table-col-id') !== uniqueId) {
        table.setAttribute('data-table-col-id', uniqueId);
        this.registeredTables.set(uniqueId, headers);
        hasNew = true;
      }
    });

    if (hasNew) {
      this.updateStyles();
    }
  }

  private updateStyles() {
    if (!this.styleElement) return;
    
    let cssText = '';
    
    for (const [tableId, headers] of this.registeredTables.entries()) {
      // tableId contains pageId, extract it. e.g. table-col-managed-contacts-Hash
      const parts = tableId.split('-');
      if (parts.length < 5) continue; 
      const pageId = parts[3]; 

      const pageRules = this.rules[pageId] || {};
      
      headers.forEach((colName, index) => {
        // Find if this colName matches ANY configured hidden column logic
        // Because of variations in spacing or text, we can do a loose match or exact
        const isHidden = pageRules[colName] === true;
        if (isHidden) {
          const nth = index + 1;
          cssText += `table[data-table-col-id="${tableId}"] th:nth-child(${nth}), `;
          cssText += `table[data-table-col-id="${tableId}"] td:nth-child(${nth}) `;
          cssText += `{ display: none !important; }\n`;
        }
      });
    }

    this.styleElement.innerHTML = cssText;
  }
}

export const tableVisibilityManager = new TableVisibilityManager();
