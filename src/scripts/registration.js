/**
 * IS³A³ 2026 - Online Registration Engine
 * Handles Dynamic Authors, File Uploads, Pricing Calculations, 
 * Form Validation, Local Storage Recovery, and Receipt Generation.
 */

document.addEventListener('DOMContentLoaded', () => {
    initRegistrationEngine();
});

function initRegistrationEngine() {
    let authorCount = 1;
    const maxAuthors = 10;
    let selectedPdfFile = null;
    let selectedPdfBase64 = null;

    // =========================================================================
    // GOOGLE APPS SCRIPT WEB APP ENDPOINT CONFIGURATION
    // Paste your deployed Google Apps Script Web App URL here:
    // =========================================================================
    const GOOGLE_SCRIPT_WEBAPP_URL = "YOUR_GOOGLE_APPS_SCRIPT_URL_HERE";

    // Elements
    const authorsContainer = document.getElementById('authors-list-container');
    const addAuthorBtn = document.getElementById('btn-add-coauthor');
    const pdfDropZone = document.getElementById('pdf-drop-zone');
    const pdfFileInput = document.getElementById('payment-pdf-input');
    const pdfPreviewCard = document.getElementById('pdf-preview-card');
    const pdfFileNameDisplay = document.getElementById('pdf-file-name');
    const pdfFileSizeDisplay = document.getElementById('pdf-file-size');
    const pdfRemoveBtn = document.getElementById('pdf-remove-btn');
    
    const setNowBtn = document.getElementById('btn-set-current-datetime');
    const paymentDateTimeInput = document.getElementById('payment-datetime');

    const accommodationToggle = document.getElementById('toggle-accommodation');
    const accommodationCollapse = document.getElementById('accommodation-collapse');
    
    const gstToggle = document.getElementById('toggle-gst');
    const gstCollapse = document.getElementById('gst-collapse');

    const categoryRadios = document.querySelectorAll('input[name="participant_category"]');
    const summaryCategory = document.getElementById('summary-category-name');
    const summaryTotal = document.getElementById('summary-total-amount');

    const regForm = document.getElementById('symposium-registration-form');
    const submitBtn = document.getElementById('btn-submit-registration');

    const successModal = document.getElementById('registration-success-modal');
    const closeModalBtn = document.getElementById('btn-close-modal');
    const printReceiptBtn = document.getElementById('btn-print-receipt');

    // Initialize Default Datetime Constraint (Max = Now)
    initDateTimeConstraints();

    // =========================================================================
    // 1. DYNAMIC MULTI-AUTHOR MANAGEMENT
    // =========================================================================
    if (addAuthorBtn && authorsContainer) {
        addAuthorBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (authorCount >= maxAuthors) {
                alert(`You can add a maximum of ${maxAuthors} authors.`);
                return;
            }

            authorCount++;
            const authorCard = document.createElement('div');
            authorCard.className = 'author-card-item';
            authorCard.dataset.authorIndex = authorCount;
            authorCard.innerHTML = `
                <div class="author-card-header">
                    <span class="author-badge">
                        <i class="fas fa-user-plus"></i> Co-Author <span class="author-num">${authorCount}</span>
                    </span>
                    <button type="button" class="btn-remove-author" title="Remove this author">
                        <i class="fas fa-trash-alt"></i> Remove
                    </button>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Co-Author Full Name <span class="required-star">*</span></label>
                        <div class="input-icon-wrapper">
                            <i class="fas fa-user input-icon"></i>
                            <input type="text" class="form-control coauthor-name" placeholder="e.g. Dr. Jane Smith" required>
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Affiliation / Institution <span class="required-star">*</span></label>
                        <div class="input-icon-wrapper">
                            <i class="fas fa-university input-icon"></i>
                            <input type="text" class="form-control coauthor-affiliation" placeholder="e.g. Stanford University" required>
                        </div>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Email Address <span class="label-tip">(Optional)</span></label>
                        <div class="input-icon-wrapper">
                            <i class="fas fa-envelope input-icon"></i>
                            <input type="email" class="form-control coauthor-email" placeholder="coauthor@institution.edu">
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Author Designation / Role</label>
                        <div class="input-icon-wrapper">
                            <i class="fas fa-id-badge input-icon"></i>
                            <select class="form-select coauthor-role">
                                <option value="Co-Author">Co-Author</option>
                                <option value="Corresponding Author">Corresponding Author</option>
                                <option value="Faculty Advisor">Faculty Advisor</option>
                                <option value="Research Scholar">Research Scholar</option>
                                <option value="Student">Student</option>
                            </select>
                        </div>
                    </div>
                </div>
            `;

            // Attach Remove Handler
            const removeBtn = authorCard.querySelector('.btn-remove-author');
            removeBtn.addEventListener('click', () => {
                authorCard.style.opacity = '0';
                authorCard.style.transform = 'translateY(-10px)';
                setTimeout(() => {
                    authorCard.remove();
                    reindexAuthors();
                }, 250);
            });

            authorsContainer.appendChild(authorCard);
            reindexAuthors();

            // Focus new name input
            const newNameInput = authorCard.querySelector('.coauthor-name');
            if (newNameInput) newNameInput.focus();
        });
    }

    function reindexAuthors() {
        const coAuthorCards = authorsContainer.querySelectorAll('.author-card-item');
        authorCount = 1 + coAuthorCards.length;
        
        coAuthorCards.forEach((card, idx) => {
            const numSpan = card.querySelector('.author-num');
            if (numSpan) numSpan.textContent = idx + 2;
        });

        // Update button state
        if (addAuthorBtn) {
            if (authorCount >= maxAuthors) {
                addAuthorBtn.style.opacity = '0.5';
                addAuthorBtn.innerHTML = `<i class="fas fa-ban"></i> Maximum Authors Reached (${maxAuthors})`;
            } else {
                addAuthorBtn.style.opacity = '1';
                addAuthorBtn.innerHTML = `<i class="fas fa-plus"></i> Add Another Co-Author (${authorCount}/${maxAuthors})`;
            }
        }
    }

    // =========================================================================
    // 2. PAYMENT PDF DRAG & DROP UPLOADER
    // =========================================================================
    if (pdfDropZone && pdfFileInput) {
        // Trigger file select on dropzone click
        pdfDropZone.addEventListener('click', () => {
            pdfFileInput.click();
        });

        // Drag & Drop visual feedbacks
        ['dragenter', 'dragover'].forEach(eventName => {
            pdfDropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                pdfDropZone.classList.add('dragover');
            });
        });

        ['dragleave', 'drop'].forEach(eventName => {
            pdfDropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                pdfDropZone.classList.remove('dragover');
            });
        });

        // File drop handler
        pdfDropZone.addEventListener('drop', (e) => {
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                handlePdfSelection(files[0]);
            }
        });

        // File input change handler
        pdfFileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                handlePdfSelection(e.target.files[0]);
            }
        });

        // Remove PDF
        if (pdfRemoveBtn) {
            pdfRemoveBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                selectedPdfFile = null;
                pdfFileInput.value = '';
                pdfPreviewCard.classList.remove('show');
                pdfDropZone.style.display = 'block';
            });
        }
    }

    function handlePdfSelection(file) {
        // Validation: must be PDF
        if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
            alert('Invalid file format. Please upload your payment receipt as a PDF document (.pdf).');
            return;
        }

        // Validation: size max 10MB
        const maxBytes = 10 * 1024 * 1024;
        if (file.size > maxBytes) {
            alert('File size exceeds the 10 MB limit. Please compress or upload a smaller PDF receipt.');
            return;
        }

        selectedPdfFile = file;

        // Read file as Base64 for Google Apps Script / Drive Upload
        const reader = new FileReader();
        reader.onload = function(e) {
            selectedPdfBase64 = e.target.result;
        };
        reader.readAsDataURL(file);

        // Display File Info
        if (pdfFileNameDisplay) pdfFileNameDisplay.textContent = file.name;
        if (pdfFileSizeDisplay) {
            const sizeInKb = (file.size / 1024).toFixed(1);
            const sizeText = sizeInKb > 1024 
                ? `${(sizeInKb / 1024).toFixed(2)} MB` 
                : `${sizeInKb} KB`;
            pdfFileSizeDisplay.textContent = `PDF Document • ${sizeText} • Ready to submit`;
        }

        if (pdfPreviewCard) pdfPreviewCard.classList.add('show');
        if (pdfDropZone) pdfDropZone.style.display = 'none';
    }

    // =========================================================================
    // 3. PAYMENT DATE & TIME QUICK SETTER
    // =========================================================================
    function initDateTimeConstraints() {
        if (!paymentDateTimeInput) return;
        
        // Format ISO string to YYYY-MM-DDTHH:mm
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        
        const currentFormatted = `${year}-${month}-${day}T${hours}:${minutes}`;
        paymentDateTimeInput.max = currentFormatted;

        if (setNowBtn) {
            setNowBtn.addEventListener('click', () => {
                const liveNow = new Date();
                const lYear = liveNow.getFullYear();
                const lMonth = String(liveNow.getMonth() + 1).padStart(2, '0');
                const lDay = String(liveNow.getDate()).padStart(2, '0');
                const lHours = String(liveNow.getHours()).padStart(2, '0');
                const lMinutes = String(liveNow.getMinutes()).padStart(2, '0');
                paymentDateTimeInput.value = `${lYear}-${lMonth}-${lDay}T${lHours}:${lMinutes}`;
            });
        }
    }

    // =========================================================================
    // 4. ACCOMMODATION & GST TOGGLES
    // =========================================================================
    if (accommodationToggle && accommodationCollapse) {
        accommodationToggle.addEventListener('change', () => {
            if (accommodationToggle.checked) {
                accommodationCollapse.classList.add('open');
            } else {
                accommodationCollapse.classList.remove('open');
            }
        });
    }

    if (gstToggle && gstCollapse) {
        gstToggle.addEventListener('change', () => {
            if (gstToggle.checked) {
                gstCollapse.classList.add('open');
            } else {
                gstCollapse.classList.remove('open');
            }
        });
    }

    // =========================================================================
    // 5. CATEGORY & DYNAMIC FEE SUMMARY
    // =========================================================================
    categoryRadios.forEach(radio => {
        radio.addEventListener('change', updateFeeSummary);
    });

    function updateFeeSummary() {
        const checkedRadio = document.querySelector('input[name="participant_category"]:checked');
        if (!checkedRadio) return;

        const catName = checkedRadio.dataset.name || 'Author (Indian)';
        const catFee = checkedRadio.dataset.fee || '₹ 6,000';

        if (summaryCategory) summaryCategory.textContent = catName;
        if (summaryTotal) summaryTotal.textContent = catFee;
    }

    // Initial calculation
    updateFeeSummary();

    // =========================================================================
    // 6. COPY BANK ACCOUNT NUMBERS HELPER
    // =========================================================================
    document.querySelectorAll('.copy-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const textToCopy = btn.dataset.copy;
            if (textToCopy) {
                navigator.clipboard.writeText(textToCopy).then(() => {
                    const originalHtml = btn.innerHTML;
                    btn.innerHTML = '<i class="fas fa-check" style="color:#10B981"></i> Copied';
                    setTimeout(() => {
                        btn.innerHTML = originalHtml;
                    }, 1800);
                });
            }
        });
    });

    // =========================================================================
    // 7. FORM SUBMISSION & SUCCESS RECEIPT MODAL
    // =========================================================================
    if (regForm) {
        regForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            // Check if PDF is uploaded
            if (!selectedPdfFile) {
                alert('Please upload your Payment Proof Receipt in PDF format.');
                if (pdfDropZone) {
                    pdfDropZone.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    pdfDropZone.style.borderColor = '#EF4444';
                    setTimeout(() => {
                        pdfDropZone.style.borderColor = '';
                    }, 2000);
                }
                return;
            }

            // Animate Button Loading State
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = `<i class="fas fa-circle-notch fa-spin"></i> Submitting to Secretariat...`;
            }

            // Extract Values for Receipt & Backend
            const leadName = document.getElementById('lead-name')?.value || 'Registrant';
            const email = document.getElementById('lead-email')?.value || '';
            const phone = document.getElementById('lead-phone')?.value || '';
            const institution = document.getElementById('lead-institution')?.value || '';
            const country = document.getElementById('lead-country')?.value || 'India';
            
            const paperId = document.getElementById('paper-id')?.value || 'N/A';
            const paperTitle = document.getElementById('paper-title')?.value || 'N/A';
            
            const checkedCategory = document.querySelector('input[name="participant_category"]:checked');
            const categoryName = checkedCategory?.dataset.name || 'Author (Indian)';
            const categoryFee = checkedCategory?.dataset.fee || '₹ 6,000';

            const paymentStatus = document.getElementById('payment-status')?.value || 'Completed / Paid';
            const transactionId = document.getElementById('transaction-id')?.value || 'N/A';
            const paymentTime = paymentDateTimeInput?.value || new Date().toISOString();
            
            const certName = document.getElementById('certificate-name')?.value || leadName;
            const certRole = document.getElementById('certificate-role')?.value || 'Presenting Author';
            const presentationMode = document.getElementById('presentation-mode')?.value || 'In-Person (Oral)';

            // Collect all authors
            const allAuthors = [leadName];
            document.querySelectorAll('.coauthor-name').forEach(input => {
                if (input.value.trim()) {
                    allAuthors.push(input.value.trim());
                }
            });

            // Accommodation status
            const hasAcc = accommodationToggle?.checked 
                ? `Yes (${document.getElementById('acc-type')?.value || 'TU Guest House'})` 
                : 'No (Self Arranged)';

            // GST status
            const hasGst = gstToggle?.checked 
                ? `${document.getElementById('gst-org-name')?.value || ''} - GSTIN: ${document.getElementById('gst-number')?.value || 'N/A'}` 
                : 'Not Required';

            // Generate unique Registration ID
            const randomCode = Math.floor(1000 + Math.random() * 9000);
            const registrationId = `IS3A3-2026-REG-${randomCode}`;

            const payload = {
                registrationId,
                leadName,
                email,
                phone,
                institution,
                country,
                categoryName,
                categoryFee,
                paperId,
                paperTitle,
                allAuthors: allAuthors.join(', '),
                certName,
                certRole,
                presentationMode,
                accommodation: hasAcc,
                gst: hasGst,
                paymentStatus,
                transactionId,
                paymentTime,
                pdfName: selectedPdfFile.name,
                pdfBase64: selectedPdfBase64
            };

            // Transmit to Google Apps Script Endpoint if provided
            if (GOOGLE_SCRIPT_WEBAPP_URL && GOOGLE_SCRIPT_WEBAPP_URL !== "YOUR_GOOGLE_APPS_SCRIPT_URL_HERE") {
                try {
                    await fetch(GOOGLE_SCRIPT_WEBAPP_URL, {
                        method: 'POST',
                        mode: 'no-cors', // Standard CORS mode for Google Apps Script Web App
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                } catch (err) {
                    console.warn('Google Script dispatch notice:', err);
                }
            }

            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = `<i class="fas fa-check-circle"></i> Submit Registration`;
            }

            // Populate Receipt Modal
            populateReceiptModal(payload);

            // Open Modal
            if (successModal) {
                successModal.classList.add('active');
            }

            // Clear saved draft
            localStorage.removeItem('is3a3_registration_draft');
        });
    }

    function populateReceiptModal(data) {
        document.getElementById('modal-reg-id').textContent = data.registrationId;
        document.getElementById('modal-reg-name').textContent = data.leadName;
        document.getElementById('modal-reg-email').textContent = data.email;
        document.getElementById('modal-reg-phone').textContent = data.phone;
        document.getElementById('modal-reg-inst').textContent = `${data.institution} (${data.country})`;
        document.getElementById('modal-reg-paper-id').textContent = data.paperId;
        document.getElementById('modal-reg-paper-title').textContent = data.paperTitle;
        document.getElementById('modal-reg-authors').textContent = data.allAuthors;
        document.getElementById('modal-reg-category').textContent = `${data.categoryName} (${data.categoryFee})`;
        document.getElementById('modal-reg-txid').textContent = data.transactionId;
        document.getElementById('modal-reg-time').textContent = data.paymentTime.replace('T', ' ');
        document.getElementById('modal-reg-cert').textContent = `${data.certName} [${data.certRole} • ${data.presentationMode}]`;
        document.getElementById('modal-reg-acc').textContent = data.accommodation;
        document.getElementById('modal-reg-file').textContent = data.pdfName;
    }

    // Modal Actions
    if (closeModalBtn && successModal) {
        closeModalBtn.addEventListener('click', () => {
            successModal.classList.remove('active');
            window.location.href = 'index.html';
        });
    }

    if (printReceiptBtn) {
        printReceiptBtn.addEventListener('click', () => {
            window.print();
        });
    }
}
