document.addEventListener('DOMContentLoaded', () => {

    // --- DOM ELEMENTS ---
    const loanAmountInput = document.getElementById('loanAmount');
    const interestRateInput = document.getElementById('interestRate');
    const tenureInput = document.getElementById('tenure');
    const allInputs = [loanAmountInput, interestRateInput, tenureInput];

    const summaryEmiEl = document.getElementById('summary-emi');
    const summaryInterestEl = document.getElementById('summary-interest');
    const summaryTotalEl = document.getElementById('summary-total');
    const summaryInflationLossEl = document.getElementById('summary-inflation-loss');
    
    const amortizationBody = document.getElementById('amortization-body');
    const amortizationContainer = document.querySelector('.amortization-table-container');

    const settingsBtn = document.querySelector('.settings-btn');
    const configPopover = document.getElementById('config-popover'); // Changed from configModalOverlay

    const startDateInput = document.getElementById('startDate');

    // --- STATE & CONSTANTS ---
    let fullScheduleData = [];
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
        amortizationBody.innerHTML = `<tr class="placeholder-row"><td colspan="5">-</td></tr>`;
        amortizationContainer.classList.add('hidden');
    };

    // --- CORE LOGIC ---
    function calculateAndDisplayResults() {
        const P = parseFloat(loanAmountInput.value);
        const annualInterestRate = parseFloat(interestRateInput.value);
        const tenureInYears = parseFloat(tenureInput.value);

        if (isNaN(P) || isNaN(annualInterestRate) || isNaN(tenureInYears) || P <= 0 || annualInterestRate <= 0 || tenureInYears <= 0) {
            resetUI();
            return;
        }

        amortizationContainer.classList.remove('hidden');
        
        const r_actual = (annualInterestRate / 12) / 100;
        const n = tenureInYears * 12;
        const emi = (P * r_actual * Math.pow(1 + r_actual, n)) / (Math.pow(1 + r_actual, n) - 1);
        
        updateSummary(P, emi, n, annualInterestRate);
        // This new block replaces the two lines above
        const dateParts = startDateInput.value.split('/');
        if (dateParts.length === 3) {
            const day = parseInt(dateParts[0], 10);
            const month = parseInt(dateParts[1], 10) - 1; // JS months are 0-11
            const year = parseInt(dateParts[2], 10);
            const startDate = new Date(year, month, day);

            if (!isNaN(startDate)) {
                fullScheduleData = generateAmortizationData(P, emi, r_actual, n, startDate.getMonth(), startDate.getFullYear());
                renderInitialTable(fullScheduleData);
            }
        }
        renderInitialTable(fullScheduleData);
    }
    
    function updateSummary(P, emi, n, annualInterestRate) {
        const totalAmountPayable = emi * n;
        const totalInterestPayable = totalAmountPayable - P;

        const adjustedInterestRate = Math.max(0, annualInterestRate - INFLATION_RATE);
        let inflationAdjustedLoss = 0;
        if (adjustedInterestRate > 0) {
            const r_adjusted = (adjustedInterestRate / 12) / 100;
            const emi_adjusted = (P * r_adjusted * Math.pow(1 + r_adjusted, n)) / (Math.pow(1 + r_adjusted, n) - 1);
            inflationAdjustedLoss = (emi_adjusted * n) - P;
        }

        summaryEmiEl.textContent = formatToIndianCurrency(emi);
        summaryInterestEl.textContent = formatToIndianCurrency(totalInterestPayable);
        summaryTotalEl.textContent = formatToIndianCurrency(totalAmountPayable);
        summaryInflationLossEl.textContent = formatToIndianCurrency(inflationAdjustedLoss);
    }
    
    function generateAmortizationData(principal, emi, monthlyRate, totalMonths, startMonthIndex, startYear) {
        let balance = principal;
        const schedule = [];
        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        for (let i = 0; i < totalMonths; i++) {
            const interestPayment = balance * monthlyRate;
            const principalPayment = emi - interestPayment;
            balance -= principalPayment;
            const currentMonthIndex = (startMonthIndex + i) % 12;
            const currentYear = startYear + Math.floor((startMonthIndex + i) / 12);
            schedule.push({ year: currentYear, month: monthNames[currentMonthIndex], principal: principalPayment, interest: interestPayment, total: emi, balance: balance > 0 ? balance : 0 });
        }
        return schedule;
    }

    function renderInitialTable(schedule) {
        const yearlyData = {};
        schedule.forEach(row => { if (!yearlyData[row.year]) { yearlyData[row.year] = true; } });
        let tableHTML = "";
        for (const year in yearlyData) {
            tableHTML += `<tr class="year-row" data-year="${year}"><td>${year}<img src="assets/chevron.svg" alt="Toggle Details" class="toggle-icon"></td></tr>`;
        }
        amortizationBody.innerHTML = tableHTML;
    }

    // --- EVENT LISTENERS ---
    allInputs.forEach(input => {
        input.addEventListener('input', () => {
            const max = parseFloat(input.max);
            if (input.value && parseFloat(input.value) > max) { input.value = max; }
            calculateAndDisplayResults();
        });
    });

    // RESTORED: The reliable "create and destroy" click handler
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
                monthRowsHTML += `<tr><td>${row.month}</td><td>${formatToIndianCurrency(row.principal)}</td><td>${formatToIndianCurrency(row.interest)}</td><td>${formatToIndianCurrency(row.total)}</td><td>${formatToIndianCurrency(row.balance)}</td></tr>`;
            });
            const detailsTableHTML = `<table class="details-table"><thead><tr><th>Month</th><th>To Principal</th><th>To Interest</th><th>Total Payment</th><th>Balance</th></tr></thead><tbody>${monthRowsHTML}</tbody><tfoot><tr class="summary-row"><td>Summary</td><td>${formatToIndianCurrency(totalPrincipal)}</td><td>${formatToIndianCurrency(totalInterest)}</td><td>${formatToIndianCurrency(totalPayment)}</td><td>${formatToIndianCurrency(yearMonths[yearMonths.length - 1].balance)}</td></tr></tfoot></table>`;
            const detailsContainer = document.createElement('tr');
            detailsContainer.className = 'details-container-row';
            detailsContainer.innerHTML = `<td colspan="5">${detailsTableHTML}</td>`;
            yearRow.after(detailsContainer);
        }
    });

    // --- ADD THIS ENTIRE NEW BLOCK for MODAL FUNCTIONALITY ---

    // Event Listener to SHOW the modal by removing the 'hidden' class
    settingsBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevents the click from bubbling up to the document
        configPopover.classList.toggle('hidden');
    });

    // Event listener on the whole document to close the popover
    document.addEventListener('click', (e) => {
        // If the popover is NOT hidden and the click was OUTSIDE both the popover and the button
        if (!configPopover.classList.contains('hidden') && !configPopover.contains(e.target) && !settingsBtn.contains(e.target)) {
            configPopover.classList.add('hidden');
        }
    });

    // --- END OF NEW BLOCK ---

    // --- INITIALIZATION ---
    flatpickr("#startDate", {
    // Sets the date format to dd/mm/yyyy
    dateFormat: "d/m/Y",
    
    // Prevents selecting any date in the past
    minDate: "today",
    
    // Sets the default date to today when the page loads
    defaultDate: "today",
    
    // This function runs every time the user picks a new date
    onChange: function(selectedDates, dateStr, instance) {
        calculateAndDisplayResults();
    }
});
    resetUI();
    calculateAndDisplayResults();
});