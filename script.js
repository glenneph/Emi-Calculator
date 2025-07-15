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
    // NEW: Get reference to the warning message element
    const dateWarningEl = document.getElementById('date-reference-warning');

    // --- STATE & CONSTANTS ---
    let fullScheduleData = [];
    let todayDateString = ""; // NEW: Variable to store the default date string
    const INFLATION_RATE = 5.85;

    // --- HELPER FUNCTIONS ---
    const formatToIndianCurrency = (num) => {
        if (isNaN(num) || num === undefined) return "-";
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        }).format(num);
    };

    const resetUI = () => {
        summaryEmiEl.textContent = "-";
        summaryInterestEl.textContent = "-";
        summaryTotalEl.textContent = "-";
        summaryInflationLossEl.textContent = "-";
        amortizationBody.innerHTML = `<tr class="placeholder-row"><td colspan="6">-</td></tr>`;
        amortizationContainer.classList.add('hidden');
    };

    // --- CORE LOGIC ---
    function calculateAndDisplayResults() {
        const P = parseFloat(loanAmountInput.value);
        const annualInterestRate = parseFloat(interestRateInput.value);
        const tenureInYears = parseFloat(tenureInput.value);
        const moratoriumInYears = parseFloat(moratoriumInput.value) || 0;

        if (isNaN(P) || isNaN(annualInterestRate) || isNaN(tenureInYears) || P <= 0 || annualInterestRate <= 0 || tenureInYears <= 0) {
            resetUI();
            return;
        }

        amortizationContainer.classList.remove('hidden');
        
        const r_actual = (annualInterestRate / 12) / 100;
        const n = tenureInYears * 12;
        const m = moratoriumInYears * 12;

        let effectivePrincipal = P;
        if (m > 0) {
            effectivePrincipal = P * Math.pow(1 + r_actual, m);
        }
        
        const emi = (effectivePrincipal * r_actual * Math.pow(1 + r_actual, n)) / (Math.pow(1 + r_actual, n) - 1);
        
        updateSummary(P, emi, n, annualInterestRate, moratoriumInYears);
        
        // MODIFIED: Calculation is now always based on the REAL current date, not the picker.
        const calculationStartDate = new Date();
        fullScheduleData = generateAmortizationData(P, emi, r_actual, n, m, calculationStartDate.getMonth(), calculationStartDate.getFullYear());
        renderInitialTable(fullScheduleData);
    }
    
    function updateSummary(P, emi, n, annualInterestRate, moratoriumInYears) {
        const totalAmountPayable = emi * n;
        const totalInterestPayable = totalAmountPayable - P;

        const adjustedInterestRate = Math.max(0, annualInterestRate - INFLATION_RATE);
        let inflationAdjustedLoss = 0;

        if (adjustedInterestRate > 0) {
            const r_adjusted = (adjustedInterestRate / 12) / 100;
            const m_months = moratoriumInYears * 12;

            let effectivePrincipal_adjusted = P;
            if (m_months > 0) {
                effectivePrincipal_adjusted = P * Math.pow(1 + r_adjusted, m_months);
            }

            const emi_adjusted = (effectivePrincipal_adjusted * r_adjusted * Math.pow(1 + r_adjusted, n)) / (Math.pow(1 + r_adjusted, n) - 1);
            
            if(isFinite(emi_adjusted)) {
                inflationAdjustedLoss = (emi_adjusted * n) - P;
            }
        }

        summaryEmiEl.textContent = formatToIndianCurrency(emi);
        summaryInterestEl.textContent = formatToIndianCurrency(totalInterestPayable);
        summaryTotalEl.textContent = formatToIndianCurrency(totalAmountPayable);
        summaryInflationLossEl.textContent = formatToIndianCurrency(inflationAdjustedLoss);
    }
    
    // The rest of your functions like generateAmortizationData, renderInitialTable, etc., remain unchanged.
    // ... (All other functions from the previous correct version are here and correct)

    function generateAmortizationData(principal, emi, monthlyRate, tenureMonths, moratoriumMonths, startMonthIndex, startYear) {
        let balance = principal;
        const schedule = [];
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const totalDurationInMonths = moratoriumMonths + tenureMonths;
        for (let i = 0; i < totalDurationInMonths; i++) {
            const currentMonthIndex = (startMonthIndex + i) % 12;
            const currentYear = startYear + Math.floor((startMonthIndex + i) / 12);
            const interestPayment = balance * monthlyRate;
            if (i < moratoriumMonths) {
                balance += interestPayment;
                schedule.push({ year: currentYear, month: monthNames[currentMonthIndex], principal: 0, interest: interestPayment, total: 0, balance: balance });
            } else {
                const principalPayment = emi - interestPayment;
                balance -= principalPayment;
                schedule.push({ year: currentYear, month: monthNames[currentMonthIndex], principal: principalPayment, interest: interestPayment, total: emi, balance: balance > 0 ? balance : 0 });
            }
        }
        return schedule;
    }
    function renderInitialTable(schedule) {
        amortizationBody.innerHTML = "";
        if (!schedule || schedule.length === 0) {
            amortizationBody.innerHTML = `<tr class="placeholder-row"><td colspan="6">-</td></tr>`;
            return;
        }
        const yearlyData = {};
        schedule.forEach(row => { if (!yearlyData[row.year]) { yearlyData[row.year] = true; } });
        let tableHTML = "";
        for (const year in yearlyData) {
            tableHTML += `<tr class="year-row" data-year="${year}"><td>${year}<img src="assets/chevron.svg" alt="Toggle Details" class="toggle-icon"></td></tr>`;
        }
        amortizationBody.innerHTML = tableHTML;
    }
    allInputs.forEach(input => {
        input.addEventListener('input', () => {
            const max = parseFloat(input.max);
            if (input.value && parseFloat(input.value) > max) { input.value = max; }
            calculateAndDisplayResults();
        });
    });
    amortizationBody.addEventListener('click', function(e) {
        const yearRow = e.target.closest('.year-row');
        if (!yearRow) return;
        const year = yearRow.dataset.year;
        const wasOpen = yearRow.classList.contains('open');
        const currentlyOpenRow = document.querySelector('.year-row.open');
        if (currentlyOpenRow) {
            currentlyOpenRow.classList.remove('open');
        }
        const existingDetails = document.querySelector('.details-container-row');
        if (existingDetails) {
            existingDetails.remove();
        }
        if (!wasOpen) {
            yearRow.classList.add('open');
            const yearMonths = fullScheduleData.filter(row => row.year == year);
            let totalPrincipal = 0, totalInterest = 0, totalPayment = 0;
            let monthRowsHTML = "";
            yearMonths.forEach(row => {
                totalPrincipal += row.principal;
                totalInterest += row.interest;
                totalPayment += row.total;
                let principalText = formatToIndianCurrency(row.principal);
                let totalText = formatToIndianCurrency(row.total);
                if (row.total === 0) {
                    principalText = "<i>-</i>";
                    totalText = "<i>MORATORIUM</i>";
                }
                monthRowsHTML += `<tr><td>${row.month}</td><td>${principalText}</td><td>${formatToIndianCurrency(row.interest)}</td><td>${totalText}</td><td>${formatToIndianCurrency(row.balance)}</td></tr>`;
            });
            const detailsTableHTML = `<table class="details-table"><thead><tr><th>Month</th><th>To Principal</th><th>To Interest</th><th>Total Payment</th><th>Balance</th></tr></thead><tbody>${monthRowsHTML}</tbody><tfoot><tr class="summary-row"><td>Summary</td><td>${formatToIndianCurrency(totalPrincipal)}</td><td>${formatToIndianCurrency(totalInterest)}</td><td>${formatToIndianCurrency(totalPayment)}</td><td>${formatToIndianCurrency(yearMonths[yearMonths.length - 1].balance)}</td></tr></tfoot></table>`;
            const detailsContainer = document.createElement('tr');
            detailsContainer.className = 'details-container-row';
            detailsContainer.innerHTML = `<td colspan="5">${detailsTableHTML}</td>`;
            yearRow.after(detailsContainer);
        }
    });
    settingsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        configPopover.classList.toggle('hidden');
    });
    document.addEventListener('click', (e) => {
        const isClickInside = configPopover.contains(e.target) || settingsBtn.contains(e.target);
        const isClickOnCalendar = e.target.closest('.flatpickr-calendar');
        if (!configPopover.classList.contains('hidden') && !isClickInside && !isClickOnCalendar) {
            configPopover.classList.add('hidden');
        }
    });

    // --- INITIALIZATION ---
    // MODIFIED: Flatpickr logic now controls the warning message visibility
    flatpickr("#startDateWrapper", {
        wrap: true,
        dateFormat: "d-m-Y",
        defaultDate: "today",
        
        // This hook runs once when the calendar is ready
        onReady: function(selectedDates, dateStr, instance) {
            // Store the initial "today" date string for comparison
            todayDateString = dateStr;
        },

        // This hook runs every time the user picks a new date
        onChange: function(selectedDates, dateStr, instance) {
            // Check if the newly selected date is different from the original "today" date
            if (dateStr === todayDateString) {
                // If the user selects "today" again, hide the warning
                dateWarningEl.classList.add('hidden');
            } else {
                // If it's different, show the warning message
                dateWarningEl.classList.remove('hidden');
            }
            // We DO NOT call calculateAndDisplayResults() here anymore.
        }
    });
    
    resetUI();
    calculateAndDisplayResults();
});