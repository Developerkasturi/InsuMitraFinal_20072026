import { TABLE_COLUMNS_CONFIG } from '../constants/tableColumns';

class TableVisibilityManager {
  private rules: Record<string, Record<string, boolean>> = {}; // pageId -> colName -> isHidden
  private observer: MutationObserver | null = null;
  private styleElement: HTMLStyleElement | null = null;

  public init() {
    if (this.observer) return;
    
    this.styleElement = document.createElement('style');
    this.styleElement.id = 'table-visibility-manager-styles';
    document.head.appendChild(this.styleElement);

    this.observer = new MutationObserver(() => {
      this.updateStyles();
    });

    this.observer.observe(document.body, { childList: true, subtree: true });
    
    // Check path changes if doing SPA routing or tab navigation
    let lastUrl = window.location.pathname + window.location.search;
    setInterval(() => {
      const currentUrl = window.location.pathname + window.location.search;
      if (lastUrl !== currentUrl) {
        lastUrl = currentUrl;
        this.updateStyles();
      }
    }, 150);

    setTimeout(() => this.updateStyles(), 200);
  }

  public setRules(data: any) {
    this.rules = {};
    const list: any[] = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []);
    list.forEach(r => {
      if (!this.rules[r.pageId]) this.rules[r.pageId] = {};
      const normKey = this.normalize(r.colName);
      if (normKey) {
        this.rules[r.pageId][normKey] = r.isHidden;
      }
    });
    this.updateStyles();
  }

  private getPageIdFromPath(): string {
    const p = (window.location.pathname + window.location.search).toLowerCase();
    if (p.includes('tab=phc') || p.includes('/phc')) return 'phc_tracking';
    if (p.includes('tab=emi') || p.includes('/emi')) return 'emi_tracking';
    if (p.includes('/contacts')) return 'contacts';
    if (p.includes('/leads')) return 'leads';
    if (p.includes('/policies')) return 'policies';
    if (p.includes('/claims')) return 'claims';
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

  private normalize(str: string): string {
    if (!str) return '';
    let s = str
      .replace(/[\^▲▼↑↓↕✕\n\r\t]/g, '')
      .toLowerCase();
    
    // Map common aliases / synonyms
    s = s.replace(/client\s*name/g, 'proposername');
    s = s.replace(/policy\s*no\.?/g, 'policynumber');
    s = s.replace(/contact\s*no\.?/g, 'contactnumber');
    s = s.replace(/phone\s*no\.?/g, 'phonenumber');
    s = s.replace(/emis/g, 'noofinst');
    s = s.replace(/no\.\s*of\s*inst\.?/g, 'noofinst');
    s = s.replace(/inst\.\s*amount/g, 'instamount');
    s = s.replace(/installment\s*amount/g, 'instamount');
    s = s.replace(/claim\s*no\.?/g, 'claimid');
    s = s.replace(/claim\s*number/g, 'claimid');
    s = s.replace(/claimed\s*amount/g, 'claimedamt');
    s = s.replace(/settled\s*amount/g, 'settledamt');
    
    return s
      .replace(/[^a-zA-Z0-9]/g, '')
      .toLowerCase();
  }

  public updateStyles() {
    const pageId = this.getPageIdFromPath();
    const pageRules = this.rules[pageId] || {};
    const tables = document.querySelectorAll('table');
    
    let cssText = '';

    tables.forEach((table, tIdx) => {
      const thead = table.querySelector('thead');
      if (!thead) return;

      const ths = Array.from(thead.querySelectorAll('th'));
      if (ths.length === 0) return;

      const tableId = `tc-table-${pageId}-${tIdx}`;
      table.setAttribute('data-table-col-id', tableId);

      const rows = Array.from(table.querySelectorAll('tbody tr'));

      ths.forEach((th, index) => {
        const normHeader = this.normalize(th.innerText);
        if (!normHeader) return;

        // Exact match against normalized rules
        const isHidden = pageRules[normHeader] === true;

        // 1. Direct inline style on DOM elements for instant guarantee
        if (isHidden) {
          th.style.display = 'none';
          th.setAttribute('data-col-hidden', 'true');
        } else {
          th.style.display = '';
          th.removeAttribute('data-col-hidden');
        }

        rows.forEach(tr => {
          // If this is a colSpan row (e.g. empty state "No records match"), skip it
          if (tr.children.length === 1 && tr.children[0]?.getAttribute('colspan')) return;
          const td = tr.children[index] as HTMLElement;
          if (td) {
            if (isHidden) {
              td.style.display = 'none';
              td.setAttribute('data-col-hidden', 'true');
            } else {
              td.style.display = '';
              td.removeAttribute('data-col-hidden');
            }
          }
        });

        // 2. CSS rule backup
        if (isHidden) {
          const nth = index + 1;
          cssText += `table[data-table-col-id="${tableId}"] th:nth-child(${nth}), `;
          cssText += `table[data-table-col-id="${tableId}"] td:nth-child(${nth}) `;
          cssText += `{ display: none !important; }\n`;
        }
      });
    });

    if (this.styleElement) {
      this.styleElement.innerHTML = cssText;
    }
  }
}

export const tableVisibilityManager = new TableVisibilityManager();
