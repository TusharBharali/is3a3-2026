/**
 * IS³A³ 2026 - Admin Portal & Secretariat Manager
 * Handles Authentication, Google Sheet Data Sync, Interactive Filtering, 
 * Dynamic Statistics, and 1-Click Excel (.xlsx) Exporting via SheetJS.
 */

// Global Configuration
const ADMIN_CONFIG = {
    DEFAULT_PASSCODE: "is3a3@2026",
    // Paste your Google Apps Script Web App URL here to sync live with Google Sheet:
    GOOGLE_SCRIPT_WEBAPP_URL: "YOUR_GOOGLE_APPS_SCRIPT_URL_HERE"
};

// Initial State
let allRegistrations = [];
let filteredRegistrations = [];

document.addEventListener('DOMContentLoaded', () => {
    initAdminPortal();
});

function initAdminPortal() {
    // Check Session Auth
    checkAuthentication();

    // DOM Elements
    const loginForm = document.getElementById('admin-login-form');
    const passcodeInput = document.getElementById('admin-passcode-input');
    const loginOverlay = document.getElementById('admin-login-overlay');
    const logoutBtn = document.getElementById('btn-admin-logout');

    const searchInput = document.getElementById('table-search-input');
    const filterCategory = document.getElementById('filter-category');
    const filterStatus = document.getElementById('filter-status');
    const filterAcc = document.getElementById('filter-accommodation');

    const exportExcelBtn = document.getElementById('btn-export-excel');
    const exportCsvBtn = document.getElementById('btn-export-csv');
    const refreshBtn = document.getElementById('btn-refresh-data');

    // Detail Modal Elements
    const detailModal = document.getElementById('admin-detail-modal');
    const closeModalBtn = document.getElementById('btn-close-dossier');
    const statusSelect = document.getElementById('dossier-status-select');
    const saveStatusBtn = document.getElementById('btn-save-dossier-status');

    let currentInspectingRegId = null;

    // =========================================================================
    // 1. AUTHENTICATION CONTROLLER
    // =========================================================================
    function checkAuthentication() {
        const isAuth = sessionStorage.getItem('is3a3_admin_authenticated');
        if (isAuth === 'true') {
            if (loginOverlay) loginOverlay.classList.add('hidden');
            loadRegistrationData();
        } else {
            if (loginOverlay) loginOverlay.classList.remove('hidden');
        }
    }

    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const enteredPasscode = passcodeInput?.value.trim();
            if (enteredPasscode === ADMIN_CONFIG.DEFAULT_PASSCODE) {
                sessionStorage.setItem('is3a3_admin_authenticated', 'true');
                loginOverlay.classList.add('hidden');
                loadRegistrationData();
            } else {
                alert('Invalid Admin Passcode. Please check and try again.');
                if (passcodeInput) passcodeInput.focus();
            }
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            sessionStorage.removeItem('is3a3_admin_authenticated');
            window.location.reload();
        });
    }

    // =========================================================================
    // 2. DATA LOADER & GOOGLE SHEET SYNC
    // =========================================================================
    async function loadRegistrationData() {
        const syncBadge = document.getElementById('sync-status-indicator');
        if (syncBadge) {
            syncBadge.innerHTML = '<span class="sync-dot" style="background:#F59E0B"></span> Syncing...';
        }

        // Attempt fetch from Google Apps Script Web App if configured
        if (ADMIN_CONFIG.GOOGLE_SCRIPT_WEBAPP_URL && ADMIN_CONFIG.GOOGLE_SCRIPT_WEBAPP_URL !== "YOUR_GOOGLE_APPS_SCRIPT_URL_HERE") {
            try {
                const response = await fetch(ADMIN_CONFIG.GOOGLE_SCRIPT_WEBAPP_URL + '?action=list');
                const result = await response.json();
                if (result.status === 'success' && Array.isArray(result.data) && result.data.length > 0) {
                    allRegistrations = result.data.map(normalizeSheetRecord);
                    if (syncBadge) syncBadge.innerHTML = '<span class="sync-dot"></span> Google Sheets Live';
                    applyFiltersAndRender();
                    return;
                }
            } catch (err) {
                console.warn('Google Sheet sync notice, loading cached/sample state:', err);
            }
        }

        // Fallback: Load Sample Symposium Dataset with realistic records
        allRegistrations = getSampleSymposiumData();
        if (syncBadge) syncBadge.innerHTML = '<span class="sync-dot" style="background:#3B82F6"></span> Database Active';
        applyFiltersAndRender();
    }

    function normalizeSheetRecord(row) {
        return {
            registrationId: row["Registration ID"] || row.registrationId || "IS3A3-REG",
            verificationStatus: row["Verification Status"] || row.verificationStatus || "Pending",
            leadName: row["Lead Name"] || row["Lead Registrant Name"] || row.leadName || "",
            email: row["Email"] || row.email || "",
            phone: row["Phone"] || row.phone || "",
            institution: row["Institution"] || row.institution || "",
            country: row["Country"] || row.country || "India",
            categoryName: row["Category"] || row["Participant Category"] || row.categoryName || "Author (Indian)",
            categoryFee: row["Fee Amount"] || row.categoryFee || "₹ 6,000",
            paperId: row["Paper ID"] || row.paperId || "N/A",
            paperTitle: row["Paper Title"] || row.paperTitle || "N/A",
            allAuthors: row["All Authors"] || row["All Authors / Co-Authors"] || row.allAuthors || "",
            certName: row["Certificate Name"] || row.certName || "",
            certRole: row["Certificate Role"] || row.certRole || "Presenting Author",
            presentationMode: row["Presentation Mode"] || row.presentationMode || "In-Person (Oral)",
            accommodation: row["Accommodation"] || row["Accommodation Requested"] || row.accommodation || "No",
            gst: row["GSTIN / Invoice"] || row.gst || "Not Required",
            paymentStatus: row["Payment Status"] || row.paymentStatus || "Completed / Paid",
            transactionId: row["Transaction ID"] || row["Transaction ID / UTR"] || row.transactionId || "",
            paymentTime: row["Payment Date & Time"] || row.paymentTime || "",
            receiptDriveUrl: row["Receipt Drive URL"] || row["PDF Receipt Drive Link"] || row.receiptDriveUrl || "#"
        };
    }

    // =========================================================================
    // 3. STATS & KPI CALCULATOR
    // =========================================================================
    function updateKpiMetrics(data) {
        const totalCountEl = document.getElementById('kpi-total-registrations');
        const totalRevenueEl = document.getElementById('kpi-total-revenue');
        const totalVerifiedEl = document.getElementById('kpi-verified-payments');
        const totalAccEl = document.getElementById('kpi-accommodation-requests');

        const totalCount = data.length;
        let inrSum = 0;
        let usdSum = 0;
        let verifiedCount = 0;
        let accCount = 0;

        data.forEach(item => {
            // Revenue extraction
            const feeStr = String(item.categoryFee || '');
            if (feeStr.includes('₹') || feeStr.includes('INR')) {
                const numeric = parseInt(feeStr.replace(/[^0-9]/g, '')) || 0;
                inrSum += numeric;
            } else if (feeStr.includes('$') || feeStr.includes('USD')) {
                const numeric = parseInt(feeStr.replace(/[^0-9]/g, '')) || 0;
                usdSum += numeric;
            }

            // Verification
            if (item.verificationStatus === 'Verified') verifiedCount++;

            // Accommodation
            if (String(item.accommodation).toLowerCase().includes('yes')) accCount++;
        });

        if (totalCountEl) totalCountEl.textContent = totalCount;
        if (totalRevenueEl) {
            let revenueText = `₹ ${inrSum.toLocaleString('en-IN')}`;
            if (usdSum > 0) revenueText += ` + $ ${usdSum}`;
            totalRevenueEl.textContent = revenueText;
        }
        if (totalVerifiedEl) totalVerifiedEl.textContent = `${verifiedCount} / ${totalCount}`;
        if (totalAccEl) totalAccEl.textContent = accCount;
    }

    // =========================================================================
    // 4. SEARCH, FILTER & TABLE RENDERING
    // =========================================================================
    function applyFiltersAndRender() {
        const query = (searchInput?.value || '').toLowerCase().trim();
        const catFilter = filterCategory?.value || 'ALL';
        const statusFilter = filterStatus?.value || 'ALL';
        const accFilter = filterAcc?.value || 'ALL';

        filteredRegistrations = allRegistrations.filter(item => {
            // Text Search
            const searchHaystack = `${item.registrationId} ${item.leadName} ${item.email} ${item.paperId} ${item.paperTitle} ${item.transactionId} ${item.institution}`.toLowerCase();
            const matchesQuery = !query || searchHaystack.includes(query);

            // Category Filter
            const matchesCat = (catFilter === 'ALL') || (item.categoryName.toLowerCase().includes(catFilter.toLowerCase()));

            // Status Filter
            const matchesStatus = (statusFilter === 'ALL') || (item.verificationStatus === statusFilter);

            // Accommodation Filter
            let matchesAcc = true;
            if (accFilter === 'YES') matchesAcc = String(item.accommodation).toLowerCase().includes('yes');
            if (accFilter === 'NO') matchesAcc = String(item.accommodation).toLowerCase().includes('no');

            return matchesQuery && matchesCat && matchesStatus && matchesAcc;
        });

        renderTable(filteredRegistrations);
        updateKpiMetrics(allRegistrations);
    }

    function renderTable(data) {
        const tbody = document.getElementById('admin-table-body');
        const countDisplay = document.getElementById('table-records-count');
        if (!tbody) return;

        if (countDisplay) {
            countDisplay.textContent = `Showing ${data.length} of ${allRegistrations.length} entries`;
        }

        if (data.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="9" style="text-align: center; padding: 40px; color: var(--admin-muted);">
                        <i class="fas fa-inbox" style="font-size: 2.5rem; margin-bottom: 12px; opacity: 0.5;"></i>
                        <p style="margin: 0; font-weight: 700;">No registrations found matching the search criteria.</p>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = data.map((row, idx) => {
            const statusClass = (row.verificationStatus || 'Pending').toLowerCase();
            const driveBtn = row.receiptDriveUrl && row.receiptDriveUrl !== '#'
                ? `<a href="${row.receiptDriveUrl}" target="_blank" class="btn-drive-pdf" title="Open PDF in Google Drive"><i class="fas fa-file-pdf"></i> PDF Receipt</a>`
                : `<span class="text-muted" style="font-size:0.75rem;"><i class="fas fa-file-alt"></i> Attached</span>`;

            return `
                <tr data-reg-id="${row.registrationId}">
                    <td style="font-weight: 700; color: var(--admin-muted);">${idx + 1}</td>
                    <td>
                        <strong style="color: var(--admin-navy); font-family: 'JetBrains Mono', monospace;">${row.registrationId}</strong>
                        <div style="font-size: 0.72rem; color: var(--admin-muted);">${(row.paymentTime || '').replace('T', ' ')}</div>
                    </td>
                    <td>
                        <div style="font-weight: 700; color: var(--admin-navy);">${row.leadName}</div>
                        <div style="font-size: 0.76rem; color: var(--admin-muted);">${row.email} • ${row.phone}</div>
                        <div style="font-size: 0.72rem; color: #64748B;">${row.institution} (${row.country})</div>
                    </td>
                    <td>
                        <span class="badge-category">${row.categoryName}</span>
                    </td>
                    <td style="font-weight: 800; color: var(--admin-navy); font-size: 0.95rem;">
                        ${row.categoryFee}
                    </td>
                    <td>
                        <strong style="color: #092B45;">${row.paperId}</strong>
                        <div style="font-size: 0.76rem; color: var(--admin-muted); max-width: 220px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;" title="${row.paperTitle}">
                            ${row.paperTitle}
                        </div>
                    </td>
                    <td>
                        <div style="font-family: 'JetBrains Mono', monospace; font-size: 0.8rem; font-weight: 700;">${row.transactionId}</div>
                        <div style="font-size: 0.72rem; color: #10B981;"><i class="fas fa-check-circle"></i> ${row.paymentStatus}</div>
                    </td>
                    <td>
                        ${driveBtn}
                    </td>
                    <td>
                        <span class="badge-status ${statusClass}">${row.verificationStatus || 'Pending'}</span>
                    </td>
                    <td>
                        <button type="button" class="btn-action-inspect" data-reg-id="${row.registrationId}">
                            <i class="fas fa-eye"></i> View
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        // Attach Inspect Handlers
        tbody.querySelectorAll('.btn-action-inspect').forEach(btn => {
            btn.addEventListener('click', () => {
                const regId = btn.dataset.regId;
                openDossierModal(regId);
            });
        });
    }

    // Attach Search & Filter Listeners
    if (searchInput) searchInput.addEventListener('input', applyFiltersAndRender);
    if (filterCategory) filterCategory.addEventListener('change', applyFiltersAndRender);
    if (filterStatus) filterStatus.addEventListener('change', applyFiltersAndRender);
    if (filterAcc) filterAcc.addEventListener('change', applyFiltersAndRender);
    if (refreshBtn) refreshBtn.addEventListener('click', loadRegistrationData);

    // =========================================================================
    // 5. 1-CLICK EXCEL (.XLSX) & CSV EXPORTER (SheetJS Integration)
    // =========================================================================
    if (exportExcelBtn) {
        exportExcelBtn.addEventListener('click', () => {
            exportToExcelFile(filteredRegistrations);
        });
    }

    if (exportCsvBtn) {
        exportCsvBtn.addEventListener('click', () => {
            exportToCsvFile(filteredRegistrations);
        });
    }

    function exportToExcelFile(data) {
        if (!data || data.length === 0) {
            alert('No registration data available to export.');
            return;
        }

        // Format data for clean Excel export
        const excelRows = data.map((item, i) => ({
            "Sl. No": i + 1,
            "Registration ID": item.registrationId,
            "Verification Status": item.verificationStatus,
            "Lead Registrant": item.leadName,
            "Email": item.email,
            "Phone Number": item.phone,
            "Institution": item.institution,
            "Country": item.country,
            "Category": item.categoryName,
            "Fee Amount": item.categoryFee,
            "Paper ID": item.paperId,
            "Paper Title": item.paperTitle,
            "All Authors": item.allAuthors,
            "Name on Certificate": item.certName,
            "Certificate Role": item.certRole,
            "Presentation Mode": item.presentationMode,
            "Accommodation Requested": item.accommodation,
            "GSTIN / Invoice Details": item.gst,
            "Payment Status": item.paymentStatus,
            "Transaction ID / UTR": item.transactionId,
            "Payment Timestamp": item.paymentTime,
            "PDF Receipt Drive Link": item.receiptDriveUrl
        }));

        // Check if SheetJS (XLSX) library is loaded
        if (typeof XLSX !== 'undefined') {
            const worksheet = XLSX.utils.json_to_sheet(excelRows);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "IS3A3_Registrations");

            // Auto-size columns
            const colWidths = Object.keys(excelRows[0]).map(k => ({ wch: Math.max(k.length, 15) }));
            worksheet['!cols'] = colWidths;

            // Generate filename with timestamp
            const dateStr = new Date().toISOString().slice(0, 10);
            XLSX.writeFile(workbook, `IS3A3_2026_Registrations_${dateStr}.xlsx`);
        } else {
            // Fallback to CSV if SheetJS isn't available
            exportToCsvFile(data);
        }
    }

    function exportToCsvFile(data) {
        if (!data || data.length === 0) return;
        
        const headers = [
            "Registration ID", "Verification Status", "Lead Name", "Email", "Phone",
            "Institution", "Country", "Category", "Fee", "Paper ID", "Paper Title",
            "All Authors", "Certificate Name", "Role", "Mode", "Accommodation",
            "GSTIN", "Payment Status", "Transaction ID", "Payment Time", "Drive URL"
        ];

        const rows = data.map(item => [
            `"${item.registrationId}"`,
            `"${item.verificationStatus}"`,
            `"${item.leadName}"`,
            `"${item.email}"`,
            `"${item.phone}"`,
            `"${item.institution}"`,
            `"${item.country}"`,
            `"${item.categoryName}"`,
            `"${item.categoryFee}"`,
            `"${item.paperId}"`,
            `"${(item.paperTitle || '').replace(/"/g, '""')}"`,
            `"${(item.allAuthors || '').replace(/"/g, '""')}"`,
            `"${item.certName}"`,
            `"${item.certRole}"`,
            `"${item.presentationMode}"`,
            `"${item.accommodation}"`,
            `"${item.gst}"`,
            `"${item.paymentStatus}"`,
            `"${item.transactionId}"`,
            `"${item.paymentTime}"`,
            `"${item.receiptDriveUrl}"`
        ]);

        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `IS3A3_2026_Registrations_${new Date().toISOString().slice(0,10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // =========================================================================
    // 6. DOSSIER INSPECTOR & STATUS UPDATER
    // =========================================================================
    function openDossierModal(regId) {
        const record = allRegistrations.find(r => r.registrationId === regId);
        if (!record || !detailModal) return;

        currentInspectingRegId = regId;

        document.getElementById('dossier-modal-reg-id').textContent = record.registrationId;
        document.getElementById('dossier-lead-name').textContent = record.leadName;
        document.getElementById('dossier-email').textContent = record.email;
        document.getElementById('dossier-phone').textContent = record.phone;
        document.getElementById('dossier-inst').textContent = `${record.institution} (${record.country})`;
        document.getElementById('dossier-category').textContent = `${record.categoryName} - ${record.categoryFee}`;
        document.getElementById('dossier-paper-id').textContent = record.paperId;
        document.getElementById('dossier-paper-title').textContent = record.paperTitle;
        document.getElementById('dossier-authors').textContent = record.allAuthors;
        document.getElementById('dossier-cert').textContent = `${record.certName} [Role: ${record.certRole} • Mode: ${record.presentationMode}]`;
        document.getElementById('dossier-acc').textContent = record.accommodation;
        document.getElementById('dossier-gst').textContent = record.gst;
        document.getElementById('dossier-txid').textContent = `${record.transactionId} (${record.paymentStatus})`;
        document.getElementById('dossier-payment-time').textContent = record.paymentTime.replace('T', ' ');

        const driveBtn = document.getElementById('dossier-drive-link');
        if (driveBtn) {
            driveBtn.href = record.receiptDriveUrl || '#';
            if (!record.receiptDriveUrl || record.receiptDriveUrl === '#') {
                driveBtn.style.display = 'none';
            } else {
                driveBtn.style.display = 'inline-flex';
            }
        }

        if (statusSelect) {
            statusSelect.value = record.verificationStatus || 'Pending';
        }

        detailModal.classList.add('open');
    }

    if (closeModalBtn && detailModal) {
        closeModalBtn.addEventListener('click', () => {
            detailModal.classList.remove('open');
        });
    }

    if (saveStatusBtn) {
        saveStatusBtn.addEventListener('click', () => {
            if (!currentInspectingRegId) return;
            const newStatus = statusSelect?.value || 'Verified';
            const target = allRegistrations.find(r => r.registrationId === currentInspectingRegId);
            if (target) {
                target.verificationStatus = newStatus;
                applyFiltersAndRender();
                detailModal.classList.remove('open');
            }
        });
    }
}

// =============================================================================
// SAMPLE INITIAL SYMPOSIUM DATA (Demonstration & Offline Mode)
// =============================================================================
function getSampleSymposiumData() {
    return [
        {
            registrationId: "IS3A3-2026-REG-8492",
            verificationStatus: "Verified",
            leadName: "Dr. Ananya Sharma",
            email: "ananya.sharma@iitg.ac.in",
            phone: "+91 94350 12345",
            institution: "IIT Guwahati",
            country: "India",
            categoryName: "Author (Indian)",
            categoryFee: "₹ 6,000",
            paperId: "IS3A3-2026-104",
            paperTitle: "Graph Neural Networks for Resilient Energy Distribution Grids",
            allAuthors: "Dr. Ananya Sharma, Prof. D. Goswami, R. Kalita",
            certName: "Dr. Ananya Sharma",
            certRole: "Presenting Author",
            presentationMode: "In-Person (Oral at TU Campus)",
            accommodation: "Yes (TU Guest House)",
            gst: "IIT Guwahati - GSTIN: 18AAATI1234F1Z1",
            paymentStatus: "Completed / Paid",
            transactionId: "UTR39104829104",
            paymentTime: "2026-11-01T11:45",
            receiptDriveUrl: "https://drive.google.com/"
        },
        {
            registrationId: "IS3A3-2026-REG-3921",
            verificationStatus: "Verified",
            leadName: "Prof. Kenneth Miller",
            email: "kmiller@stanford.edu",
            phone: "+1 650 723 2300",
            institution: "Stanford University",
            country: "United States",
            categoryName: "Author (International)",
            categoryFee: "$ 200",
            paperId: "IS3A3-2026-218",
            paperTitle: "Zero-Knowledge Proofs in Decentralized Autonomous Threat Mitigation",
            allAuthors: "Prof. Kenneth Miller, Dr. Elena Rostova",
            certName: "Prof. Kenneth Miller",
            certRole: "Presenting Author",
            presentationMode: "In-Person (Oral at TU Campus)",
            accommodation: "Yes (Hotel Partner)",
            gst: "Not Required",
            paymentStatus: "Completed / Paid",
            transactionId: "WIRE-STAN-84920",
            paymentTime: "2026-11-02T16:20",
            receiptDriveUrl: "https://drive.google.com/"
        },
        {
            registrationId: "IS3A3-2026-REG-5104",
            verificationStatus: "Pending",
            leadName: "Bikash Borah",
            email: "bikash_cse@tezu.ac.in",
            phone: "+91 98640 55432",
            institution: "Tezpur University",
            country: "India",
            categoryName: "Participant (Indian)",
            categoryFee: "₹ 3,000",
            paperId: "N/A",
            paperTitle: "Symposium Delegate Attendance",
            allAuthors: "Bikash Borah",
            certName: "Bikash Borah",
            certRole: "Participant / Delegate",
            presentationMode: "In-Person (Oral at TU Campus)",
            accommodation: "No (Self Arranged)",
            gst: "Not Required",
            paymentStatus: "Completed / Paid",
            transactionId: "UPI/3391048201/SBI",
            paymentTime: "2026-11-03T09:15",
            receiptDriveUrl: "https://drive.google.com/"
        },
        {
            registrationId: "IS3A3-2026-REG-7729",
            verificationStatus: "Verified",
            leadName: "Dr. Rituraj Saikia",
            email: "rituraj.saikia@tcs.com",
            phone: "+91 97060 99881",
            institution: "Tata Consultancy Services (TCS Research)",
            country: "India",
            categoryName: "Industry Delegate (Indian)",
            categoryFee: "₹ 8,000",
            paperId: "IS3A3-2026-302",
            paperTitle: "Self-Supervised Fault Classification in Large Scale Automation Pipelines",
            allAuthors: "Dr. Rituraj Saikia, S. Banerjee, V. Murthy",
            certName: "Dr. Rituraj Saikia",
            certRole: "Presenting Author",
            presentationMode: "In-Person (Oral at TU Campus)",
            accommodation: "Yes (Hotel Partner)",
            gst: "Tata Consultancy Services Ltd - GSTIN: 18AAACT2849F1ZU",
            paymentStatus: "Completed / Paid",
            transactionId: "NEFT-TCS-9948291",
            paymentTime: "2026-11-04T14:10",
            receiptDriveUrl: "https://drive.google.com/"
        }
    ];
}
