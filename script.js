document.addEventListener('DOMContentLoaded', () => {
    // --- DOM ELEMENTS ---
    const loanAmountInput = document.getElementById('loanAmount');
    const interestRateInput = document.getElementById('interestRate');
    const tenureInput = document.getElementById('tenure');
    const moratoriumInput = document.getElementById('moratorium');
    const allInputs = [loanAmountInput, interestRateInput, tenureInput, moratoriumInput];
    const summaryEmiEl = document.getElementById('summary-emi');
    const summaryInterestEl = document.getElementById('summary-interest');
    const summaryTotalEl = document.getElementById('summary-total');
    const summaryInflationLossEl = document.getElementById('summary-inflation-loss');
    const amortizationBody = document.getElementById('amortization-body');
    const amortizationContainer = document.querySelector('.amortization-table-container');
    const settingsBtn = document.querySelector('.settings-btn');
    const configPopover = document.getElementById('config-popover');
    const startDateInput = document.getElementById('startDate');
    const dateWarningEl = document.getElementById('date-schedule-warning');
    const prepaymentContainer = document.getElementById('prepayment-container');
    const prepaymentBtn = document.getElementById('prepayment-btn');
    const prepaymentModalOverlay = document.getElementById('prepayment-modal-overlay');
    const modalCloseBtn = document.getElementById('prepayment-modal-close-btn');
    // NEW: How to Use Modal Elements
    const howToUseModalOverlay = document.getElementById('how-to-use-modal-overlay');
    const howToUseModalCloseBtn = document.getElementById('how-to-use-modal-close-btn');
    const howToUseBtn             = document.getElementById('how-to-use-btn');
    const howToUseIframe       = howToUseModalOverlay.querySelector('iframe');      
    const howToUseOriginalSrc  = howToUseIframe?.src || '';
    // NEW: Custom Prepayment Elements
    const prepaymentCustomBody = document.getElementById('prepayment-custom-body');
    const addPrepaymentRowBtn = document.getElementById('add-prepayment-row-btn');
    // NEW: Prepayment Submit Button
    const prepaymentSubmitBtn = document.getElementById('prepayment-submit-btn');
    // NEW: Tabs (for potential future use, but we'll check active state)
    const customTabBtn = document.querySelector('.tab-btn[data-tab="custom"]');
    const templatesTabBtn = document.querySelector('.tab-btn[data-tab="templates"]');

    // --- STATE & CONSTANTS ---
    let originalScheduleData = []; // Stores the original schedule data
    let fullScheduleData = []; // Stores the current schedule data (initially a copy of original)
    let todayDateString = "";
    const INFLATION_RATE = 5.85;
    // NEW: State for custom prepayments
    let customPrepaymentRows = [];
    let overallLoanStartDate = new Date();
    let overallLoanEndDate = new Date();
    // NEW: Store original metrics for comparison
    let originalMetrics = null;
    // NEW: Elements for savings display (assuming they exist in your HTML)
    const allSavingsElements = document.querySelectorAll('.savings-element'); // Adjust selector if needed
    
    // --- HELPER FUNCTIONS ---
    const formatToIndianCurrency = (num) => {
        if (isNaN(num) || num === undefined) return "-";
        return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(num);
    };
    
    const resetUI = () => {
    summaryEmiEl.textContent = "-";
    summaryInterestEl.textContent = "-";
    summaryTotalEl.textContent = "-";
    summaryInflationLossEl.textContent = "-";
    amortizationBody.innerHTML = `<tr class="placeholder-row"><td colspan="5">-</td></tr>`;
    amortizationContainer.classList.add('hidden');
    if (prepaymentContainer) { prepaymentContainer.style.display = 'none'; }
    
    // Hide all savings elements
    document.querySelectorAll('.savings-percent, .summary-sub').forEach(el => {
        el.classList.add('hidden');
        el.style.display = 'none';
    });
    
    // Remove highlighted class from values
    [summaryInflationLossEl, summaryInterestEl, summaryTotalEl].forEach(el => {
        el.classList.remove('highlighted');
    });
    
    // Hide tenure savings container
    const tenureSavingsContainer = document.querySelector('.tenure-savings-container');
    if (tenureSavingsContainer) {
        tenureSavingsContainer.classList.add('hidden');
    }
};

    // --- CORE LOGIC ---
    function calculateAndDisplayResults() {
            // Hide savings elements on any new calculation
        document.querySelectorAll('.savings-percent, .summary-sub').forEach(el => {
            el.classList.add('hidden');
            el.style.display = 'none';
        });

        const P = parseFloat(loanAmountInput.value);
        const annualInterestRate = parseFloat(interestRateInput.value);
        const tenureInYears = parseFloat(tenureInput.value);
        const moratoriumInYears = parseFloat(moratoriumInput.value) || 0;
        
        if (isNaN(P) || isNaN(annualInterestRate) || isNaN(tenureInYears) || P <= 0 || annualInterestRate <= 0 || tenureInYears <= 0) { 
            resetUI(); 
            return; 
        }
        amortizationContainer.classList.remove('hidden');
        if (prepaymentContainer) { prepaymentContainer.style.display = 'flex'; prepaymentContainer.style.justifyContent = 'left'; }
        const r_actual = (annualInterestRate / 12) / 100;
        const n = tenureInYears * 12;
        const m = moratoriumInYears * 12;
        let effectivePrincipal = P;
        if (m > 0) { effectivePrincipal = P * Math.pow(1 + r_actual, m); }
        const emi = (effectivePrincipal * r_actual * Math.pow(1 + r_actual, n)) / (Math.pow(1 + r_actual, n) - 1);

        // Store original metrics for potential savings calculation
        const originalTotalInterest = (emi * n) - P; // Total Paid - Principal
        const originalTotalPaid = emi * n;
        originalMetrics = {
            principal: P,
            emi: emi,
            interest: originalTotalInterest,
            total: originalTotalPaid,
            schedule: [], // Will be populated below
            annualInterestRate: annualInterestRate,
            inflationLoss: 0 // Will be calculated
        };

        // Calculate Inflation Loss for original metrics
        const adjustedInterestRate = Math.max(0, annualInterestRate - INFLATION_RATE);
        if (adjustedInterestRate > 0) {
            const r_adjusted = (adjustedInterestRate / 12) / 100;
            let effectivePrincipal_adjusted = P;
            if (m > 0) { effectivePrincipal_adjusted = P * Math.pow(1 + r_adjusted, m); }
            const emi_adjusted = (effectivePrincipal_adjusted * r_adjusted * Math.pow(1 + r_adjusted, n)) / (Math.pow(1 + r_adjusted, n) - 1);
            if (isFinite(emi_adjusted)) {
                originalMetrics.inflationLoss = (emi_adjusted * n) - P;
            }
        }

        updateSummary(originalMetrics); // Display original summary

        const dateParts = startDateInput.value.split('-');
        if (dateParts.length === 3) {
            const day = parseInt(dateParts[0], 10);
            const month = parseInt(dateParts[1], 10) - 1; // JS months are 0-based
            const year = parseInt(dateParts[2], 10);
            const startDate = new Date(year, month, day);
            if (!isNaN(startDate)) {
                originalScheduleData = generateAmortizationData(P, emi, r_actual, n, m, startDate.getMonth(), startDate.getFullYear());
                // Store the schedule in originalMetrics for tenure comparison
                originalMetrics.schedule = originalScheduleData;
                // Initially, fullScheduleData is a copy of the original
                fullScheduleData = [...originalScheduleData];
                // Render the initial table view (5 columns)
                renderAmortizationTable(fullScheduleData); // Pass only the schedule, no prepayments

                // NEW: Setup the prepayment tab with the new loan dates
                overallLoanStartDate = new Date(startDate);
                const totalLoanMonths = n + m;
                overallLoanEndDate = new Date(startDate);
                overallLoanEndDate.setMonth(overallLoanEndDate.getMonth() + totalLoanMonths);
                setupCustomPrepaymentTab();
            }
        }
    }

    // ENHANCED updateSummary function with tenure reduction calculation
    function updateSummary(currentMetrics, original = null) {
    summaryEmiEl.textContent = formatToIndianCurrency(currentMetrics.emi);
    
    if (original) {
        // Post-prepayment scenario - show highlighted values and savings
        
        // Inflation Loss
        summaryInflationLossEl.textContent = formatToIndianCurrency(currentMetrics.inflationLoss || 0);
        summaryInflationLossEl.classList.add('highlighted');
        const inflationSaved = (original.inflationLoss || 0) - (currentMetrics.inflationLoss || 0);
        const inflationSavedPercent = original.inflationLoss > 0 ? (inflationSaved / original.inflationLoss) * 100 : 0;
        
        const inflationPercentEl = document.getElementById('inflation-loss-percent');
        const inflationSavedEl = document.getElementById('inflation-loss-saved');
        if (inflationPercentEl && inflationSavedEl) {
            inflationPercentEl.textContent = `-${inflationSavedPercent.toFixed(0)}%`;
            inflationSavedEl.textContent = formatToIndianCurrency(inflationSaved);
            inflationPercentEl.classList.remove('hidden');
            inflationPercentEl.style.display = 'block';
            inflationSavedEl.closest('.summary-sub').classList.remove('hidden');
            inflationSavedEl.closest('.summary-sub').style.display = 'block';
        }
        
        // Interest Amount
        summaryInterestEl.textContent = formatToIndianCurrency(currentMetrics.interest);
        summaryInterestEl.classList.add('highlighted');
        const interestSaved = original.interest - currentMetrics.interest;
        const interestSavedPercent = original.interest > 0 ? (interestSaved / original.interest) * 100 : 0;
        
        const interestPercentEl = document.getElementById('interest-percent');
        const interestSavedEl = document.getElementById('interest-saved');
        if (interestPercentEl && interestSavedEl) {
            interestPercentEl.textContent = `-${interestSavedPercent.toFixed(0)}%`;
            interestSavedEl.textContent = formatToIndianCurrency(interestSaved);
            interestPercentEl.classList.remove('hidden');
            interestPercentEl.style.display = 'block';
            interestSavedEl.closest('.summary-sub').classList.remove('hidden');
            interestSavedEl.closest('.summary-sub').style.display = 'block';
        }
        
        // Total Amount
        summaryTotalEl.textContent = formatToIndianCurrency(currentMetrics.total);
        summaryTotalEl.classList.add('highlighted');
        const totalSaved = original.total - currentMetrics.total;
        const totalSavedPercent = original.total > 0 ? (totalSaved / original.total) * 100 : 0;
        
        const totalPercentEl = document.getElementById('total-percent');
        const totalSavedEl = document.getElementById('total-saved');
        if (totalPercentEl && totalSavedEl) {
            totalPercentEl.textContent = `-${totalSavedPercent.toFixed(0)}%`;
            totalSavedEl.textContent = formatToIndianCurrency(totalSaved);
            totalPercentEl.classList.remove('hidden');
            totalPercentEl.style.display = 'block';
            totalSavedEl.closest('.summary-sub').classList.remove('hidden');
            totalSavedEl.closest('.summary-sub').style.display = 'block';
        }
        
        // Show tenure savings if applicable
        const tenureSavingsContainer = document.querySelector('.tenure-savings-container');
        const tenureSavingsTextEl = document.getElementById('tenure-savings-text');
        
        if (tenureSavingsContainer && tenureSavingsTextEl && currentMetrics.schedule && original.schedule) {
            const originalActiveLoanMonths = original.schedule.filter(entry => entry.balance > 0 || entry.emi > 0).length;
            const newActiveLoanMonths = currentMetrics.schedule.filter(entry => entry.balance > 0 || entry.emi > 0).length;
            const tenureReductionMonths = originalActiveLoanMonths - newActiveLoanMonths;
            
            if (tenureReductionMonths > 0) {
                const yearsReduced = Math.floor(tenureReductionMonths / 12);
                const monthsReduced = tenureReductionMonths % 12;
                
                let tenureText = "you'll close your loan ";
                
                if (yearsReduced > 0 && monthsReduced > 0) {
                    tenureText += `${yearsReduced} year${yearsReduced > 1 ? 's' : ''} & ${monthsReduced} month${monthsReduced > 1 ? 's' : ''} prior`;
                } else if (yearsReduced > 0) {
                    tenureText += `${yearsReduced} year${yearsReduced > 1 ? 's' : ''} prior`;
                } else if (monthsReduced > 0) {
                    tenureText += `${monthsReduced} month${monthsReduced > 1 ? 's' : ''} prior`;
                }
                
                // split out the static and dynamic parts
                const prefix = "you'll close your loan ";
                const suffix = " prior";
                const dyn = `${yearsReduced} year${yearsReduced>1?'s':''} & ${monthsReduced} month${monthsReduced>1?'s':''}`;

                // inject HTML so we can wrap only the dyn part
                tenureSavingsTextEl.innerHTML = `${prefix}<span class="tenure-highlight">${dyn}</span>${suffix}`;

                tenureSavingsContainer.classList.remove('hidden');
            } else {
                tenureSavingsContainer.classList.add('hidden');
            }
        }
        
    } else {
        // Initial calculation - show normal values without highlights or savings
        summaryInflationLossEl.textContent = formatToIndianCurrency(currentMetrics.inflationLoss || 0);
        summaryInterestEl.textContent = formatToIndianCurrency(currentMetrics.interest);
        summaryTotalEl.textContent = formatToIndianCurrency(currentMetrics.total);
        
        // Remove highlights
        [summaryInflationLossEl, summaryInterestEl, summaryTotalEl].forEach(el => {
            el.classList.remove('highlighted');
        });
        
        // Hide all savings elements
        document.querySelectorAll('.savings-percent, .summary-sub').forEach(el => {
            el.classList.add('hidden');
            el.style.display = 'none';
        });
        
        // Hide tenure savings container
        const tenureSavingsContainer = document.querySelector('.tenure-savings-container');
        if (tenureSavingsContainer) {
            tenureSavingsContainer.classList.add('hidden');
        }
    }
}

    // Function to render the amortization table (accordion view)
    // Conditionally renders 5 or 6 columns based on prepayment data
    function renderAmortizationTable(schedule, prepayments = {}) {
        amortizationBody.innerHTML = "";
        if (!schedule || schedule.length === 0) {
            // Determine colspan based on whether prepayments exist
            const hasPrepayments = Object.keys(prepayments).length > 0;
            const colSpan = hasPrepayments ? 6 : 5; // 6 columns if prepayments, 5 otherwise
            amortizationBody.innerHTML = `<tr class="placeholder-row"><td colspan="${colSpan}">-</td></tr>`;
            return;
        }

        // Check if any prepayment data is actually provided
        const hasPrepayments = Object.keys(prepayments).length > 0;

        // Group data by year for the accordion structure
        const yearlyData = {};
        if (hasPrepayments) {
            // --- Logic when PREPAYMENTS ARE PROVIDED ---
            schedule.forEach((row, i) => {
                const year = row.year;
                if (!yearlyData[year]) {
                    // Store months and initialize totals for the year
                    yearlyData[year] = { months: [], totalPrincipal: 0, totalInterest: 0, totalPrepayment: 0, totalPayment: 0 };
                }
                // Calculate prepayment and total for this specific month row
                // Assuming 'i' correctly indexes into the original schedule for date lookup
                const currentDate = new Date(overallLoanStartDate);
                currentDate.setMonth(currentDate.getMonth() + i);
                // Ensure key format matches how prepayments are stored (e.g., "YYYY-M")
                const key = `${currentDate.getFullYear()}-${currentDate.getMonth() + 1}`; // Use 1-based month

                const prepaymentAmount = prepayments[key] || 0;
                // Total Payment = Standard Payment (row.total) + Prepayment for this month
                // Handle potential undefined row.total (e.g., moratorium)
                const standardPayment = row.total || 0;
                const totalPayment = standardPayment + prepaymentAmount;

                // Add this processed month row to the year's data
                yearlyData[year].months.push({ ...row, prepayment: prepaymentAmount, totalPayment: totalPayment });

                // Accumulate yearly totals
                yearlyData[year].totalPrincipal += row.principal || 0;
                yearlyData[year].totalInterest += row.interest || 0;
                yearlyData[year].totalPrepayment += prepaymentAmount;
                yearlyData[year].totalPayment += totalPayment;
            });
        } else {
            // --- Logic when NO PREPAYMENTS are provided (Initial View) ---
            // Group data by year for the accordion structure, but don't process prepayments
            schedule.forEach(row => {
                const year = row.year;
                if (!yearlyData[year]) {
                     // For initial view, we just need the year to create the summary row
                    yearlyData[year] = true; // Simple flag or minimal data
                }
            });
        }

        let tableHTML = "";
        for (const year in yearlyData) {
            // Create year rows WITHOUT the 'open' class and WITHOUT prepayment details
            // Ensure the chevron icon starts in the default (pointing down) state
            // The colspan should match the number of columns in the details view
            const colSpan = hasPrepayments ? 6 : 5; // 6 if prepayments, 5 otherwise
            tableHTML += `<tr class="year-row" data-year="${year}">
                             <td colspan="${colSpan}"> <!-- Adjusted colspan -->
                                 ${year}
                                 <img src="assets/chevron.svg" alt="Toggle Details" class="toggle-icon">
                             </td>
                         </tr>`;
            // DO NOT add details rows here. They are added dynamically on click.
        }
        amortizationBody.innerHTML = tableHTML;
        // The detailed rows (with 5 or 6 columns) will be added by the click listener
        // when the user interacts with a year row.
    }

    function generateAmortizationData(principal, emi, monthlyRate, tenureMonths, moratoriumMonths, startMonthIndex, startYear) {
        let balance = principal;
        const schedule = [];
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const totalDurationInMonths = moratoriumMonths + tenureMonths;
        for (let i = 0; i < totalDurationInMonths; i++) {
            const currentMonthIndex = (startMonthIndex + i) % 12;
            const currentYear = startYear + Math.floor((startMonthIndex + i) / 12);
            const interestPayment = balance * monthlyRate;
            let principalPayment = 0;
            let totalPayment = 0; // This will be the EMI amount or 0 during moratorium
            if (i < moratoriumMonths) {
                balance += interestPayment;
                principalPayment = 0;
                totalPayment = 0;
            } else {
                principalPayment = emi - interestPayment;
                totalPayment = emi; // Standard EMI payment
                balance -= principalPayment;
            }
            schedule.push({
                year: currentYear,
                month: monthNames[currentMonthIndex],
                principal: principalPayment,
                interest: interestPayment,
                // Add EMI field for clarity in prepayment logic if needed elsewhere
                emi: totalPayment, // This represents the standard payment part
                // Initialize prepayment to 0 for original schedule
                prepayment: 0,
                // Total payment is EMI for original schedule
                total: totalPayment,
                balance: balance > 0 ? balance : 0
            });
        }
        return schedule;
    }

    // ===== NEW: PREPAYMENT CUSTOM TAB LOGIC =====
    function setupCustomPrepaymentTab() {
        // Clear previous state and rows
        customPrepaymentRows = [];
        if (prepaymentCustomBody) {
             prepaymentCustomBody.innerHTML = '';
        }
        // Create the first default row
        const firstRow = {
            id: Date.now(),
            startDate: overallLoanStartDate,
            endDate: overallLoanEndDate,
            amount: ''
        };
        customPrepaymentRows.push(firstRow);
        const firstRowEl = createPrepaymentRowElement(firstRow, 0);
        if (prepaymentCustomBody) {
             prepaymentCustomBody.appendChild(firstRowEl);
        }
    }

    function createPrepaymentRowElement(rowData, index) {
        // Guard clause if prepaymentCustomBody is not ready
        if (!prepaymentCustomBody) {
            console.warn("prepaymentCustomBody not found, cannot create row element.");
            return document.createElement('tr'); // Return empty tr as fallback
        }

        const tr = document.createElement('tr');
        tr.dataset.index = index;
        tr.dataset.id = rowData.id;
        // Define the innerHTML first
        // ---> REMOVED error message cell and adjusted colspan <---
        tr.innerHTML = `
            <td class="prepayment-date-cell">
                <div id="prep-start-${rowData.id}" class="input-field-wrapper">
                    <input type="text" data-input>
                    <img src="assets/calendar.svg" alt="Select Date" class="date-picker-icon" data-toggle>
                </div>
            </td>
            <td class="prepayment-date-cell">
                <div id="prep-end-${rowData.id}" class="input-field-wrapper">
                    <input type="text" data-input>
                    <img src="assets/calendar.svg" alt="Select Date" class="date-picker-icon" data-toggle>
                </div>
            </td>
            <td>
                <div class="input-field-wrapper">
                    <span class="prefix" style="padding: 8px; height: auto;">₹</span>
                    <input type="number" class="prepayment-amount-input" placeholder="Enter amount" value="${rowData.amount || ''}"style="text-align: right;">
                </div>
            </td>
            <!-- Add the trash icon for deletion -->
            <td class="delete-cell">
                <img src="assets/trash.svg" alt="Delete" class="${index === 0 ? 'delete-icon delete-icon-disabled' : 'delete-icon'}" style="cursor: ${index === 0 ? 'not-allowed' : 'pointer'}; width: 20px; height: 20px; ${index === 0 ? 'opacity: 0.5; filter: grayscale(100%);' : ''}">
            </td>
        `;
        // ---> END of innerHTML <---

        // Now that the elements exist, find them and initialize Flatpickr
        const startPickerEl = tr.querySelector(`#prep-start-${rowData.id}`);
        const endPickerEl = tr.querySelector(`#prep-end-${rowData.id}`);
        const prevRowEndDate = index > 0 ? customPrepaymentRows[index - 1].endDate : null;

        // Initialize Flatpickr for the new row's date inputs
        const startPicker = flatpickr(startPickerEl, {
            wrap: true,
            dateFormat: "d-m-Y",
            defaultDate: rowData.startDate ? new Date(rowData.startDate) : null,
            minDate: prevRowEndDate ? new Date(prevRowEndDate).fp_incr(1) : (overallLoanStartDate ? new Date(overallLoanStartDate) : null),
            maxDate: overallLoanEndDate ? new Date(overallLoanEndDate) : null,
            onChange: function(selectedDates) {
                if (selectedDates[0]) {
                    rowData.startDate = selectedDates[0];
                    // Validation happens on submit, not on change
                }
            }
        });

        const endPicker = flatpickr(endPickerEl, {
            wrap: true,
            dateFormat: "d-m-Y",
            defaultDate: rowData.endDate ? new Date(rowData.endDate) : null,
            minDate: rowData.startDate ? new Date(rowData.startDate) : (overallLoanStartDate ? new Date(overallLoanStartDate) : null),
            maxDate: overallLoanEndDate ? new Date(overallLoanEndDate) : null,
            onChange: function(selectedDates) {
                if (selectedDates[0]) {
                    rowData.endDate = selectedDates[0];
                    const nextRow = customPrepaymentRows[index + 1];
                    if (nextRow && nextRow.startPicker) {
                        const baseDate = selectedDates[0] instanceof Date ? selectedDates[0] : new Date(selectedDates[0]);
                        nextRow.startPicker.set('minDate', baseDate.fp_incr(1));
                    }
                    // Validation happens on submit, not on change
                }
            }
        });

        // Store picker instances to manage them later
        rowData.startPicker = startPicker;
        rowData.endPicker = endPicker;

        // Add event listener for the trash icon, but only if it's NOT the first row
        if (index > 0) { // Check if it's not the first row (index 0)
            const deleteIcon = tr.querySelector('.delete-icon'); // This will now select the correct icon
            // Ensure we don't add a listener to a potentially disabled icon from a previous row render
            if (deleteIcon && !deleteIcon.classList.contains('delete-icon-disabled')) {
                deleteIcon.addEventListener('click', () => {
                    // --- Deletion Logic ---
                    // 1. Remove the row from the DOM
                    tr.remove();

                    // 2. Remove the row from the customPrepaymentRows array
                    // Find the index in the array using the row's ID, as DOM indices can become stale
                    const rowIndexInArray = customPrepaymentRows.findIndex(r => r.id == rowData.id);
                    if (rowIndexInArray !== -1) {
                        customPrepaymentRows.splice(rowIndexInArray, 1);

                        // 3. Re-index the remaining rows in the DOM and potentially update constraints
                        const remainingRows = prepaymentCustomBody.querySelectorAll('tr[data-index]');
                        remainingRows.forEach((rowEl, newIndex) => {
                            rowEl.dataset.index = newIndex;
                            // Update constraints for date pickers if needed (optional, as validate might handle it)
                            const rowDataForThisRow = customPrepaymentRows[newIndex];
                            if (rowDataForThisRow) {
                                // Example: Update the next row's start date constraint if it exists
                                const nextRowData = customPrepaymentRows[newIndex + 1];
                                if (nextRowData && nextRowData.startPicker && rowDataForThisRow.endDate) {
                                    nextRowData.startPicker.set('minDate', new Date(rowDataForThisRow.endDate).fp_incr(1));
                                }
                                // Example: Update the current row's end date constraint
                                if (rowDataForThisRow.endPicker) {
                                    let maxEndDate = overallLoanEndDate;
                                    if (nextRowData && nextRowData.startDate) {
                                        maxEndDate = new Date(nextRowData.startDate);
                                        maxEndDate.setDate(maxEndDate.getDate() - 1);
                                    }
                                    rowDataForThisRow.endPicker.set('maxDate', maxEndDate);
                                }
                            }
                        });

                        // 4. No need to revalidate rows here as validation is on submit
                        // customPrepaymentRows.forEach((row, idx) => { validateSinglePrepaymentRow(row, idx); });
                    } else {
                         console.warn(`Could not find row data for ID ${rowData.id} to delete.`);
                    }
                    // --- End Deletion Logic ---
                });
            }
        }
        // If it's the first row (index === 0), no click listener is added

        return tr;
    }

    addPrepaymentRowBtn.addEventListener('click', () => {
        // Guard clause
        if (!prepaymentCustomBody || customPrepaymentRows.length === 0) return;

        const lastRow = customPrepaymentRows[customPrepaymentRows.length - 1];
        if (!lastRow) return;
        // The new row starts the day after the previous one ends
        const newStartDate = new Date(lastRow.endDate);
        newStartDate.setDate(newStartDate.getDate() + 1);
        // Prevent adding a new row if there's no time left
        if (newStartDate >= overallLoanEndDate) {
            alert("No more time available in the loan tenure to add another prepayment period.");
            return;
        }
        const newRow = {
            id: Date.now(),
            startDate: newStartDate,
            endDate: overallLoanEndDate,
            amount: ''
        };
        customPrepaymentRows.push(newRow);
        const newRowEl = createPrepaymentRowElement(newRow, customPrepaymentRows.length - 1);
        prepaymentCustomBody.appendChild(newRowEl);
        // Update the previous row's end date picker to be constrained
        lastRow.endPicker.set('maxDate', new Date(newStartDate).fp_incr(-1));
    });

    // Use event delegation for amount inputs
    if (prepaymentCustomBody) {
        prepaymentCustomBody.addEventListener('input', (e) => {
            if (e.target.classList.contains('prepayment-amount-input')) {
                const tr = e.target.closest('tr');
                const index = parseInt(tr.dataset.index, 10);
                // Update the amount in the state
                customPrepaymentRows[index].amount = parseFloat(e.target.value) || 0; // Handles NaN/empty
                // No validation on input change
            }
        });
    }

    /**
     * Simplified validation for a single prepayment row.
     * Checks basic input validity (amount > 0, valid dates, start <= end).
     * @param {Object} row - The prepayment row data object {id, startDate, endDate, amount, startPicker, endPicker}.
     * @param {number} index - The index of the row in the customPrepaymentRows array.
     * @returns {boolean} - True if basic validation passes, false otherwise.
     */
    function validateSinglePrepaymentRow(row, index) {
        console.log(`Validating single prepayment row ${index + 1}:`, row);

        const amount = parseFloat(row.amount);
        const startDate = row.startDate;
        const endDate = row.endDate;

        // --- Basic Input Validation ---
        // Check if amount is valid and positive
        if (isNaN(amount) || amount <= 0) {
            // console.log(`Row ${index + 1}: Invalid amount.`); // Optional log
            return false;
        }

        // Check if dates are valid Date objects and endDate is not before startDate
        if (!(startDate instanceof Date) || isNaN(startDate.getTime()) ||
            !(endDate instanceof Date) || isNaN(endDate.getTime()) ||
            endDate < startDate) {
            // console.log(`Row ${index + 1}: Invalid date range.`); // Optional log
            return false;
        }

        // If all basic checks pass
        console.log(`Row ${index + 1}: Basic validation PASSED.`);
        return true;
    }

    // ===== NEW: 16 EMI RULE TEMPLATE LOGIC =====

    /**
     * Generates prepayment data based on the 16 EMI Rule
     * Pattern: Months 1,2 = EMI only, Month 3 = EMI + EMI prepayment, 
     * Months 4,5 = EMI only, Month 6 = EMI + EMI prepayment, etc.
     * @param {number} emiAmount - The monthly EMI amount
     * @param {Date} loanStartDate - The loan start date
     * @param {number} totalLoanMonths - Total loan duration in months
     * @returns {Object} - Map of prepayments by month key ("YYYY-M")
     */
    function generate16EMIRulePrepayments(emiAmount, loanStartDate, totalLoanMonths) {
        const prepaymentMap = {};
        
        // Start from the loan start date
        let currentDate = new Date(loanStartDate);
        
        for (let monthIndex = 0; monthIndex < totalLoanMonths; monthIndex++) {
            const year = currentDate.getFullYear();
            const month = currentDate.getMonth() + 1; // 1-based month
            const monthKey = `${year}-${month}`;
            
            // Calculate which month in the 3-month cycle this is
            // monthIndex 0, 1, 2, 3, 4, 5, 6, 7, 8...
            // cycle pos   0, 1, 2, 0, 1, 2, 0, 1, 2...
            const cyclePosition = monthIndex % 3;
            
            if (cyclePosition === 2) { // 3rd month in cycle (0-indexed, so position 2)
                // This is a double payment month
                prepaymentMap[monthKey] = emiAmount;
            } else {
                // This is a regular EMI month (no prepayment)
                prepaymentMap[monthKey] = 0;
            }
            
            // Move to next month
            currentDate.setMonth(currentDate.getMonth() + 1);
        }
        
        return prepaymentMap;
    }

    /**
     * Helper function to convert prepayment map to custom rows format
     * This allows us to reuse the existing calculation logic
     */
    function convertPrepaymentsToCustomRows(prepaymentMap, loanStartDate, totalLoanMonths) {
        const customRows = [];
        let currentPeriodStart = null;
        let currentPrepaymentAmount = 0;
        
        const sortedMonthKeys = Object.keys(prepaymentMap).sort((a, b) => {
            const [yearA, monthA] = a.split('-').map(Number);
            const [yearB, monthB] = b.split('-').map(Number);
            return yearA !== yearB ? yearA - yearB : monthA - monthB;
        });
        
        for (let i = 0; i < sortedMonthKeys.length; i++) {
            const monthKey = sortedMonthKeys[i];
            const prepaymentAmount = prepaymentMap[monthKey];
            const [year, month] = monthKey.split('-').map(Number);
            const currentDate = new Date(year, month - 1, 1); // First day of the month
            
            if (prepaymentAmount > 0) {
                // This month has a prepayment
                if (currentPeriodStart === null || currentPrepaymentAmount !== prepaymentAmount) {
                    // Start a new period
                    if (currentPeriodStart !== null) {
                        // Close the previous period
                        const prevDate = new Date(currentDate);
                        prevDate.setMonth(prevDate.getMonth() - 1);
                        prevDate.setDate(prevDate.getDate()); // End of previous month
                        
                        customRows.push({
                            id: Date.now() + customRows.length,
                            startDate: new Date(currentPeriodStart),
                            endDate: prevDate,
                            amount: currentPrepaymentAmount
                        });
                    }
                    
                    currentPeriodStart = new Date(currentDate);
                    currentPrepaymentAmount = prepaymentAmount;
                }
                // Continue the current period (same prepayment amount)
            } else {
                // This month has no prepayment
                if (currentPeriodStart !== null && currentPrepaymentAmount > 0) {
                    // Close the current prepayment period
                    const prevDate = new Date(currentDate);
                    prevDate.setMonth(prevDate.getMonth() - 1);
                    
                    customRows.push({
                        id: Date.now() + customRows.length,
                        startDate: new Date(currentPeriodStart),
                        endDate: prevDate,
                        amount: currentPrepaymentAmount
                    });
                    
                    currentPeriodStart = null;
                    currentPrepaymentAmount = 0;
                }
            }
        }
        
        // Close any remaining period
        if (currentPeriodStart !== null && currentPrepaymentAmount > 0) {
            const endDate = new Date(loanStartDate);
            endDate.setMonth(endDate.getMonth() + totalLoanMonths - 1);
            
            customRows.push({
                id: Date.now() + customRows.length,
                startDate: new Date(currentPeriodStart),
                endDate: endDate,
                amount: currentPrepaymentAmount
            });
        }
        
        return customRows;
    }

    /**
     * Applies the 16 EMI Rule template and recalculates the loan
     */
    function apply16EMIRuleTemplate() {
        // 1. Validate that we have the necessary data
        if (!originalScheduleData || originalScheduleData.length === 0) {
            alert("Please calculate the basic EMI first before applying the 16 EMI Rule.");
            return;
        }
        
        if (!originalMetrics || !originalMetrics.emi) {
            alert("EMI calculation data is missing. Please recalculate.");
            return;
        }
        
        // 2. Parse the loan start date
        let loanStartDate = null;
        const [d, m, y] = startDateInput.value.split('-').map(v => parseInt(v, 10));
        loanStartDate = new Date(y, m - 1, d);
        if (isNaN(loanStartDate.getTime())) {
            alert("Error: Loan start date is invalid. Please check the configuration.");
            return;
        }
        
        // 3. Generate 16 EMI Rule prepayments
        const emiAmount = originalMetrics.emi;
        const totalLoanMonths = originalScheduleData.length;
        
        console.log(`Applying 16 EMI Rule with EMI: ${emiAmount}, Total Months: ${totalLoanMonths}`);
        
        const templatePrepayments = generate16EMIRulePrepayments(emiAmount, loanStartDate, totalLoanMonths);
        
        console.log("Generated 16 EMI Rule prepayments:", templatePrepayments);
        
        // 4. Convert prepayment map to custom rows format for consistency
        const templateCustomRows = convertPrepaymentsToCustomRows(templatePrepayments, loanStartDate, totalLoanMonths);
        
        // 5. Calculate schedule with template prepayments
        const {
            schedule: rawSchedule,
            prepayments: monthlyPrepayments
        } = calculateScheduleWithPrepayments(
            originalScheduleData,
            templateCustomRows,
            loanStartDate
        );
        
        // 6. Trim off months after loan is paid off
        const payoffIdx = rawSchedule.findIndex(entry => entry.balance <= 0);
        const trimmedSchedule = payoffIdx >= 0 ? rawSchedule.slice(0, payoffIdx + 1) : rawSchedule;
        
        // 7. Update global state
        fullScheduleData = trimmedSchedule;
        
        // 8. Update UI
        console.log("16 EMI Rule - New trimmed schedule:", trimmedSchedule);
        renderAmortizationTable(trimmedSchedule, monthlyPrepayments);
        updateSummaryWithSavings(trimmedSchedule, monthlyPrepayments);
        
        // 9. Close modal
        closePrepaymentModal();
    }

    // ===== PREPAYMENT APPLICATION AND RECALCULATION LOGIC =====

    /**
     * Calculates the schedule with prepayments applied.
     * @param {Array} originalSchedule - The original amortization schedule array.
     * @param {Array} prepaymentRows - Array of validated custom prepayment row objects.
     * @param {Date} loanStartDate - The start date of the original loan.
     * @returns {Object} - An object containing the new schedule and a map of monthly prepayments.
     */
    function calculateScheduleWithPrepayments(originalSchedule, prepaymentRows, loanStartDate) {
        // Create a deep copy of the original schedule to avoid modifying it directly
        let newSchedule = JSON.parse(JSON.stringify(originalSchedule));

        // Create a lookup map for prepayments by year-month for faster access
        // Key: "YYYY-M", Value: total prepayment amount for that month
        const prepaymentMap = {};

        // Process each prepayment row
        prepaymentRows.forEach(row => {
            const amount = parseFloat(row.amount);
            if (isNaN(amount) || amount <= 0) return; // Skip invalid rows

            const startDate = new Date(row.startDate);
            const endDate = new Date(row.endDate);

            // Iterate through each month in the prepayment period
            let currentDate = new Date(startDate);
            // Set to first day of the month for consistent comparison
            currentDate.setDate(1);

            while (currentDate <= endDate) {
                const year = currentDate.getFullYear();
                // getMonth is 0-based, padStart ensures two digits
                const monthKey = `${year}-${currentDate.getMonth() + 1}`;

                // Add the monthly prepayment amount to the map
                if (!prepaymentMap[monthKey]) {
                    prepaymentMap[monthKey] = 0;
                }
                prepaymentMap[monthKey] += amount;

                // Move to the next month
                currentDate.setMonth(currentDate.getMonth() + 1);
            }
        });

        let runningBalance = parseFloat(loanAmountInput.value) || 0;
        let totalInterestPaid = 0;
        let totalEmiPaid = 0; // Track total standard EMI paid
        let loanClosed = false;

        // Iterate through the schedule and apply prepayments
        for (let i = 0; i < newSchedule.length; i++) {
            if (loanClosed) {
                // If loan is closed, set remaining entries to zero
                newSchedule[i].principal = 0;
                newSchedule[i].interest = 0;
                newSchedule[i].emi = 0;
                newSchedule[i].prepayment = 0;
                newSchedule[i].total = 0;
                newSchedule[i].totalPayment = 0; // Ensure totalPayment is also 0
                newSchedule[i].balance = 0;
                continue;
            }

            const scheduleEntry = newSchedule[i];
            const entryYear = scheduleEntry.year;
            // scheduleEntry.month is e.g., "Jan". Convert to month number (1-12).
            const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            const entryMonthNumber = monthNames.indexOf(scheduleEntry.month) + 1; // 1-based
            const entryMonthKey = `${entryYear}-${entryMonthNumber}`;

            // Get prepayment amount for this month
            const monthlyPrepayment = prepaymentMap[entryMonthKey] || 0;
            scheduleEntry.prepayment = monthlyPrepayment;

            // Calculate interest based on the balance *at the start* of the month
            const monthlyRate = (parseFloat(interestRateInput.value) / 12) / 100;
            const interestForMonth = runningBalance * monthlyRate;
            scheduleEntry.interest = interestForMonth;

            let principalForMonth = 0;
            let emiForMonth = scheduleEntry.emi || 0; // Standard EMI for this month

            // Check if this is a moratorium month
            const loanStartMonthIndex = loanStartDate.getMonth();
            const loanStartYear = loanStartDate.getFullYear();
            const monthsSinceLoanStart = (entryYear - loanStartYear) * 12 + (entryMonthNumber - 1 - loanStartMonthIndex);
            const isMoratoriumMonth = monthsSinceLoanStart < (parseFloat(moratoriumInput.value) || 0) * 12;

            if (isMoratoriumMonth) {
                // During moratorium, only interest is added to balance, no principal payment
                runningBalance += interestForMonth;
                principalForMonth = 0;
                emiForMonth = 0; // No EMI during moratorium
            } else {
                // Regular payment month
                principalForMonth = emiForMonth - interestForMonth;
                // Apply prepayment to principal reduction
                const totalPrincipalPaymentThisMonth = principalForMonth + monthlyPrepayment;

                // Check if prepayment closes the loan
                if (totalPrincipalPaymentThisMonth >= runningBalance) {
                    // Loan is closed this month
                    principalForMonth = runningBalance - monthlyPrepayment; // Adjust principal to pay off balance
                    if (principalForMonth < 0) principalForMonth = 0; // Safety check
                    runningBalance = 0;
                    loanClosed = true;
                    // EMI might be reduced if balance is paid off early
                    emiForMonth = principalForMonth + interestForMonth;
                } else {
                    // Normal case: reduce balance
                    runningBalance -= totalPrincipalPaymentThisMonth;
                }
            }

            // Update the schedule entry with calculated values
            scheduleEntry.principal = principalForMonth;
            scheduleEntry.emi = emiForMonth; // Might be adjusted if loan closes
            // Total payment is EMI + Prepayment for the month
            scheduleEntry.total = emiForMonth + monthlyPrepayment;
            // Also store totalPayment for consistency with renderAmortizationTable logic
            scheduleEntry.totalPayment = scheduleEntry.total;
            scheduleEntry.balance = runningBalance;

            // Accumulate totals for summary calculation later if needed within this function
            // (though we recalculate in applyPrepaymentsAndRecalculate)
             // If balance reaches zero or below, mark loan as closed for subsequent months
             if (runningBalance <= 0) {
                loanClosed = true;
                runningBalance = 0; // Ensure balance is exactly zero
            }
        }

        return {
            schedule: newSchedule,
            prepayments: prepaymentMap
        };
    }

    /**
     * Updates the summary panel to show savings based on the new schedule.
     * @param {Array} newSchedule - The schedule with prepayments applied.
     * @param {Object} monthlyPrepayments - Map of prepayments by month.
     */
    function updateSummaryWithSavings(newSchedule, monthlyPrepayments) {
  if (!newSchedule || newSchedule.length === 0 || !originalMetrics) {
    console.error("Cannot update summary with savings: Invalid data provided.");
    return;
  }

  // 1. Re-sum every month's totalPayment (EMI + prepayment)
    const principalAmount = parseFloat(loanAmountInput.value) || 0;
  // 2. Recompute total interest
  const newTotalInterest = newSchedule
    .reduce((sum, entry) => sum + (entry.interest || 0), 0);

// 3. Calculate inflation-adjusted loss for the new scenario
let newInflationLoss = 0;
const adjustedRate = Math.max(0, originalMetrics.annualInterestRate - INFLATION_RATE);
if (adjustedRate > 0) {
  const r_adjusted = (adjustedRate / 12) / 100;
  const originalTenureMonths = parseFloat(tenureInput.value) * 12;
  const moratoriumMonths = (parseFloat(moratoriumInput.value) || 0) * 12;
  
  // Calculate what the total payment would be with inflation-adjusted rate
  let effectivePrincipal_adjusted = principalAmount;
  if (moratoriumMonths > 0) {
    effectivePrincipal_adjusted = principalAmount * Math.pow(1 + r_adjusted, moratoriumMonths);
  }
  
  const emi_adjusted = (effectivePrincipal_adjusted * r_adjusted * Math.pow(1 + r_adjusted, originalTenureMonths)) / 
                       (Math.pow(1 + r_adjusted, originalTenureMonths) - 1);
  
  if (isFinite(emi_adjusted)) {
// 1) figure out how many months you actually paid:
const actualMonthsPaid = newSchedule.filter(e => e.balance > 0 || e.emi > 0).length;

// 2) recompute the “inflation-adjusted EMI” using N = actualMonthsPaid
const emiAdjustedForNewN =
    (effectivePrincipal_adjusted * r_adjusted * Math.pow(1 + r_adjusted, actualMonthsPaid))
    / (Math.pow(1 + r_adjusted, actualMonthsPaid) - 1);

// 3) now your “inflation loss” is the difference between what you’d pay
//    at that adjusted-rate EMI for those months vs. the principal
newInflationLoss = (emiAdjustedForNewN * actualMonthsPaid) - principalAmount;

// 4) keep the non-negative guard
newInflationLoss = Math.max(0, newInflationLoss);
  }
}

// 3. FIXED: Total Amount = Principal + Interest ONLY (no prepayments)
const newTotalAmount = principalAmount + newTotalInterest;

// 4. Build the corrected metrics obriject
const newMetrics = {
  principal: principalAmount,
  emi:       originalMetrics.emi,           // keep the original EMI display
  interest:  newTotalInterest,
  total:     newTotalAmount,                // Principal + Interest only
  schedule:  newSchedule,
  // fix the typo here:
  annualInterestRate: originalMetrics.annualInterestRate,
  // inject the value you just calculated above:
  inflationLoss:       newInflationLoss
};

console.log("🔍 newMetrics:", newMetrics);

  // 5. Finally update the UI
  updateSummary(newMetrics, originalMetrics);
}


    // --- ENHANCED applyPrepaymentsAndRecalculate FUNCTION WITH TEMPLATE SUPPORT ---
    function applyPrepaymentsAndRecalculate() {
        // Check which tab is active
        const isCustomTabActive = customTabBtn && customTabBtn.classList.contains('active');
        const isTemplatesTabActive = templatesTabBtn && templatesTabBtn.classList.contains('active');
        
        if (isCustomTabActive) {
            // Original custom prepayment logic
            // 1. Basic validation of each row
            let allValid = true;
            customPrepaymentRows.forEach((row, index) => {
                if (!validateSinglePrepaymentRow(row, index)) {
                    allValid = false;
                }
            });
            if (!allValid) {
                alert("Please correct the inputs in the Custom prepayment entries (ensure amount > 0 and dates are valid).");
                return;
            }

            // 2. Parse the loan start date
            let loanStartDate = null;
            const [d, m, y] = startDateInput.value.split('-').map(v => parseInt(v, 10));
            loanStartDate = new Date(y, m - 1, d);
            if (isNaN(loanStartDate.getTime())) {
                alert("Error: Loan start date is invalid. Please check the configuration.");
                return;
            }

            // 3. Recalculate with custom prepayments
            console.log("Applying custom prepayments:", customPrepaymentRows);
            const {
                schedule: rawSchedule,
                prepayments: monthlyPrepayments
            } = calculateScheduleWithPrepayments(
                originalScheduleData,
                customPrepaymentRows,
                loanStartDate
            );

            // ─── Trim off any months after the balance hits zero ───
            const payoffIdx = rawSchedule.findIndex(entry => entry.balance <= 0);
            const trimmedSchedule = payoffIdx >= 0
                ? rawSchedule.slice(0, payoffIdx + 1)
                : rawSchedule;

            // 4. Update global state
            fullScheduleData = trimmedSchedule;

            // 5. Refresh the UI
            console.log("New trimmed schedule with custom prepayments:", trimmedSchedule);
            renderAmortizationTable(trimmedSchedule, monthlyPrepayments);
            updateSummaryWithSavings(trimmedSchedule, monthlyPrepayments);

            // 6. Close the modal
            closePrepaymentModal();
            
        } else if (isTemplatesTabActive) {
            // Template prepayment logic
            const selectedTemplate = document.querySelector('input[name="prepayment_template"]:checked');
            
            if (!selectedTemplate) {
                alert("Please select a prepayment template.");
                return;
            }
            
            const templateValue = selectedTemplate.value;
            
            if (templateValue === '16-emi') {
                apply16EMIRuleTemplate();
            } else {
                alert("Selected template is not yet implemented.");
            }
        } else {
            alert("Please select either the Custom or Templates tab.");
        }
    }

    // --- Modal Open/Close Logic ---
    function openPrepaymentModal() { if (prepaymentModalOverlay) { prepaymentModalOverlay.classList.remove('hidden'); } }
    function closePrepaymentModal() { if (prepaymentModalOverlay) { prepaymentModalOverlay.classList.add('hidden'); } }

function openHowToUseModal() {
  // reload the player each time
  howToUseIframe.src = howToUseOriginalSrc;
  howToUseModalOverlay.classList.remove('hidden');
}
howToUseBtn.addEventListener('click', openHowToUseModal);

function closeHowToUseModal() {
  howToUseModalOverlay.classList.add('hidden');
  // unload the video
  howToUseIframe.src = '';
}
howToUseModalCloseBtn.addEventListener('click', closeHowToUseModal);

    // --- Tab Switching Logic (Existing) ---
    const modalTabsContainer = document.querySelector('.modal-tabs');
    if (modalTabsContainer) {
        const tabButtons = modalTabsContainer.querySelectorAll('.tab-btn');
        const tabContents = document.querySelectorAll('.tab-content');
        modalTabsContainer.addEventListener('click', (e) => {
            const clickedTab = e.target.closest('.tab-btn');
            if (!clickedTab) return;
            const tabId = clickedTab.dataset.tab;
            tabButtons.forEach(btn => { btn.classList.remove('active'); });
            clickedTab.classList.add('active');
            tabContents.forEach(content => {
                content.classList.remove('active');
                if (content.id === tabId) { content.classList.add('active'); }
            });
        });
    }

    // --- EVENT LISTENERS ---
    allInputs.forEach(input => {
        input.addEventListener('input', () => {
            const max = parseFloat(input.max);
            if (input.value && parseFloat(input.value) > max) { input.value = max; }
            calculateAndDisplayResults();
        });
    });

    // --- Amortization Table Toggle (Modified for conditional columns) ---
    amortizationBody.addEventListener('click', function(e) {
        const yearRow = e.target.closest('.year-row');
        if (!yearRow) return;
        const year = yearRow.dataset.year;
        const wasOpen = yearRow.classList.contains('open');
        const currentlyOpenRow = document.querySelector('.year-row.open');
        if (currentlyOpenRow) { currentlyOpenRow.classList.remove('open'); }
        const existingDetails = document.querySelector('.details-container-row');
        if (existingDetails) { existingDetails.remove(); }
        if (!wasOpen) {
            yearRow.classList.add('open');
            // Filter the potentially updated schedule (could be original or post-prepayment)
            // Use the global fullScheduleData which gets updated
            const yearMonths = fullScheduleData.filter(row => row.year == year);

            // --- Determine if we are showing prepayment data ---
            // Check if the first row of yearMonths has prepayment properties
            // or if fullScheduleData itself has been updated with prepayment logic
            // A robust way is to check if the data structure includes prepayment info
            const showingPrepayments = yearMonths.length > 0 && ('prepayment' in yearMonths[0]) && ('totalPayment' in yearMonths[0]);

            let totalPrincipal = 0, totalInterest = 0, totalPrepayment = 0, totalPayment = 0; // Include totalPrepayment
            let monthRowsHTML = "";

            yearMonths.forEach(row => {
                // Accumulate totals based on data structure
                totalPrincipal += row.principal || 0;
                totalInterest += row.interest || 0;

                if (showingPrepayments) {
                    // --- Post-prepayment detailed view logic (6 columns) ---
                    const prepaymentAmount = row.prepayment || 0;
                    // Use the pre-calculated totalPayment which includes prepayment
                    const totalPaymentForMonth = row.totalPayment || (row.total || 0) + prepaymentAmount;
                    totalPrepayment += prepaymentAmount; // Accumulate prepayments
                    totalPayment += totalPaymentForMonth; // Add the combined total

                    monthRowsHTML += `<tr>
                        <td>${row.month}</td>
                        <td>${formatToIndianCurrency(row.principal || 0)}</td>
                        <td>${formatToIndianCurrency(row.interest || 0)}</td>
                        <td>${formatToIndianCurrency(prepaymentAmount)}</td> <!-- Pre-payment Column -->
                        <td>${formatToIndianCurrency(totalPaymentForMonth)}</td> <!-- Total Payment Column (EMI + Prepayment) -->
                        <td>${formatToIndianCurrency(row.balance || 0)}</td>
                    </tr>`;
                } else {
                    // --- Initial detailed view logic (5 columns) ---
                    // Use the original 'total' property for standard payment
                    const standardPayment = row.total || 0;
                    totalPayment += standardPayment; // Add only the standard EMI part

                    // Handle moratorium display if needed (check if standardPayment is 0)
                    let formattedPrincipal = formatToIndianCurrency(row.principal || 0);
                    let formattedTotal = formatToIndianCurrency(standardPayment);
                    if (standardPayment === 0) {
                        formattedPrincipal = "<i>-</i>";
                        formattedTotal = "<i>MORATORIUM</i>";
                    }

                    monthRowsHTML += `<tr>
                        <td>${row.month}</td>
                        <td>${formattedPrincipal}</td>
                        <td>${formatToIndianCurrency(row.interest || 0)}</td>
                        <td>${formattedTotal}</td> <!-- Standard Total Payment Column -->
                        <td>${formatToIndianCurrency(row.balance || 0)}</td>
                    </tr>`;
                    // Note: No prepayment column or totalPrepayment accumulation
                }
            });

            // --- Build header and footer based on data type ---
            let headerHTML = '';
            let footerHTML = '';
            if (showingPrepayments) {
                // --- Post-prepayment header and footer (6 columns) ---
                headerHTML = `<tr>
                                <th>Month</th>
                                <th>To Principal</th>
                                <th>To Interest</th>
                                <th>Pre-payment</th> <!-- Pre-payment Header -->
                                <th>Total Payment</th> <!-- Updated Header -->
                                <th>Balance</th>
                            </tr>`;
                footerHTML = `<tr class="summary-row">
                                <td>Summary</td>
                                <td>${formatToIndianCurrency(totalPrincipal)}</td>
                                <td>${formatToIndianCurrency(totalInterest)}</td>
                                <td>${formatToIndianCurrency(totalPrepayment)}</td> <!-- Prepayment Summary -->
                                <td>${formatToIndianCurrency(totalPayment)}</td> <!-- Combined Total Summary -->
                                <td>${formatToIndianCurrency(yearMonths.length > 0 ? yearMonths[yearMonths.length - 1].balance : 0)}</td>
                            </tr>`;
            } else {
                // --- Initial view header and footer (5 columns) ---
                headerHTML = `<tr>
                                <th>Month</th>
                                <th>To Principal</th>
                                <th>To Interest</th>
                                <th>Total Payment</th> <!-- Standard Header -->
                                <th>Balance</th>
                            </tr>`;
                footerHTML = `<tr class="summary-row">
                                <td>Summary</td>
                                <td>${formatToIndianCurrency(totalPrincipal)}</td>
                                <td>${formatToIndianCurrency(totalInterest)}</td>
                                <td>${formatToIndianCurrency(totalPayment)}</td> <!-- Standard Total Summary -->
                                <td>${formatToIndianCurrency(yearMonths.length > 0 ? yearMonths[yearMonths.length - 1].balance : 0)}</td>
                            </tr>`;
            }

            const detailsTableHTML = `<table class="details-table">
                <thead>${headerHTML}</thead>
                <tbody>${monthRowsHTML}</tbody>
                <tfoot>${footerHTML}</tfoot>
            </table>`;
            const detailsContainer = document.createElement('tr');
            detailsContainer.className = 'details-container-row';
            // Adjust colspan based on view
            const colSpan = showingPrepayments ? 6 : 5;
            detailsContainer.innerHTML = `<td colspan="${colSpan}">${detailsTableHTML}</td>`;
            yearRow.after(detailsContainer);
        }
    });

    if (howToUseBtn) {
    howToUseBtn.addEventListener('click', function() {
        openHowToUseModal();
    });

    if (howToUseBtn) {
  howToUseBtn.addEventListener('click', openHowToUseModal);
}
}

const blogsBtn = document.getElementById('blogs-btn');
if (blogsBtn) {
  blogsBtn.addEventListener('click', () => {
  window.open(
    'https://small-carnation-b33.notion.site/Blogs-Practices-to-become-DEBT-FREE-10x-faster-245fbe91669480cb8d45ca1e94ea06ad?source=copy_link',
    '_blank',
    'noopener'
  );
  });
}

    settingsBtn.addEventListener('click', (e) => { e.stopPropagation(); configPopover.classList.toggle('hidden'); });
    document.addEventListener('click', (e) => {
        const isClickInside = configPopover.contains(e.target) || settingsBtn.contains(e.target);
        const isClickOnCalendar = e.target.closest('.flatpickr-calendar');
        if (!configPopover.classList.contains('hidden') && !isClickInside && !isClickOnCalendar) { configPopover.classList.add('hidden'); }
    });

    if (prepaymentBtn) { prepaymentBtn.addEventListener('click', openPrepaymentModal); }
    if (modalCloseBtn) { modalCloseBtn.addEventListener('click', closePrepaymentModal); }
    if (prepaymentModalOverlay) {
        prepaymentModalOverlay.addEventListener('click', (e) => {
            if (e.target === prepaymentModalOverlay) { closePrepaymentModal(); }
        });
    }

    // NEW: How to Use Modal Event Listeners
    if (howToUseModalCloseBtn) { howToUseModalCloseBtn.addEventListener('click', closeHowToUseModal); }
    if (howToUseModalOverlay) {
        howToUseModalOverlay.addEventListener('click', (e) => {
            if (e.target === howToUseModalOverlay) { closeHowToUseModal(); }
        });
    }

    document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (prepaymentModalOverlay && !prepaymentModalOverlay.classList.contains('hidden')) { 
            closePrepaymentModal(); 
        }
        if (howToUseModalOverlay && !howToUseModalOverlay.classList.contains('hidden')) { 
            closeHowToUseModal(); 
        }
    }
    });

    // --- INITIALIZATION ---
    flatpickr("#startDateWrapper", {
        wrap: true,
        dateFormat: "d-m-Y",
        defaultDate: "today",
        onReady: function(selectedDates, dateStr, instance) { todayDateString = dateStr; },
        onChange: function(selectedDates, dateStr, instance) {
            if (dateStr === todayDateString) { dateWarningEl.classList.add('hidden'); } else { dateWarningEl.classList.remove('hidden'); }
            calculateAndDisplayResults();
        }
    });
    // Note: Modal date pickers are now initialized dynamically
    resetUI();

    // Attach the event listener for the prepayment submit button INSIDE the DOMContentLoaded block
    if (prepaymentSubmitBtn) {
        prepaymentSubmitBtn.addEventListener('click', function(e) {
            e.preventDefault(); // Prevent any default form submission
            applyPrepaymentsAndRecalculate(); // Call the function
        });
    }

}); // <--- This is the closing brace for DOMContentLoaded