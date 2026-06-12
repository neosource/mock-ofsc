/* eslint-disable no-undef */
(function () {
  // API base — same origin when served by the backend, configurable otherwise
  const API_BASE = (function () {
    const fromQuery = new URLSearchParams(location.search).get('api');
    return fromQuery || `${location.origin}`;
  })();
  const BACKEND_FALLBACK = 'http://localhost:3000';
  let authDisabled = false;
  let clearMode = false;

  async function fetchRuntimeConfig() {
    const candidates = [`${API_BASE}/api/config`];

    // If frontend is hosted on a different local origin, try backend default port too.
    if (
      location.hostname === 'localhost' ||
      location.hostname === '127.0.0.1'
    ) {
      if (!API_BASE.startsWith(BACKEND_FALLBACK)) {
        candidates.push(`${BACKEND_FALLBACK}/api/config`);
      }
    }

    for (const url of candidates) {
      try {
        const res = await fetch(url);
        if (res.ok) {
          return await res.json();
        }
      } catch (_) {
        // Try next candidate.
      }
    }
    return null;
  }

  // ---- DOM refs ----
  const $ = (id) => document.getElementById(id);
  const els = {
    signinView: $('view-signin'),
    appView: $('view-app'),
    btnSignin: $('btn-signin'),
    btnSignout: $('btn-signout'),
    signinHint: $('signin-hint'),
    who: $('who'),
    whoName: $('who-name'),
    ticketsBody: $('tickets-body'),
    ticketDetails: $('ticket-details'),
    btnCloseDetails: $('btn-close-details'),
    detailsCaseNumber: $('details-case-number'),
    detailsSerial: $('details-serial'),
    detailsModel: $('details-model'),
    detailsPurchase: $('details-purchase'),
    detailsIssue: $('details-issue'),
    detailsCustomerName: $('details-customer-name'),
    detailsCustomerPhone: $('details-customer-phone'),
    detailsCustomerEmail: $('details-customer-email'),
    detailsCustomerAddress: $('details-customer-address'),
    btnTeamsDetails: $('btn-teams-details'),
  };

  // ---- API helper ----
  async function apiFetch(path, options = {}) {
    const headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
    if (!authDisabled) {
      const token = await AppAuth.getAccessToken();
      headers.Authorization = `Bearer ${token}`;
    }
    const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
    if (!res.ok) {
      let body = null;
      try { body = await res.json(); } catch (_) { /* ignore */ }
      const err = new Error(body && body.error ? body.error : `HTTP ${res.status}`);
      err.status = res.status;
      err.body = body;
      throw err;
    }
    return res.json();
  }

  // ---- View toggles ----
  function showSignedIn(acct) {
    els.signinView.hidden = true;
    els.appView.hidden = false;
    els.who.hidden = authDisabled;
    els.whoName.textContent = acct.name || acct.username || 'Signed in';
    loadTickets();
  }
  function showSignedOut() {
    els.signinView.hidden = false;
    els.appView.hidden = true;
    els.who.hidden = true;
  }

  // ---- Ticket table rendering ----
  function renderTickets(items) {
    if (!items.length) {
      els.ticketsBody.innerHTML = '<tr><td colspan="8" class="empty-state">No service tickets found.</td></tr>';
      return;
    }
    
    els.ticketsBody.innerHTML = items
      .map((ticket) => {
        const eq = ticket.equipment || {};
        const customer = ticket.customer || {};
        const status = ticket.status || 'open';
        const createdDate = new Date(ticket.createdAt).toLocaleString();
        
        return `
          <tr data-case-number="${escapeHtml(ticket.caseNumber)}">
            <td class="case-number-cell">${escapeHtml(ticket.caseNumber)}</td>
            <td><span class="status-pill ${escapeHtml(status)}">${escapeHtml(status.replace('_', ' '))}</span></td>
            <td>${escapeHtml(eq.productModel || '—')}</td>
            <td>${escapeHtml(eq.serialNumber || '—')}</td>
            <td>${escapeHtml(customer.name || '—')}</td>
            <td>${escapeHtml(customer.phone || '—')}</td>
            <td>${escapeHtml(createdDate)}</td>
            <td>
              <button class="btn btn-view-details" type="button" data-case-number="${escapeHtml(ticket.caseNumber)}">
                View Details
              </button>
            </td>
          </tr>`;
      })
      .join('');
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function showTicketDetails(ticket) {
    const eq = ticket.equipment || {};
    const customer = ticket.customer || {};
    
    els.detailsCaseNumber.textContent = ticket.caseNumber;
    els.detailsSerial.textContent = eq.serialNumber || '—';
    els.detailsModel.textContent = eq.productModel || '—';
    els.detailsPurchase.textContent = eq.purchaseDate || '—';
    els.detailsIssue.textContent = eq.issueDescription || '—';
    els.detailsCustomerName.textContent = customer.name || '—';
    els.detailsCustomerPhone.textContent = customer.phone || '—';
    els.detailsCustomerEmail.textContent = customer.email || '—';
    els.detailsCustomerAddress.textContent = customer.address || '—';
    
    if (ticket.teamsChatUrl) {
      els.btnTeamsDetails.href = ticket.teamsChatUrl;
    }
    
    els.ticketDetails.hidden = false;
    els.ticketDetails.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function hideTicketDetails() {
    els.ticketDetails.hidden = true;
  }

  async function loadTickets() {
    try {
      const data = await apiFetch('/api/cases?limit=100');
      renderTickets(data.items || []);
    } catch (err) {
      console.error('Failed to load tickets', err);
      els.ticketsBody.innerHTML = `<tr><td colspan="8" class="error-state">Failed to load tickets: ${escapeHtml(err.message)}</td></tr>`;
    }
  }

  async function viewTicketDetails(caseNumber) {
    try {
      const ticket = await apiFetch(`/api/cases/${encodeURIComponent(caseNumber)}`);
      showTicketDetails(ticket);
    } catch (err) {
      console.error('Failed to load ticket details', err);
      alert('Failed to load ticket details: ' + (err.message || 'error'));
    }
  }

  function toDesktopTeamsUrl(webUrl) {
    return webUrl.replace(
      /^https:\/\/teams\.microsoft\.com\//i,
      'msteams://teams.microsoft.com/'
    );
  }

  // ---- Wire up events ----
  els.btnSignin.addEventListener('click', async () => {
    if (authDisabled) {
      showSignedIn({ name: 'Dev Mode' });
      return;
    }
    els.signinHint.textContent = 'Signing in…';
    els.signinHint.classList.remove('error');
    els.btnSignin.disabled = true;
    try {
      const acct = await AppAuth.signIn();
      showSignedIn(acct);
    } catch (err) {
      console.error(err);
      els.signinHint.textContent = 'Sign-in failed: ' + (err.message || err);
      els.signinHint.classList.add('error');
    } finally {
      els.btnSignin.disabled = false;
    }
  });

  els.btnSignout.addEventListener('click', async () => {
    try { await AppAuth.signOut(); } catch (_) { /* ignore */ }
    showSignedOut();
  });

  // Handle view details button clicks
  els.ticketsBody.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-case-number]');
    if (!btn) return;
    const caseNumber = btn.getAttribute('data-case-number');
    if (!caseNumber) return;
    viewTicketDetails(caseNumber);
  });

  // Handle close details button
  els.btnCloseDetails.addEventListener('click', () => {
    hideTicketDetails();
  });

  // Desktop Teams tends to handle deep links more reliably than web in some environments.
  els.btnTeamsDetails.addEventListener('click', (e) => {
    const webUrl = els.btnTeamsDetails.href;
    if (!webUrl || !/^https:\/\/teams\.microsoft\.com\//i.test(webUrl)) return;

    e.preventDefault();
    const desktopUrl = toDesktopTeamsUrl(webUrl);

    let focusShifted = false;
    function onBlur() {
      focusShifted = true;
    }

    window.addEventListener('blur', onBlur, { once: true });
    window.location.href = desktopUrl;

    // If desktop protocol is unavailable, fall back to regular web URL.
    setTimeout(() => {
      if (!focusShifted) {
        window.open(webUrl, '_blank', 'noopener');
      }
    }, 1200);
  });

  // ---- Boot ----
  (async function boot() {
    try {
      const cfg = await fetchRuntimeConfig();
      if (cfg) {
        authDisabled = Boolean(cfg.authDisabled);

        if (!authDisabled && cfg.auth) {
          if (cfg.auth.tenantId) {
            AppAuth.CONFIG.tenantId = cfg.auth.tenantId;
          }
          if (cfg.auth.apiScope) {
            AppAuth.CONFIG.apiScope = cfg.auth.apiScope;
          }
        }
      }

      if (authDisabled) {
        showSignedIn({ name: 'Dev Mode' });
        return;
      }

      await AppAuth.init();
      const acct = AppAuth.getAccount();
      if (acct) {
        showSignedIn(acct);
      } else {
        showSignedOut();
      }
    } catch (err) {
      console.error('Auth init failed', err);
      els.signinHint.textContent = 'Auth init failed: ' + (err.message || err);
      els.signinHint.classList.add('error');
    }
  })();
})();
